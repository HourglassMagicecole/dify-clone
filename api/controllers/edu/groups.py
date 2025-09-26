"""
Group management API endpoints for educational platform.
"""

from flask import request
from flask_restx import Resource, fields

from controllers.edu import api, edu_ns
from services.group_service import GroupService

api.add_namespace(edu_ns)

# Define models for Swagger documentation
group_model = edu_ns.model(
    "Group",
    {
        "id": fields.String(required=True, description="Group ID"),
        "name": fields.String(required=True, description="Group name"),
        "description": fields.String(description="Group description"),
        "created_by": fields.String(description="Creator user ID"),
        "created_at": fields.DateTime(description="Creation timestamp"),
    },
)

group_create_model = edu_ns.model(
    "GroupCreate",
    {
        "name": fields.String(required=True, description="Group name"),
        "description": fields.String(description="Group description"),
    },
)

group_member_model = edu_ns.model(
    "GroupMember",
    {
        "user_id": fields.String(required=True, description="User ID"),
        "name": fields.String(required=True, description="User name"),
        "email": fields.String(required=True, description="User email"),
        "role": fields.String(required=True, description="Role in group"),
        "joined_at": fields.DateTime(description="Join timestamp"),
    },
)

group_add_member_model = edu_ns.model(
    "GroupAddMember",
    {
        "user_id": fields.String(required=True, description="User ID to add"),
        "role": fields.String(description="Role in group (default: member)"),
    },
)


@edu_ns.route("/groups")
class GroupsAPI(Resource):
    @edu_ns.doc("list_groups", description="Get list of groups")
    @edu_ns.marshal_list_with(group_model)
    def get(self):
        """Get list of groups with pagination"""
        try:
            page = request.args.get("page", 1, type=int)
            per_page = min(request.args.get("per_page", 20, type=int), 100)

            offset = (page - 1) * per_page
            groups = GroupService.get_groups(limit=per_page, offset=offset)

            return groups

        except Exception as e:
            return {"error": str(e)}, 500

    @edu_ns.doc("create_group", description="Create a new group")
    @edu_ns.expect(group_create_model)
    @edu_ns.marshal_with(group_model)
    def post(self):
        """Create a new group"""
        try:
            data = request.get_json()

            if not data.get("name"):
                return {"error": "Group name is required"}, 400

            # For now, we don't have authentication, so created_by is None
            # In a real implementation, you would get this from the authenticated user
            created_by = request.headers.get("X-User-ID")  # Mock authentication

            group = GroupService.create_group(
                name=data["name"], description=data.get("description"), created_by=created_by
            )

            return group, 201

        except ValueError as e:
            return {"error": str(e)}, 409
        except Exception as e:
            return {"error": str(e)}, 500


@edu_ns.route("/groups/<string:group_id>")
class GroupAPI(Resource):
    @edu_ns.doc("get_group", description="Get group by ID")
    @edu_ns.marshal_with(group_model)
    def get(self, group_id):
        """Get group by ID"""
        try:
            group = GroupService.get_group_by_id(group_id)
            if not group:
                return {"error": "Group not found"}, 404

            return group

        except Exception as e:
            return {"error": str(e)}, 500

    @edu_ns.doc("update_group", description="Update group information")
    @edu_ns.expect(group_create_model)
    @edu_ns.marshal_with(group_model)
    def put(self, group_id):
        """Update group information"""
        try:
            data = request.get_json()

            success = GroupService.update_group(group_id, **data)
            if not success:
                return {"error": "Group not found"}, 404

            group = GroupService.get_group_by_id(group_id)
            return group

        except Exception as e:
            return {"error": str(e)}, 500

    @edu_ns.doc("delete_group", description="Delete group")
    def delete(self, group_id):
        """Delete group"""
        try:
            success = GroupService.delete_group(group_id)
            if not success:
                return {"error": "Group not found"}, 404

            return {"message": "Group deleted successfully"}

        except Exception as e:
            return {"error": str(e)}, 500


@edu_ns.route("/groups/<string:group_id>/members")
class GroupMembersAPI(Resource):
    @edu_ns.doc("get_group_members", description="Get group members")
    @edu_ns.marshal_list_with(group_member_model)
    def get(self, group_id):
        """Get all members of a group"""
        try:
            members = GroupService.get_group_members(group_id)
            return members

        except Exception as e:
            return {"error": str(e)}, 500

    @edu_ns.doc("add_group_member", description="Add member to group")
    @edu_ns.expect(group_add_member_model)
    def post(self, group_id):
        """Add a member to the group"""
        try:
            data = request.get_json()

            if not data.get("user_id"):
                return {"error": "User ID is required"}, 400

            role = data.get("role", "member")

            success = GroupService.add_user_to_group(group_id, data["user_id"], role)
            if success:
                return {"message": "User added to group successfully"}, 201
            else:
                return {"error": "Failed to add user to group"}, 400

        except ValueError as e:
            return {"error": str(e)}, 409
        except Exception as e:
            return {"error": str(e)}, 500


@edu_ns.route("/groups/<string:group_id>/members/<string:user_id>")
class GroupMemberAPI(Resource):
    @edu_ns.doc("remove_group_member", description="Remove member from group")
    def delete(self, group_id, user_id):
        """Remove a member from the group"""
        try:
            success = GroupService.remove_user_from_group(group_id, user_id)
            if success:
                return {"message": "User removed from group successfully"}
            else:
                return {"error": "User not found in group"}, 404

        except Exception as e:
            return {"error": str(e)}, 500
