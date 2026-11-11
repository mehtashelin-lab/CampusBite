import asyncio

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app import main as main_module
from app.core.config import settings
from app.db.base import Base
from app.db.session import get_db


class SyncASGIClient:
    """Small synchronous wrapper around HTTPX's async ASGI transport."""

    def __init__(self, app):
        self.app = app

    def request(self, method, path, **kwargs):
        async def send_request():
            async with AsyncClient(
                transport=ASGITransport(app=self.app),
                base_url="http://test",
            ) as client:
                return await client.request(method, path, **kwargs)

        return asyncio.run(send_request())

    def get(self, path, **kwargs):
        return self.request("GET", path, **kwargs)

    def post(self, path, **kwargs):
        return self.request("POST", path, **kwargs)

    def patch(self, path, **kwargs):
        return self.request("PATCH", path, **kwargs)

    def delete(self, path, **kwargs):
        return self.request("DELETE", path, **kwargs)


@pytest.fixture
def client(monkeypatch):
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    TestingSessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)
    Base.metadata.create_all(bind=engine)
    monkeypatch.setattr(main_module, "initialize_database", lambda: None)
    monkeypatch.setattr(settings, "jwt_secret_key", "phase-two-test-secret-key-that-is-at-least-32-bytes")

    def override_get_db():
        db = TestingSessionLocal()
        try:
            yield db
        finally:
            db.close()

    main_module.app.dependency_overrides[get_db] = override_get_db
    # The ASGI transport does not need startup; prevent touching the developer's
    # persistent SQLite file if a transport implementation invokes lifespan.
    main_module.app.router.on_startup.clear()
    test_client = SyncASGIClient(main_module.app)
    test_client.session_factory = TestingSessionLocal
    yield test_client
    main_module.app.dependency_overrides.clear()
    engine.dispose()
