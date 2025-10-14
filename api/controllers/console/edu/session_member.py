"""Education session member management API endpoints."""

from flask import Blueprint, jsonify, request
from flask_login import login_required

from controllers.console.edu import require_admin
from extensions.ext_database import db
from models.education import MemberStatus
from services.edu_session_member_service import EduSessionMemberService

bp = Blueprint("edu_session_member", __name__, url_prefix="/console/api/edu/sessions")


@bp.route("/<session_id>/members", methods=["GET"])
@login_required
@require_admin
def get_session_members(session_id: str):
    """
    Get all members of a session.

    Query Parameters:
        status: Filter by status (optional, default: "active")

    Returns:
        200: {
          "result": "success",
          "data": {
            "members": [
              {
                "id": "member-uuid",
                "account_id": "account-uuid",
                "account_name": "John Doe",
                "status": "active",
                "joined_at": "2025-10-13T10:00:00Z"
              }
            ],
            "total": 10
          }
        }
        500: Server error
    """
    try:
        status = request.args.get("status", MemberStatus.ACTIVE.value)

        members = EduSessionMemberService.get_session_members(
            session_id=session_id,
            db_session=db.session,  # type: ignore[arg-type]
            status=status,
        )

        # Serialize members with account information
        members_data = [
            {
                "id": member.id,
                "account_id": member.account_id,
                "account_name": member.account.name if member.account else None,
                "status": member.status,
                "joined_at": member.joined_at.isoformat() if member.joined_at else None,
            }
            for member in members
        ]

        return jsonify({"result": "success", "data": {"members": members_data, "total": len(members_data)}}), 200

    except Exception as e:
        return jsonify({"result": "fail", "message": str(e)}), 500


@bp.route("/<session_id>/members", methods=["POST"])
@login_required
@require_admin
def add_session_member(session_id: str):
    """
    Add a member to a session.

    Request Body:
        {
          "account_id": "user-uuid"
        }

    Returns:
        201: {
          "result": "success",
          "data": {
            "member": {
              "id": "member-uuid",
              "account_id": "account-uuid",
              "status": "active",
              "joined_at": "2025-10-13T10:00:00Z"
            }
          }
        }
        400: account_id missing
        500: Server error
    """
    try:
        data = request.get_json()

        if not data or "account_id" not in data:
            return jsonify({"result": "fail", "message": "account_id is required"}), 400

        account_id = data["account_id"]

        member = EduSessionMemberService.add_member(
            session_id=session_id,
            account_id=account_id,
            db_session=db.session,  # type: ignore[arg-type]
        )

        member_data = {
            "id": member.id,
            "account_id": member.account_id,
            "account_name": member.account.name if member.account else None,
            "status": member.status,
            "joined_at": member.joined_at.isoformat() if member.joined_at else None,
        }

        return jsonify({"result": "success", "data": {"member": member_data}}), 201

    except Exception as e:
        return jsonify({"result": "fail", "message": str(e)}), 500


@bp.route("/<session_id>/members/<account_id>", methods=["DELETE"])
@login_required
@require_admin
def remove_session_member(session_id: str, account_id: str):
    """
    Remove a member from a session (soft delete).

    Returns:
        200: {
          "result": "success",
          "message": "Member removed"
        }
        404: Member not found
        500: Server error
    """
    try:
        success = EduSessionMemberService.remove_member(
            session_id=session_id,
            account_id=account_id,
            db_session=db.session,  # type: ignore[arg-type]
        )

        if not success:
            return jsonify({"result": "fail", "message": "Member not found"}), 404

        return jsonify({"result": "success", "message": "Member removed"}), 200

    except Exception as e:
        return jsonify({"result": "fail", "message": str(e)}), 500
