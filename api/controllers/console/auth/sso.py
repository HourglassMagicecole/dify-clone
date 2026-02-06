import logging
from urllib.parse import unquote

from flask import request
from flask_restx import Resource

from constants.languages import languages
from controllers.console import console_ns
from controllers.console.wraps import setup_required
from libs.helper import extract_remote_ip
from services.account_service import AccountService, TenantService

logger = logging.getLogger(__name__)


@console_ns.route("/auth/sso-login")
class SSOLoginApi(Resource):
    """SSO login for external LMS integration.

    Reads MOAI_LOGIN_EMAIL and MOAI_LOGIN_NAME from request cookies
    set by external LMS (e.g. lcampus.co.kr).
    Creates account if not exists, then issues JWT token pair.
    """

    @setup_required
    def get(self):
        raw_email = request.cookies.get("MOAI_LOGIN_EMAIL")
        raw_name = request.cookies.get("MOAI_LOGIN_NAME")

        if not raw_email:
            return {"result": "fail", "data": "MOAI_LOGIN_EMAIL cookie not found"}, 401

        email = unquote(raw_email)
        name = unquote(raw_name) if raw_name else email

        account = AccountService.get_user_through_email(email)

        if account is None:
            account = AccountService.create_account_and_tenant(
                email=email,
                name=name,
                interface_language=languages[0],
            )
        else:
            if account.name != name:
                account.name = name
                from extensions.ext_database import db

                db.session.commit()

        tenants = TenantService.get_join_tenants(account)
        if len(tenants) == 0:
            return {
                "result": "fail",
                "data": "workspace not found, please contact system admin",
            }, 400

        token_pair = AccountService.login(account=account, ip_address=extract_remote_ip(request))

        logger.info("SSO login successful for %s", email)

        return {"result": "success", "data": token_pair.model_dump()}
