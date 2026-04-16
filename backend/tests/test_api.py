"""Basic API smoke tests."""
import io
import os
import pytest
from PIL import Image

os.environ.setdefault("FLASK_ENV", "testing")
os.environ.setdefault("SECRET_KEY", "test")
os.environ.setdefault("JWT_SECRET_KEY", "test-jwt")


@pytest.fixture
def client():
    from app import create_app
    from config import TestingConfig
    app = create_app(TestingConfig())
    app.config["TESTING"] = True
    with app.test_client() as c:
        yield c


def _make_image_bytes() -> bytes:
    img = Image.new("RGB", (224, 224), color=(100, 150, 200))
    buf = io.BytesIO()
    img.save(buf, format="JPEG")
    return buf.getvalue()


def test_health(client):
    resp = client.get("/api/health")
    assert resp.status_code == 200
    data = resp.get_json()
    assert data["success"] is True


def test_login_invalid(client):
    resp = client.post("/api/auth/login", json={"username": "nobody", "password": "wrong"})
    assert resp.status_code == 401


def test_login_admin(client):
    resp = client.post("/api/auth/login", json={"username": "admin", "password": "Admin@1234"})
    assert resp.status_code == 200
    data = resp.get_json()
    assert "access_token" in data["data"]


def test_history_empty(client):
    resp = client.get("/api/history")
    assert resp.status_code == 200
    data = resp.get_json()
    assert data["success"] is True
    assert "items" in data["data"]


def test_stats(client):
    resp = client.get("/api/history/stats")
    assert resp.status_code == 200


def test_cost_estimate(client):
    resp = client.post(
        "/api/cost/estimate",
        json={"predicted_class": "Pothole", "confidence": 0.9, "area_sqm": 10, "region": "urban"},
    )
    assert resp.status_code == 200
    data = resp.get_json()
    assert data["data"]["mid"] > 0
