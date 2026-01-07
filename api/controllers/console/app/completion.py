import logging

from flask import request
from flask_restx import Resource, fields, reqparse
from werkzeug.exceptions import Forbidden, InternalServerError, NotFound

import services
from controllers.console import api, console_ns
from controllers.console.app.error import (
    AppUnavailableError,
    CompletionRequestError,
    ConversationCompletedError,
    EducationQuotaExceededError,
    ProviderModelCurrentlyNotSupportError,
    ProviderNotInitializeError,
    ProviderQuotaExceededError,
)
from controllers.console.app.wraps import get_app_model
from controllers.console.wraps import account_initialization_required, setup_required
from controllers.web.error import InvokeRateLimitError as InvokeRateLimitHttpError
from core.app.apps.base_app_queue_manager import AppQueueManager
from core.app.entities.app_invoke_entities import InvokeFrom
from core.errors.error import (
    ModelCurrentlyNotSupportError,
    ProviderTokenNotInitError,
    QuotaExceededError,
)
from core.helper.trace_id_helper import get_external_trace_id
from core.model_runtime.errors.invoke import InvokeError
from libs import helper
from libs.helper import uuid_value
from libs.login import current_user, login_required
from models import Account
from models.model import AppMode, EndUser
from services.app_generate_service import AppGenerateService
from services.errors.llm import InvokeRateLimitError

logger = logging.getLogger(__name__)


# define completion message api for user
@console_ns.route("/apps/<uuid:app_id>/completion-messages")
class CompletionMessageApi(Resource):
    @api.doc("create_completion_message")
    @api.doc(description="Generate completion message for debugging")
    @api.doc(params={"app_id": "Application ID"})
    @api.expect(
        api.model(
            "CompletionMessageRequest",
            {
                "inputs": fields.Raw(required=True, description="Input variables"),
                "query": fields.String(description="Query text", default=""),
                "files": fields.List(fields.Raw(), description="Uploaded files"),
                "model_config": fields.Raw(required=True, description="Model configuration"),
                "response_mode": fields.String(enum=["blocking", "streaming"], description="Response mode"),
                "retriever_from": fields.String(default="dev", description="Retriever source"),
            },
        )
    )
    @api.response(200, "Completion generated successfully")
    @api.response(400, "Invalid request parameters")
    @api.response(404, "App not found")
    @setup_required
    @login_required
    @account_initialization_required
    @get_app_model(mode=AppMode.COMPLETION)
    def post(self, app_model):
        parser = reqparse.RequestParser()
        parser.add_argument("inputs", type=dict, required=True, location="json")
        parser.add_argument("query", type=str, location="json", default="")
        parser.add_argument("files", type=list, required=False, location="json")
        parser.add_argument("model_config", type=dict, required=True, location="json")
        parser.add_argument("response_mode", type=str, choices=["blocking", "streaming"], location="json")
        parser.add_argument("retriever_from", type=str, required=False, default="dev", location="json")
        args = parser.parse_args()

        streaming = args["response_mode"] != "blocking"
        args["auto_generate_name"] = False

        # Check education quota before LLM call
        _check_education_quota(app_model, current_user, args)

        try:
            if not isinstance(current_user, Account):
                raise ValueError("current_user must be an Account or EndUser instance")
            response = AppGenerateService.generate(
                app_model=app_model, user=current_user, args=args, invoke_from=InvokeFrom.DEBUGGER, streaming=streaming
            )

            return helper.compact_generate_response(response)
        except services.errors.conversation.ConversationNotExistsError:
            raise NotFound("Conversation Not Exists.")
        except services.errors.conversation.ConversationCompletedError:
            raise ConversationCompletedError()
        except services.errors.app_model_config.AppModelConfigBrokenError:
            logger.exception("App model config broken.")
            raise AppUnavailableError()
        except ProviderTokenNotInitError as ex:
            raise ProviderNotInitializeError(ex.description)
        except QuotaExceededError:
            raise ProviderQuotaExceededError()
        except ModelCurrentlyNotSupportError:
            raise ProviderModelCurrentlyNotSupportError()
        except InvokeError as e:
            raise CompletionRequestError(e.description)
        except ValueError as e:
            raise e
        except Exception as e:
            logger.exception("internal server error.")
            raise InternalServerError()


@console_ns.route("/apps/<uuid:app_id>/completion-messages/<string:task_id>/stop")
class CompletionMessageStopApi(Resource):
    @api.doc("stop_completion_message")
    @api.doc(description="Stop a running completion message generation")
    @api.doc(params={"app_id": "Application ID", "task_id": "Task ID to stop"})
    @api.response(200, "Task stopped successfully")
    @setup_required
    @login_required
    @account_initialization_required
    @get_app_model(mode=AppMode.COMPLETION)
    def post(self, app_model, task_id):
        if not isinstance(current_user, Account):
            raise ValueError("current_user must be an Account instance")
        AppQueueManager.set_stop_flag(task_id, InvokeFrom.DEBUGGER, current_user.id)

        return {"result": "success"}, 200


@console_ns.route("/apps/<uuid:app_id>/chat-messages")
class ChatMessageApi(Resource):
    @api.doc("create_chat_message")
    @api.doc(description="Generate chat message for debugging")
    @api.doc(params={"app_id": "Application ID"})
    @api.expect(
        api.model(
            "ChatMessageRequest",
            {
                "inputs": fields.Raw(required=True, description="Input variables"),
                "query": fields.String(required=True, description="User query"),
                "files": fields.List(fields.Raw(), description="Uploaded files"),
                "model_config": fields.Raw(required=True, description="Model configuration"),
                "conversation_id": fields.String(description="Conversation ID"),
                "parent_message_id": fields.String(description="Parent message ID"),
                "response_mode": fields.String(enum=["blocking", "streaming"], description="Response mode"),
                "retriever_from": fields.String(default="dev", description="Retriever source"),
            },
        )
    )
    @api.response(200, "Chat message generated successfully")
    @api.response(400, "Invalid request parameters")
    @api.response(404, "App or conversation not found")
    @setup_required
    @login_required
    @account_initialization_required
    @get_app_model(mode=[AppMode.CHAT, AppMode.AGENT_CHAT])
    def post(self, app_model):
        if not isinstance(current_user, Account):
            raise Forbidden()

        # Note: Removed has_edit_permission check to allow Student role to use chat
        # Students need to interact with Agents for educational purposes

        parser = reqparse.RequestParser()
        parser.add_argument("inputs", type=dict, required=True, location="json")
        parser.add_argument("query", type=str, required=True, location="json")
        parser.add_argument("files", type=list, required=False, location="json")
        parser.add_argument("model_config", type=dict, required=True, location="json")
        parser.add_argument("conversation_id", type=uuid_value, location="json")
        parser.add_argument("parent_message_id", type=uuid_value, required=False, location="json")
        parser.add_argument("response_mode", type=str, choices=["blocking", "streaming"], location="json")
        parser.add_argument("retriever_from", type=str, required=False, default="dev", location="json")
        args = parser.parse_args()

        streaming = args["response_mode"] != "blocking"
        args["auto_generate_name"] = False

        external_trace_id = get_external_trace_id(request)
        if external_trace_id:
            args["external_trace_id"] = external_trace_id

        # Check education quota before LLM call
        _check_education_quota(app_model, current_user, args)

        try:
            if not isinstance(current_user, Account):
                raise ValueError("current_user must be an Account or EndUser instance")
            response = AppGenerateService.generate(
                app_model=app_model, user=current_user, args=args, invoke_from=InvokeFrom.DEBUGGER, streaming=streaming
            )

            return helper.compact_generate_response(response)
        except services.errors.conversation.ConversationNotExistsError:
            raise NotFound("Conversation Not Exists.")
        except services.errors.conversation.ConversationCompletedError:
            raise ConversationCompletedError()
        except Forbidden:
            # Re-raise Forbidden as-is (conversation permission check)
            raise
        except services.errors.app_model_config.AppModelConfigBrokenError:
            logger.exception("App model config broken.")
            raise AppUnavailableError()
        except ProviderTokenNotInitError as ex:
            raise ProviderNotInitializeError(ex.description)
        except QuotaExceededError:
            raise ProviderQuotaExceededError()
        except ModelCurrentlyNotSupportError:
            raise ProviderModelCurrentlyNotSupportError()
        except InvokeRateLimitError as ex:
            raise InvokeRateLimitHttpError(ex.description)
        except InvokeError as e:
            raise CompletionRequestError(e.description)
        except ValueError as e:
            raise e
        except Exception as e:
            logger.exception("internal server error.")
            raise InternalServerError()


@console_ns.route("/apps/<uuid:app_id>/chat-messages/<string:task_id>/stop")
class ChatMessageStopApi(Resource):
    @api.doc("stop_chat_message")
    @api.doc(description="Stop a running chat message generation")
    @api.doc(params={"app_id": "Application ID", "task_id": "Task ID to stop"})
    @api.response(200, "Task stopped successfully")
    @setup_required
    @login_required
    @account_initialization_required
    @get_app_model(mode=[AppMode.CHAT, AppMode.AGENT_CHAT, AppMode.ADVANCED_CHAT])
    def post(self, app_model, task_id):
        if not isinstance(current_user, Account):
            raise ValueError("current_user must be an Account instance")
        AppQueueManager.set_stop_flag(task_id, InvokeFrom.DEBUGGER, current_user.id)

        return {"result": "success"}, 200


def _check_education_quota(app_model, user: Account | EndUser | None, args: dict) -> None:
    """
    Check education quota before LLM/image generation call.

    Args:
        app_model: The application model
        user: Current user account
        args: Request arguments containing model_config

    Raises:
        EducationQuotaExceededError: If quota is exceeded
    """
    # Skip if user is not an Account (EndUser or None)
    if not isinstance(user, Account):
        return

    from extensions.ext_database import db
    from models.education import SessionResourceTag
    from services.education_management.quota_enforcement_service import QuotaEnforcementService

    # Get session_id from SessionResourceTag
    resource_tag = (
        db.session.query(SessionResourceTag)
        .filter(
            SessionResourceTag.resource_type == "app",
            SessionResourceTag.resource_id == str(app_model.id),
        )
        .first()
    )

    if not resource_tag:
        # No session tag means no quota enforcement
        return

    session_id = str(resource_tag.session_id)
    tenant_id = str(app_model.tenant_id)
    account_id = str(user.id)

    # Extract model provider from model_config or app_model
    model_config = args.get("model_config", {})
    model_info = model_config.get("model", {})
    model_provider = model_info.get("provider", "")

    # If provider not in args, try app_model's config
    if not model_provider:
        app_config = app_model.app_model_config
        if app_config:
            # Try model_dict first (Agent mode stores provider in model JSON field)
            model_dict = app_config.model_dict
            model_provider = model_dict.get("provider", "") or app_config.provider or ""

    # Simplify provider name (e.g., "langgenius/openai/openai" -> "openai")
    if model_provider and "/" in model_provider:
        model_provider = model_provider.split("/")[-1]

    # If provider still unknown, skip quota check (can't enforce without knowing provider)
    if not model_provider:
        logger.warning("Could not determine model provider, skipping quota check")
        return

    logger.info("Quota check using provider: %s", model_provider)

    # Check quota
    result = QuotaEnforcementService.check_quota(
        db_session=db.session,  # type: ignore[arg-type]
        tenant_id=tenant_id,
        session_id=session_id,
        account_id=account_id,
        model_provider=model_provider,
    )

    logger.info(
        "Quota check result: session=%s, account=%s, provider=%s, allowed=%s, blocked_by=%s, "
        "session_usage=%s, session_limit=%s, user_usage=%s, user_limit=%s",
        session_id,
        account_id,
        model_provider,
        result.allowed,
        result.blocked_by,
        result.session_usage,
        result.session_limit,
        result.user_usage,
        result.user_limit,
    )

    if not result.allowed:
        logger.warning(
            "Education quota exceeded: session=%s, account=%s, provider=%s, blocked_by=%s",
            session_id,
            account_id,
            model_provider,
            result.blocked_by,
        )
        raise EducationQuotaExceededError(result.message or "Usage quota exceeded.")
