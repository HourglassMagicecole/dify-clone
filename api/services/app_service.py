import json
import logging
from typing import TypedDict, cast

import sqlalchemy as sa
from flask_sqlalchemy.pagination import Pagination

from configs import dify_config
from constants.model_template import default_app_templates
from core.agent.entities import AgentToolEntity
from core.errors.error import LLMBadRequestError, ProviderTokenNotInitError
from core.model_manager import ModelManager
from core.model_runtime.entities.model_entities import ModelPropertyKey, ModelType
from core.model_runtime.model_providers.__base.large_language_model import LargeLanguageModel
from core.tools.tool_manager import ToolManager
from core.tools.utils.configuration import ToolParameterConfigurationManager
from events.app_event import app_was_created
from extensions.ext_database import db
from libs.datetime_utils import naive_utc_now
from libs.login import current_user
from models.account import Account
from models.model import App, AppMode, AppModelConfig, Site
from models.tools import ApiToolProvider
from services.billing_service import BillingService
from services.enterprise.enterprise_service import EnterpriseService
from services.feature_service import FeatureService
from services.tag_service import TagService
from tasks.remove_app_and_related_data_task import remove_app_and_related_data_task

logger = logging.getLogger(__name__)

# Mapping: Tool Provider → Model Provider
# For tools that depend on Model Provider credentials (e.g., DALL-E uses OpenAI API Key)
TOOL_TO_MODEL_PROVIDER_MAP = {
    "openai_tool": "openai",  # DALL-E tools use OpenAI Model Provider credential
}


class AppService:
    def get_paginate_apps(self, user_id: str, tenant_id: str, args: dict) -> Pagination | None:
        """
        Get app list with pagination
        :param user_id: user id
        :param tenant_id: tenant id
        :param args: request args
        :return:
        """
        filters = [App.tenant_id == tenant_id, App.is_universal == False]

        if args["mode"] == "workflow":
            filters.append(App.mode == AppMode.WORKFLOW)
        elif args["mode"] == "completion":
            filters.append(App.mode == AppMode.COMPLETION)
        elif args["mode"] == "chat":
            filters.append(App.mode == AppMode.CHAT)
        elif args["mode"] == "advanced-chat":
            filters.append(App.mode == AppMode.ADVANCED_CHAT)
        elif args["mode"] == "agent-chat":
            filters.append(App.mode == AppMode.AGENT_CHAT)

        if args.get("is_created_by_me", False):
            filters.append(App.created_by == user_id)
        if args.get("name"):
            name = args["name"][:30]
            filters.append(App.name.ilike(f"%{name}%"))
        # Check if tag_ids is not empty to avoid WHERE false condition
        if args.get("tag_ids") and len(args["tag_ids"]) > 0:
            target_ids = TagService.get_target_ids_by_tag_ids("app", tenant_id, args["tag_ids"])
            if target_ids and len(target_ids) > 0:
                filters.append(App.id.in_(target_ids))
            else:
                return None

        # Education session-based filtering
        if args.get("session_id"):
            from services.edu.resource_tagging_service import ResourceTaggingService

            tagging_service = ResourceTaggingService()
            edu_resource_ids = tagging_service.get_resources_by_tag(
                session_id=args["session_id"],
                resource_type="app",
                account_id=args.get("edu_account_id"),
            )
            if edu_resource_ids and len(edu_resource_ids) > 0:
                filters.append(App.id.in_(edu_resource_ids))
            else:
                # No resources in this session: return empty result
                return None

        app_models = db.paginate(
            sa.select(App).where(*filters).order_by(App.created_at.desc()),
            page=args["page"],
            per_page=args["limit"],
            error_out=False,
        )

        return app_models

    def create_app(self, tenant_id: str, args: dict, account: Account) -> App:
        """
        Create app
        :param tenant_id: tenant id
        :param args: request args
        :param account: Account instance
        """
        app_mode = AppMode.value_of(args["mode"])
        app_template = default_app_templates[app_mode]

        # get model config - prioritize args over template
        from_wizard = False
        if args.get("model_config"):
            # Use model_config from Agent Wizard
            from_wizard = True
            wizard_config = args["model_config"].copy()
            # Convert from {provider, name, mode, completion_params, stop} format
            model_dict = {
                "provider": wizard_config.get("provider"),
                "name": wizard_config.get("name"),
                "mode": wizard_config.get("mode", "chat"),
                "completion_params": wizard_config.get("completion_params", {}),
            }
            # Build AppModelConfig-compatible dict
            configs = wizard_config.get("configs", {})
            # Enable file upload: check root level first (from Frontend), then configs, then use default
            if "file_upload" not in configs:
                if wizard_config.get("file_upload"):
                    # Use file_upload from root level (sent by Frontend)
                    configs["file_upload"] = wizard_config.get("file_upload")
                else:
                    # Default file upload config for Agent mode to support tools like ASR
                    configs["file_upload"] = {
                        "enabled": True,
                        "allowed_file_types": ["image", "audio", "video", "document"],
                        "allowed_file_upload_methods": ["local_file", "remote_url"],
                        "number_limits": 5,
                    }
            default_model_config = {
                "model": json.dumps(model_dict),
                "configs": configs,
                "file_upload": json.dumps(configs.get("file_upload")) if configs.get("file_upload") else None,
            }
        else:
            # Use template default
            default_model_config = app_template.get("model_config")
            default_model_config = default_model_config.copy() if default_model_config else None

        # Process template model config (skip for Agent Wizard as it's already processed)
        if (
            not from_wizard
            and default_model_config
            and "model" in default_model_config
            and isinstance(default_model_config["model"], dict)
        ):
            # get model provider
            model_manager = ModelManager()
            # Extract model dict for type safety
            model_dict_from_config = cast(dict, default_model_config["model"])

            # get default model instance
            try:
                model_instance = model_manager.get_default_model_instance(
                    tenant_id=account.current_tenant_id or "", model_type=ModelType.LLM
                )
            except (ProviderTokenNotInitError, LLMBadRequestError):
                model_instance = None
            except Exception:
                logger.exception("Get default model instance failed, tenant_id: %s", tenant_id)
                model_instance = None

            if model_instance:
                if model_instance.model == model_dict_from_config.get(
                    "name"
                ) and model_instance.provider == model_dict_from_config.get("provider"):
                    default_model_dict = model_dict_from_config
                else:
                    llm_model = cast(LargeLanguageModel, model_instance.model_type_instance)
                    model_schema = llm_model.get_model_schema(model_instance.model, model_instance.credentials)
                    if model_schema is None:
                        raise ValueError(f"model schema not found for model {model_instance.model}")

                    default_model_dict = {
                        "provider": model_instance.provider,
                        "name": model_instance.model,
                        "mode": model_schema.model_properties.get(ModelPropertyKey.MODE),
                        "completion_params": {},
                    }
            else:
                provider, model = model_manager.get_default_provider_model_name(
                    tenant_id=account.current_tenant_id or "", model_type=ModelType.LLM
                )
                model_dict_from_config["provider"] = provider
                model_dict_from_config["name"] = model
                default_model_dict = model_dict_from_config

            default_model_config["model"] = json.dumps(default_model_dict)

        app = App(**app_template["app"])
        app.name = args["name"]
        app.description = args.get("description", "")
        app.mode = args["mode"]
        app.icon_type = args.get("icon_type", "emoji")
        app.icon = args["icon"]
        app.icon_background = args["icon_background"]
        app.tenant_id = tenant_id
        app.api_rph = args.get("api_rph", 0)
        app.api_rpm = args.get("api_rpm", 0)
        app.created_by = account.id
        app.updated_by = account.id

        db.session.add(app)
        db.session.flush()

        if default_model_config:
            app_model_config = AppModelConfig(**default_model_config)
            app_model_config.app_id = app.id
            app_model_config.created_by = account.id
            app_model_config.updated_by = account.id

            # Apply Agent Wizard settings
            if args.get("pre_prompt"):
                app_model_config.pre_prompt = args["pre_prompt"]
            if args.get("opening_statement"):
                app_model_config.opening_statement = args["opening_statement"]
            if args.get("suggested_questions"):
                app_model_config.suggested_questions = json.dumps(args["suggested_questions"])
            if args.get("user_input_form"):
                app_model_config.user_input_form = json.dumps(args["user_input_form"])
            if args.get("agent_mode"):
                # Set agent mode for agent-chat type
                agent_mode_data = args["agent_mode"]

                # Copy credentials to BuiltinToolProvider for Dify UI compatibility
                # Priority: UserToolConfig (user-level) > Model Provider (workspace-level)
                if agent_mode_data.get("tools"):
                    from core.tools.entities.tool_entities import CredentialType
                    from models.education.user_tool_config import UserToolConfig
                    from models.tools import BuiltinToolProvider
                    from services.education_management.encryption_service import APIKeyEncryptionService

                    for tool in agent_mode_data["tools"]:
                        provider_id = tool.get("provider_id")
                        if not provider_id:
                            continue

                        # Priority 1: Check if user has credential in UserToolConfig
                        user_config = (
                            db.session.query(UserToolConfig)
                            .filter_by(user_id=account.id, provider=provider_id, is_active=True)
                            .first()
                        )

                        if user_config:
                            # Check if BuiltinToolProvider already exists for this tenant
                            existing_provider = (
                                db.session.query(BuiltinToolProvider)
                                .filter_by(tenant_id=tenant_id, provider=provider_id)
                                .first()
                            )

                            if not existing_provider:
                                # Copy UserToolConfig credential to BuiltinToolProvider
                                # Decrypt from UserToolConfig
                                encryption_service = APIKeyEncryptionService()
                                decrypted_key = encryption_service.decrypt(user_config.api_key_encrypted)

                                # Get provider schema
                                from core.tools.tool_manager import ToolManager

                                provider_controller = ToolManager.get_builtin_provider(provider_id, tenant_id)
                                credentials_schema = provider_controller.get_credentials_schema()

                                if credentials_schema:
                                    # Build credential dict
                                    credentials_dict = {}
                                    for cred_field in credentials_schema:
                                        credentials_dict[cred_field.name] = decrypted_key

                                    # Encrypt using Dify's encrypter
                                    from core.helper.provider_cache import ToolProviderCredentialsCache
                                    from core.tools.utils.encryption import create_provider_encrypter

                                    encrypter, _ = create_provider_encrypter(
                                        tenant_id=tenant_id,
                                        config=[x.to_basic_provider_config() for x in credentials_schema],
                                        cache=ToolProviderCredentialsCache(
                                            tenant_id=tenant_id,
                                            provider=provider_id,
                                            credential_id=f"copied_from_user_{account.id}",
                                        ),
                                    )
                                    encrypted_credentials_dict = encrypter.encrypt(credentials_dict)
                                    encrypted_credentials = json.dumps(encrypted_credentials_dict)

                                    # Create BuiltinToolProvider
                                    new_provider = BuiltinToolProvider()
                                    new_provider.tenant_id = tenant_id
                                    new_provider.user_id = account.id
                                    new_provider.provider = provider_id
                                    new_provider.encrypted_credentials = encrypted_credentials
                                    new_provider.credential_type = CredentialType.API_KEY.value
                                    new_provider.name = f"API KEY (from {account.name})"
                                    new_provider.is_default = True
                                    new_provider.expires_at = -1

                                    db.session.add(new_provider)
                                    db.session.flush()
                        else:
                            # Priority 2: Check if Tool Provider should use Model Provider credential
                            if provider_id in TOOL_TO_MODEL_PROVIDER_MAP:
                                model_provider_name = TOOL_TO_MODEL_PROVIDER_MAP[provider_id]

                                # Check if BuiltinToolProvider already exists
                                existing_provider = (
                                    db.session.query(BuiltinToolProvider)
                                    .filter_by(tenant_id=tenant_id, provider=provider_id)
                                    .first()
                                )

                                # Get Admin API Key from Education system (Story 1.8)
                                from models.education.api_key_config import AdminAPIKeyConfig

                                admin_api_key = (
                                    db.session.query(AdminAPIKeyConfig)
                                    .filter(
                                        sa.func.lower(AdminAPIKeyConfig.provider) == model_provider_name.lower(),
                                        AdminAPIKeyConfig.is_active == True,
                                    )
                                    .first()
                                )

                                if admin_api_key and admin_api_key.api_key_encrypted:
                                    # Delete existing provider if found (to ensure credential is up-to-date)
                                    if existing_provider:
                                        db.session.delete(existing_provider)
                                        db.session.flush()

                                    try:
                                        # Decrypt Admin API Key
                                        encryption_service = APIKeyEncryptionService()
                                        api_key = encryption_service.decrypt(admin_api_key.api_key_encrypted)

                                        if api_key:
                                            # Get Tool Provider schema
                                            from core.tools.tool_manager import ToolManager

                                            tool_provider_controller = ToolManager.get_builtin_provider(
                                                provider_id, tenant_id
                                            )
                                            credentials_schema = tool_provider_controller.get_credentials_schema()

                                            if credentials_schema:
                                                # Build credential dict for Tool Provider
                                                credentials_dict = {}
                                                for cred_field in credentials_schema:
                                                    # Set API key for required fields or 'api_key' named fields
                                                    if cred_field.required or "api_key" in cred_field.name.lower():
                                                        credentials_dict[cred_field.name] = api_key

                                                # Encrypt using Dify's Tool Provider encrypter
                                                from core.helper.provider_cache import ToolProviderCredentialsCache
                                                from core.tools.utils.encryption import create_provider_encrypter

                                                encrypter, _ = create_provider_encrypter(
                                                    tenant_id=tenant_id,
                                                    config=[x.to_basic_provider_config() for x in credentials_schema],
                                                    cache=ToolProviderCredentialsCache(
                                                        tenant_id=tenant_id,
                                                        provider=provider_id,
                                                        credential_id=f"copied_from_admin_{admin_api_key.id}",
                                                    ),
                                                )
                                                encrypted_credentials_dict = encrypter.encrypt(credentials_dict)
                                                encrypted_credentials = json.dumps(encrypted_credentials_dict)

                                                # Create BuiltinToolProvider
                                                new_provider = BuiltinToolProvider()
                                                new_provider.tenant_id = tenant_id
                                                new_provider.user_id = account.id
                                                new_provider.provider = provider_id
                                                new_provider.encrypted_credentials = encrypted_credentials
                                                new_provider.credential_type = CredentialType.API_KEY.value
                                                new_provider.name = f"API KEY (from Admin: {admin_api_key.key_name})"
                                                new_provider.is_default = True
                                                new_provider.expires_at = -1

                                                db.session.add(new_provider)
                                                db.session.flush()
                                    except Exception as e:
                                        logger.warning(
                                            "Failed to copy admin API key to tool provider %s: %s",
                                            provider_id,
                                            str(e),
                                        )

                # Add Dify-required top-level fields
                agent_mode_data["strategy"] = agent_mode_data.get("strategy", "function_call")
                agent_mode_data["max_iteration"] = agent_mode_data.get("max_iteration", 10)
                agent_mode_data["prompt"] = agent_mode_data.get("prompt")

                # Transform tools to Dify format
                if agent_mode_data.get("tools"):
                    from core.tools.tool_manager import ToolManager
                    from core.tools.utils.configuration import ToolParameterConfigurationManager

                    for tool in agent_mode_data["tools"]:
                        # Helper: Convert snake_case to CamelCase
                        def to_camel_case(snake_str: str) -> str:
                            components = snake_str.split("_")
                            return "".join(x.title() for x in components)

                        # Add Dify-required tool fields
                        tool["provider_name"] = tool.get("provider_name", tool.get("provider_id"))
                        tool["tool_label"] = tool.get("tool_label", to_camel_case(tool.get("tool_name", "")))
                        tool["enabled"] = tool.get("enabled", True)
                        tool["notAuthor"] = tool.get("notAuthor", True)

                        # Populate tool_parameters from tool schema
                        try:
                            agent_tool_entity = AgentToolEntity(**tool)
                            tool_runtime = ToolManager.get_agent_tool_runtime(
                                tenant_id=tenant_id,
                                app_id=app.id,
                                agent_tool=agent_tool_entity,
                                user_id=account.id,
                            )

                            # Build parameter schema with empty values
                            parameters = {}
                            for param in tool_runtime.entity.parameters:
                                parameters[param.name] = ""

                            # Encrypt secret parameters
                            manager = ToolParameterConfigurationManager(
                                tenant_id=tenant_id,
                                tool_runtime=tool_runtime,
                                provider_name=agent_tool_entity.provider_id,
                                provider_type=agent_tool_entity.provider_type,
                                identity_id=f"AGENT.{app.id}",
                            )

                            encrypted_params = manager.encrypt_tool_parameters(parameters)
                            tool["tool_parameters"] = encrypted_params
                        except Exception as e:
                            logger.warning(
                                "Failed to configure tool parameters for %s: %s", tool.get("tool_name"), str(e)
                            )
                            # Fallback to empty parameters
                            tool["tool_parameters"] = {}

                app_model_config.agent_mode = json.dumps(agent_mode_data)

            db.session.add(app_model_config)
            db.session.flush()

            app.app_model_config_id = app_model_config.id

        db.session.commit()

        app_was_created.send(app, account=account)

        if FeatureService.get_system_features().webapp_auth.enabled:
            # update web app setting as private
            EnterpriseService.WebAppAuth.update_app_access_mode(app.id, "private")

        if dify_config.BILLING_ENABLED:
            BillingService.clean_billing_info_cache(app.tenant_id)

        return app

    def get_app(self, app: App) -> App:
        """
        Get App
        """
        assert isinstance(current_user, Account)
        assert current_user.current_tenant_id is not None
        # get original app model config
        if app.mode == AppMode.AGENT_CHAT or app.is_agent:
            model_config = app.app_model_config
            if not model_config:
                return app
            agent_mode = model_config.agent_mode_dict
            # decrypt agent tool parameters if it's secret-input
            for tool in agent_mode.get("tools") or []:
                if not isinstance(tool, dict) or len(tool.keys()) <= 3:
                    continue
                agent_tool_entity = AgentToolEntity(**tool)
                # get tool
                try:
                    tool_runtime = ToolManager.get_agent_tool_runtime(
                        tenant_id=current_user.current_tenant_id,
                        app_id=app.id,
                        agent_tool=agent_tool_entity,
                    )
                    manager = ToolParameterConfigurationManager(
                        tenant_id=current_user.current_tenant_id,
                        tool_runtime=tool_runtime,
                        provider_name=agent_tool_entity.provider_id,
                        provider_type=agent_tool_entity.provider_type,
                        identity_id=f"AGENT.{app.id}",
                    )

                    # get decrypted parameters
                    if agent_tool_entity.tool_parameters:
                        parameters = manager.decrypt_tool_parameters(agent_tool_entity.tool_parameters or {})
                        masked_parameter = manager.mask_tool_parameters(parameters or {})
                    else:
                        masked_parameter = {}

                    # override tool parameters
                    tool["tool_parameters"] = masked_parameter
                except Exception:
                    pass

            # override agent mode
            if model_config:
                model_config.agent_mode = json.dumps(agent_mode)

            class ModifiedApp(App):
                """
                Modified App class
                """

                def __init__(self, app):
                    self.__dict__.update(app.__dict__)

                @property
                def app_model_config(self):
                    return model_config

            app = ModifiedApp(app)

        return app

    class ArgsDict(TypedDict):
        name: str
        description: str
        icon_type: str
        icon: str
        icon_background: str
        use_icon_as_answer_icon: bool
        max_active_requests: int

    def update_app(self, app: App, args: ArgsDict) -> App:
        """
        Update app
        :param app: App instance
        :param args: request args
        :return: App instance
        """
        assert current_user is not None
        app.name = args["name"]
        app.description = args["description"]
        app.icon_type = args["icon_type"]
        app.icon = args["icon"]
        app.icon_background = args["icon_background"]
        app.use_icon_as_answer_icon = args.get("use_icon_as_answer_icon", False)
        app.max_active_requests = args.get("max_active_requests")
        app.updated_by = current_user.id
        app.updated_at = naive_utc_now()
        db.session.commit()

        return app

    def update_app_name(self, app: App, name: str) -> App:
        """
        Update app name
        :param app: App instance
        :param name: new name
        :return: App instance
        """
        assert current_user is not None
        app.name = name
        app.updated_by = current_user.id
        app.updated_at = naive_utc_now()
        db.session.commit()

        return app

    def update_app_icon(self, app: App, icon: str, icon_background: str) -> App:
        """
        Update app icon
        :param app: App instance
        :param icon: new icon
        :param icon_background: new icon_background
        :return: App instance
        """
        assert current_user is not None
        app.icon = icon
        app.icon_background = icon_background
        app.updated_by = current_user.id
        app.updated_at = naive_utc_now()
        db.session.commit()

        return app

    def update_app_site_status(self, app: App, enable_site: bool) -> App:
        """
        Update app site status
        :param app: App instance
        :param enable_site: enable site status
        :return: App instance
        """
        if enable_site == app.enable_site:
            return app
        assert current_user is not None
        app.enable_site = enable_site
        app.updated_by = current_user.id
        app.updated_at = naive_utc_now()
        db.session.commit()

        return app

    def update_app_api_status(self, app: App, enable_api: bool) -> App:
        """
        Update app api status
        :param app: App instance
        :param enable_api: enable api status
        :return: App instance
        """
        if enable_api == app.enable_api:
            return app
        assert current_user is not None

        app.enable_api = enable_api
        app.updated_by = current_user.id
        app.updated_at = naive_utc_now()
        db.session.commit()

        return app

    def delete_app(self, app: App):
        """
        Delete app
        :param app: App instance
        """
        from events.app_event import app_was_deleted

        # Send delete event before deleting (handlers need access to app object)
        app_was_deleted.send(app)

        db.session.delete(app)
        db.session.commit()

        # clean up web app settings
        if FeatureService.get_system_features().webapp_auth.enabled:
            EnterpriseService.WebAppAuth.cleanup_webapp(app.id)

        if dify_config.BILLING_ENABLED:
            BillingService.clean_billing_info_cache(app.tenant_id)

        # Trigger asynchronous deletion of app and related data
        remove_app_and_related_data_task.delay(tenant_id=app.tenant_id, app_id=app.id)

    def get_app_meta(self, app_model: App):
        """
        Get app meta info
        :param app_model: app model
        :return:
        """
        app_mode = AppMode.value_of(app_model.mode)

        meta: dict = {"tool_icons": {}}

        if app_mode in {AppMode.ADVANCED_CHAT, AppMode.WORKFLOW}:
            workflow = app_model.workflow
            if workflow is None:
                return meta

            graph = workflow.graph_dict
            nodes = graph.get("nodes", [])
            tools = []
            for node in nodes:
                if node.get("data", {}).get("type") == "tool":
                    node_data = node.get("data", {})
                    tools.append(
                        {
                            "provider_type": node_data.get("provider_type"),
                            "provider_id": node_data.get("provider_id"),
                            "tool_name": node_data.get("tool_name"),
                            "tool_parameters": {},
                        }
                    )
        else:
            app_model_config: AppModelConfig | None = app_model.app_model_config

            if not app_model_config:
                return meta

            agent_config = app_model_config.agent_mode_dict

            # get all tools
            tools = agent_config.get("tools", [])

        url_prefix = dify_config.CONSOLE_API_URL + "/console/api/workspaces/current/tool-provider/builtin/"

        for tool in tools:
            keys = list(tool.keys())
            if len(keys) >= 4:
                # current tool standard
                provider_type = tool.get("provider_type", "")
                provider_id = tool.get("provider_id", "")
                tool_name = tool.get("tool_name", "")
                if provider_type == "builtin":
                    meta["tool_icons"][tool_name] = url_prefix + provider_id + "/icon"
                elif provider_type == "api":
                    try:
                        provider: ApiToolProvider | None = (
                            db.session.query(ApiToolProvider).where(ApiToolProvider.id == provider_id).first()
                        )
                        if provider is None:
                            raise ValueError(f"provider not found for tool {tool_name}")
                        meta["tool_icons"][tool_name] = json.loads(provider.icon)
                    except:
                        meta["tool_icons"][tool_name] = {"background": "#252525", "content": "\ud83d\ude01"}

        return meta

    @staticmethod
    def get_app_code_by_id(app_id: str) -> str:
        """
        Get app code by app id
        :param app_id: app id
        :return: app code
        """
        site = db.session.query(Site).where(Site.app_id == app_id).first()
        if not site:
            raise ValueError(f"App with id {app_id} not found")
        return str(site.code)

    @staticmethod
    def get_app_id_by_code(app_code: str) -> str:
        """
        Get app id by app code
        :param app_code: app code
        :return: app id
        """
        site = db.session.query(Site).where(Site.code == app_code).first()
        if not site:
            raise ValueError(f"App with code {app_code} not found")
        return str(site.app_id)
