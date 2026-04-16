"""JWT authentication endpoints."""
from __future__ import annotations

from datetime import datetime, timezone

from flask import request
from flask_jwt_extended import (
    create_access_token,
    create_refresh_token,
    get_jwt_identity,
    jwt_required,
)
from flask_restx import Namespace, Resource

from extensions import db
from database.models import User

auth_ns = Namespace("auth", description="Authentication")


@auth_ns.route("/register")
class Register(Resource):
    def post(self):
        data = request.get_json() or {}
        username = data.get("username", "").strip()
        email = data.get("email", "").strip().lower()
        password = data.get("password", "")
        role = data.get("role", "viewer")

        if not username or not email or not password:
            return {"success": False, "error": "username, email, password required", "data": None}, 400
        if len(password) < 8:
            return {"success": False, "error": "Password must be ≥8 characters", "data": None}, 400
        if User.query.filter((User.username == username) | (User.email == email)).first():
            return {"success": False, "error": "Username or email already exists", "data": None}, 409

        # Only admins can create admin accounts
        if role == "admin":
            role = "viewer"

        user = User(username=username, email=email, role=role)
        user.set_password(password)
        db.session.add(user)
        db.session.commit()

        return {
            "success": True,
            "data": user.to_dict(),
            "error": None,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }, 201


@auth_ns.route("/login")
class Login(Resource):
    def post(self):
        data = request.get_json() or {}
        username = data.get("username", "").strip()
        password = data.get("password", "")

        user = User.query.filter_by(username=username, is_active=True).first()
        if not user or not user.check_password(password):
            return {"success": False, "error": "Invalid credentials", "data": None}, 401

        user.last_login = datetime.now(timezone.utc)
        db.session.commit()

        access_token = create_access_token(identity=user.id)
        refresh_token = create_refresh_token(identity=user.id)

        return {
            "success": True,
            "data": {
                "access_token": access_token,
                "refresh_token": refresh_token,
                "user": user.to_dict(),
            },
            "error": None,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }


@auth_ns.route("/refresh")
class Refresh(Resource):
    @jwt_required(refresh=True)
    def post(self):
        user_id = get_jwt_identity()
        access_token = create_access_token(identity=user_id)
        return {
            "success": True,
            "data": {"access_token": access_token},
            "error": None,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }


@auth_ns.route("/me")
class Me(Resource):
    def get(self):
        try:
            from flask_jwt_extended import verify_jwt_in_request
            verify_jwt_in_request()
            user = User.query.get(get_jwt_identity())
            if not user:
                return {"success": False, "error": "User not found", "data": None}, 404
            return {
                "success": True,
                "data": user.to_dict(),
                "error": None,
                "timestamp": datetime.now(timezone.utc).isoformat(),
            }
        except Exception:
            return {"success": False, "error": "Unauthorized", "data": None}, 401
