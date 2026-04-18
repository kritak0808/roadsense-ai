"""
Road Damage Ultra — Flask application factory.
Extensions live in extensions.py to avoid circular imports with database/models.py.
"""
import logging
import os
from typing import Any

from dotenv import load_dotenv
load_dotenv()  # Load .env before anything else

from flask import Flask, jsonify
from flask_cors import CORS
from flask_restx import Api

from config import get_config
from extensions import db, bcrypt, jwt, mail, socketio, limiter

# ── Structured JSON logging ───────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format='{"time":"%(asctime)s","level":"%(levelname)s","module":"%(module)s","msg":"%(message)s"}',
)
logger = logging.getLogger(__name__)


def create_app(config_override: Any = None) -> Flask:
    """Application factory."""
    app = Flask(__name__)
    cfg = config_override or get_config()
    app.config.from_object(cfg)

    os.makedirs(app.config["UPLOAD_FOLDER"], exist_ok=True)
    os.makedirs(app.config["WEIGHTS_DIR"], exist_ok=True)
    os.makedirs("logs", exist_ok=True)

    # ── Extensions ────────────────────────────────────────────────────────────
    db.init_app(app)
    bcrypt.init_app(app)
    jwt.init_app(app)
    mail.init_app(app)
    limiter.init_app(app)
    cors_origins = os.getenv("CORS_ORIGINS", "*")
    origins_list = [o.strip() for o in cors_origins.split(",")] if cors_origins != "*" else "*"
    CORS(app, supports_credentials=True, origins=origins_list)
    socketio.init_app(
        app,
        cors_allowed_origins="*",
        async_mode="threading",
        logger=False,
        engineio_logger=False,
    )

    # ── Flask-RESTX / Swagger ─────────────────────────────────────────────────
    api = Api(
        app,
        version="1.0",
        title="Road Damage Ultra API",
        description="Production-grade road surface damage detection API",
        doc="/api/docs",
        prefix="/api",
    )

    # ── Namespaces ────────────────────────────────────────────────────────────
    from routes.predict import predict_ns
    from routes.history import history_ns
    from routes.auth import auth_ns
    from routes.admin import admin_ns
    from routes.video import video_ns
    from routes.report import report_ns
    from routes.retrain import retrain_ns
    from routes.datasets import datasets_ns
    from routes.locations import locations_ns

    for ns in (predict_ns, history_ns, auth_ns, admin_ns, video_ns, report_ns, retrain_ns, datasets_ns, locations_ns):
        api.add_namespace(ns)

    # ── Blueprints ────────────────────────────────────────────────────────────
    from routes.chat import chat_bp
    from routes.weather import weather_bp
    from routes.cost import cost_bp
    from routes.notify import notify_bp
    from routes.simulate import simulate_bp

    for bp in (chat_bp, weather_bp, cost_bp, notify_bp, simulate_bp):
        app.register_blueprint(bp, url_prefix="/api")

    # ── Database init ─────────────────────────────────────────────────────────
    with app.app_context():
        db.create_all()
        _seed_admin(app)

    # ── Health check ──────────────────────────────────────────────────────────
    @app.route("/")
    def home():
        return "RoadSense AI is running 🚀"

    @app.route("/api/health")
    def health():
        return jsonify({"success": True, "data": {"status": "ok"}, "error": None})

    # ── Serve uploaded files (Grad-CAM, overlays, etc.) ───────────────────────
    from flask import send_from_directory

    @app.route("/uploads/<path:filename>")
    def serve_upload(filename):
        return send_from_directory(
            os.path.abspath(app.config["UPLOAD_FOLDER"]), filename
        )

    # ── JWT error handlers ────────────────────────────────────────────────────
    @jwt.expired_token_loader
    def expired_token_callback(jwt_header, jwt_payload):
        return jsonify({"success": False, "error": "Token expired", "data": None}), 401

    @jwt.invalid_token_loader
    def invalid_token_callback(error):
        return jsonify({"success": False, "error": "Invalid token", "data": None}), 401

    @jwt.unauthorized_loader
    def missing_token_callback(error):
        return jsonify({"success": False, "error": "Missing token", "data": None}), 401

    # ── SocketIO events ───────────────────────────────────────────────────────
    from routes.socket_events import register_socket_events
    register_socket_events(socketio)

    logger.info("Road Damage Ultra app created successfully")

    # Pre-warm model at startup to avoid cold-start timeout on first request
    try:
        with app.app_context():
            from ai_model.predict import _load_model
            _load_model("resnet50", None)
            logger.info("ResNet50 pre-warmed successfully")
    except Exception as e:
        logger.warning("Model pre-warm failed (non-fatal): %s", e)

    return app


def _seed_admin(app: Flask) -> None:
    """Create default admin user if none exists."""
    from database.models import User
    if not User.query.filter_by(role="admin").first():
        admin = User(
            username="admin",
            email=os.getenv("ADMIN_EMAIL", "admin@roaddamage.ai"),
            role="admin",
        )
        admin.set_password(os.getenv("ADMIN_PASSWORD", "Admin@1234"))
        db.session.add(admin)
        db.session.commit()
        logger.info("Default admin user created")


app = create_app()

if __name__ == "__main__":
    port = int(os.getenv("PORT", 5000))
    socketio.run(
        app,
        host="0.0.0.0",
        port=port,
        debug=False,
        use_reloader=False,
    )
