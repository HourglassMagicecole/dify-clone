"""
User management API endpoints for educational platform.
"""

from flask import request
from flask_restx import Resource, fields

from controllers.edu import api, edu_ns
from extensions.ext_database import db
from models.model import Account

api.add_namespace(edu_ns)

# Define models for Swagger documentation
user_model = edu_ns.model(
    "User",
    {
        "id": fields.String(required=True, description="User ID"),
        "name": fields.String(required=True, description="User name"),
        "email": fields.String(required=True, description="User email"),
        "created_at": fields.DateTime(description="Creation timestamp"),
    },
)

user_create_model = edu_ns.model(
    "UserCreate",
    {
        "name": fields.String(required=True, description="User name"),
        "email": fields.String(required=True, description="User email"),
        "password": fields.String(required=True, description="User password"),
    },
)

user_list_model = edu_ns.model(
    "UserList",
    {
        "users": fields.List(fields.Nested(user_model)),
        "total": fields.Integer(description="Total number of users"),
        "page": fields.Integer(description="Current page"),
        "per_page": fields.Integer(description="Items per page"),
    },
)


@edu_ns.route("/users")
class UsersAPI(Resource):
    @edu_ns.doc("list_users", description="Get list of users")
    @edu_ns.marshal_with(user_list_model)
    def get(self):
        """Get list of users with pagination"""
        try:
            page = request.args.get("page", 1, type=int)
            per_page = min(request.args.get("per_page", 20, type=int), 100)
            search = request.args.get("search", "").strip()

            query = db.session.query(Account)

            if search:
                query = query.filter(db.or_(Account.name.ilike(f"%{search}%"), Account.email.ilike(f"%{search}%")))

            total = query.count()
            users = query.offset((page - 1) * per_page).limit(per_page).all()

            return {
                "users": [
                    {
                        "id": user.id,
                        "name": user.name,
                        "email": user.email,
                        "created_at": user.created_at.isoformat() if user.created_at else None,
                    }
                    for user in users
                ],
                "total": total,
                "page": page,
                "per_page": per_page,
            }

        except Exception as e:
            return {"error": str(e)}, 500

    @edu_ns.doc("create_user", description="Create a new user")
    @edu_ns.expect(user_create_model)
    @edu_ns.marshal_with(user_model)
    def post(self):
        """Create a new user"""
        try:
            data = request.get_json()

            # Validate required fields
            required_fields = ["name", "email", "password"]
            for field in required_fields:
                if not data.get(field):
                    return {"error": f"Field {field} is required"}, 400

            # Check if email already exists
            existing_user = db.session.query(Account).filter_by(email=data["email"]).first()
            if existing_user:
                return {"error": "User with this email already exists"}, 409

            # Create new user
            new_user = Account(
                name=data["name"],
                email=data["email"],
            )
            # Note: In a real implementation, you would hash the password
            # and handle user creation through proper service layer

            db.session.add(new_user)
            db.session.commit()

            return {
                "id": new_user.id,
                "name": new_user.name,
                "email": new_user.email,
                "created_at": new_user.created_at.isoformat() if new_user.created_at else None,
            }, 201

        except Exception as e:
            db.session.rollback()
            return {"error": str(e)}, 500


@edu_ns.route("/users/<string:user_id>")
class UserAPI(Resource):
    @edu_ns.doc("get_user", description="Get user by ID")
    @edu_ns.marshal_with(user_model)
    def get(self, user_id):
        """Get user by ID"""
        try:
            user = db.session.query(Account).filter_by(id=user_id).first()
            if not user:
                return {"error": "User not found"}, 404

            return {
                "id": user.id,
                "name": user.name,
                "email": user.email,
                "created_at": user.created_at.isoformat() if user.created_at else None,
            }

        except Exception as e:
            return {"error": str(e)}, 500

    @edu_ns.doc("update_user", description="Update user information")
    @edu_ns.expect(user_create_model)
    @edu_ns.marshal_with(user_model)
    def put(self, user_id):
        """Update user information"""
        try:
            user = db.session.query(Account).filter_by(id=user_id).first()
            if not user:
                return {"error": "User not found"}, 404

            data = request.get_json()

            # Update fields if provided
            if data.get("name"):
                user.name = data["name"]
            if data.get("email"):
                # Check if new email already exists for another user
                existing = (
                    db.session.query(Account).filter(Account.email == data["email"], Account.id != user_id).first()
                )
                if existing:
                    return {"error": "Email already in use"}, 409
                user.email = data["email"]

            db.session.commit()

            return {
                "id": user.id,
                "name": user.name,
                "email": user.email,
                "created_at": user.created_at.isoformat() if user.created_at else None,
            }

        except Exception as e:
            db.session.rollback()
            return {"error": str(e)}, 500

    @edu_ns.doc("delete_user", description="Delete user")
    def delete(self, user_id):
        """Delete user"""
        try:
            user = db.session.query(Account).filter_by(id=user_id).first()
            if not user:
                return {"error": "User not found"}, 404

            # In a real implementation, you might want to soft-delete
            # or handle cascading deletions properly
            db.session.delete(user)
            db.session.commit()

            return {"message": "User deleted successfully"}

        except Exception as e:
            db.session.rollback()
            return {"error": str(e)}, 500


@edu_ns.route("/users/bulk")
class UserBulkAPI(Resource):
    @edu_ns.doc("bulk_create_users", description="Create multiple users from CSV data")
    def post(self):
        """Create users in bulk from CSV data"""
        try:
            data = request.get_json()
            users_data = data.get("users", [])

            if not users_data:
                return {"error": "No users data provided"}, 400

            created_users = []
            errors = []

            for idx, user_data in enumerate(users_data):
                try:
                    # Validate required fields
                    if not user_data.get("name") or not user_data.get("email"):
                        errors.append(f"Row {idx + 1}: Name and email are required")
                        continue

                    # Check if email already exists
                    if db.session.query(Account).filter_by(email=user_data["email"]).first():
                        errors.append(f"Row {idx + 1}: Email {user_data['email']} already exists")
                        continue

                    new_user = Account(name=user_data["name"], email=user_data["email"])

                    db.session.add(new_user)
                    created_users.append({"name": new_user.name, "email": new_user.email})

                except Exception as e:
                    errors.append(f"Row {idx + 1}: {str(e)}")

            if created_users:
                db.session.commit()

            return {"created_count": len(created_users), "created_users": created_users, "errors": errors}

        except Exception as e:
            db.session.rollback()
            return {"error": str(e)}, 500
