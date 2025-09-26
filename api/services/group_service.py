"""
Group management service for educational platform.
"""

from typing import Optional

from sqlalchemy.exc import IntegrityError

from extensions.ext_database import db
from models.education import UserEducationRole
from models.model import Account


class GroupService:
    """Service for managing educational groups and user assignments."""

    @staticmethod
    def create_group(name: str, description: Optional[str] = None, created_by: Optional[str] = None) -> dict:
        """
        Create a new educational group.

        Args:
            name: Group name
            description: Optional group description
            created_by: User ID who created the group

        Returns:
            dict: Group information

        Raises:
            ValueError: If group name already exists
        """
        # For now, we'll use a simple structure until we create a dedicated Group model
        group_data = {
            "id": f"group_{hash(name)}",
            "name": name,
            "description": description,
            "created_by": created_by,
            "members": [],
            "created_at": db.func.now(),
        }

        return group_data

    @staticmethod
    def get_groups(limit: int = 20, offset: int = 0) -> list[dict]:
        """
        Get list of groups.

        Args:
            limit: Number of groups to return
            offset: Offset for pagination

        Returns:
            List[dict]: List of groups
        """
        # This is a placeholder implementation
        # In a real implementation, you would query from a groups table
        return []

    @staticmethod
    def get_group_by_id(group_id: str) -> Optional[dict]:
        """
        Get group by ID.

        Args:
            group_id: Group ID

        Returns:
            Optional[dict]: Group data if found
        """
        # Placeholder implementation
        return None

    @staticmethod
    def add_user_to_group(group_id: str, user_id: str, role: str = "member") -> bool:
        """
        Add user to group with specified role.

        Args:
            group_id: Group ID
            user_id: User ID to add
            role: Role in the group (member, admin, etc.)

        Returns:
            bool: Success status
        """
        try:
            # Check if user exists
            user = db.session.query(Account).filter_by(id=user_id).first()
            if not user:
                raise ValueError(f"User {user_id} not found")

            # For now, create a UserEducationRole entry
            user_role = UserEducationRole(user_id=user_id, role=role, scope_type="group", scope_id=group_id)

            db.session.add(user_role)
            db.session.commit()
            return True

        except IntegrityError:
            db.session.rollback()
            raise ValueError(f"User {user_id} already in group {group_id}")
        except Exception as e:
            db.session.rollback()
            raise e

    @staticmethod
    def remove_user_from_group(group_id: str, user_id: str) -> bool:
        """
        Remove user from group.

        Args:
            group_id: Group ID
            user_id: User ID to remove

        Returns:
            bool: Success status
        """
        try:
            role = (
                db.session.query(UserEducationRole)
                .filter_by(user_id=user_id, scope_type="group", scope_id=group_id)
                .first()
            )

            if role:
                db.session.delete(role)
                db.session.commit()
                return True
            return False

        except Exception as e:
            db.session.rollback()
            raise e

    @staticmethod
    def get_group_members(group_id: str) -> list[dict]:
        """
        Get all members of a group.

        Args:
            group_id: Group ID

        Returns:
            List[dict]: List of group members with their roles
        """
        try:
            roles = (
                db.session.query(UserEducationRole, Account)
                .join(Account, UserEducationRole.user_id == Account.id)
                .filter(UserEducationRole.scope_type == "group", UserEducationRole.scope_id == group_id)
                .all()
            )

            members = []
            for role, user in roles:
                members.append(
                    {
                        "user_id": user.id,
                        "name": user.name,
                        "email": user.email,
                        "role": role.role,
                        "joined_at": role.created_at,
                    }
                )

            return members

        except Exception as e:
            raise e

    @staticmethod
    def update_group(group_id: str, **kwargs) -> bool:
        """
        Update group information.

        Args:
            group_id: Group ID
            **kwargs: Fields to update

        Returns:
            bool: Success status
        """
        # Placeholder implementation
        return True

    @staticmethod
    def delete_group(group_id: str) -> bool:
        """
        Delete a group and all associated roles.

        Args:
            group_id: Group ID to delete

        Returns:
            bool: Success status
        """
        try:
            # Remove all user roles for this group
            db.session.query(UserEducationRole).filter_by(scope_type="group", scope_id=group_id).delete()

            db.session.commit()
            return True

        except Exception as e:
            db.session.rollback()
            raise e
