import re

from flask import Blueprint, current_app, jsonify, request
from flask_jwt_extended import (
    create_access_token,
    get_jwt_identity,
    jwt_required,
)
from werkzeug.security import check_password_hash, generate_password_hash

from app import db
from app.models import User

auth_bp = Blueprint("auth", __name__, url_prefix="/api/auth")


def public_user(user):
    return {
        "id": user.id,
        "name": user.name,
        "email": user.email,
        "role": user.role,
    }


@auth_bp.post("/register")
def register():
    data = request.get_json(silent=True)

    if not isinstance(data, dict):
        return jsonify({"error": "Send a valid JSON object"}), 400

    name = data.get("name")
    email = data.get("email")
    password = data.get("password")

    if not all(isinstance(value, str) for value in (name, email, password)):
        return jsonify({"error": "Name, email, and password are required"}), 400

    name = name.strip()
    email = email.strip().lower()

    if not name or len(name) > 120:
        return jsonify({"error": "Name must contain 1 to 120 characters"}), 400

    if len(email) > 255 or not re.fullmatch(
        r"[^@\s]+@[^@\s]+\.[^@\s]+", email
    ):
        return jsonify({"error": "Enter a valid email address"}), 400

    if len(password) < 8 or len(password) > 128:
        return jsonify({"error": "Password must contain 8 to 128 characters"}), 400

    if User.query.filter_by(email=email).first():
        return jsonify({"error": "An account with this email already exists"}), 409

    user = User(
        name=name,
        email=email,
        password_hash=generate_password_hash(password),
        role="customer",
        is_active=True,
    )

    try:
        db.session.add(user)
        db.session.commit()
    except Exception:
        db.session.rollback()
        current_app.logger.exception("Registration failed")
        return jsonify({"error": "Could not create account"}), 500

    return jsonify({
        "message": "Account created successfully",
        "user": public_user(user),
    }), 201


@auth_bp.post("/login")
def login():
    data = request.get_json(silent=True)

    if not isinstance(data, dict):
        return jsonify({"error": "Send a valid JSON object"}), 400

    email = data.get("email")
    password = data.get("password")

    if not isinstance(email, str) or not isinstance(password, str):
        return jsonify({"error": "Email and password are required"}), 400

    user = User.query.filter_by(email=email.strip().lower()).first()

    if (
        user is None
        or not user.is_active
        or not check_password_hash(user.password_hash, password)
    ):
        return jsonify({"error": "Invalid email or password"}), 401

    access_token = create_access_token(identity=str(user.id))

    return jsonify({
        "message": "Login successful",
        "access_token": access_token,
        "user": public_user(user),
    }), 200


@auth_bp.get("/me")
@jwt_required()
def me():
    user_id = get_jwt_identity()

    try:
        user = db.session.get(User, int(user_id))
    except (TypeError, ValueError):
        user = None

    if user is None or not user.is_active:
        return jsonify({"error": "Account not found or inactive"}), 401

    return jsonify({"user": public_user(user)}), 200


@auth_bp.post("/logout")
@jwt_required()
def logout():
    return jsonify({
        "message": "Logout successful. Remove the access token from the client."
    }), 200
