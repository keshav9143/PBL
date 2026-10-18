from flask import Flask, jsonify
from flask_cors import CORS
from flask_jwt_extended import JWTManager
from flask_migrate import Migrate
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy import text

from app.config import Config

db = SQLAlchemy()
migrate = Migrate()
jwt = JWTManager()


def create_app():
    app = Flask(__name__)
    app.config.from_object(Config)

    if not app.config.get("SECRET_KEY"):
        raise RuntimeError("SECRET_KEY is missing from backend/.env")

    if not app.config.get("JWT_SECRET_KEY"):
        raise RuntimeError("JWT_SECRET_KEY is missing from backend/.env")

    if not app.config.get("SQLALCHEMY_DATABASE_URI"):
        raise RuntimeError("DATABASE_URL is missing from backend/.env")

    CORS(app)
    db.init_app(app)
    migrate.init_app(app, db)
    jwt.init_app(app)

    from app import models  # noqa: F401
    from app.api.auth import auth_bp
    from app.api.routes import register_routes

    register_routes(app)
    app.register_blueprint(auth_bp)

    @app.get("/")
    def home():
        return jsonify({
            "application": "CartOS",
            "message": "Welcome to CartOS API",
            "status": "running",
        }), 200

    @app.get("/api/health")
    def health_check():
        return jsonify({
            "status": "healthy",
            "application": "CartOS",
            "message": "Backend is running",
        }), 200

    @app.get("/api/health/database")
    def database_health():
        try:
            with db.engine.connect() as connection:
                connection.execute(text("SELECT 1"))

            return jsonify({
                "status": "healthy",
                "database": "MySQL",
                "message": "Database connection successful",
            }), 200
        except Exception:
            app.logger.exception("Database health check failed")
            return jsonify({
                "status": "unhealthy",
                "database": "MySQL",
                "message": "Database connection failed",
            }), 503

    return app
