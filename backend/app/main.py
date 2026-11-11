import logging
import asyncio
import time
from contextlib import asynccontextmanager
from pathlib import Path

from alembic import command
from alembic.config import Config
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.router import api_router
from app.db.base import Base
from app.db.session import engine
from app.db.session import SessionLocal
from app.core.config import settings
from app import models  # Import models so SQLAlchemy knows which tables to create.
from app.services.order_reminders import create_stale_order_reminders

logging.basicConfig(level=logging.INFO)


@asynccontextmanager
async def lifespan(_app: FastAPI):
    initialize_database()
    reminder_task = asyncio.create_task(reminder_worker())
    yield
    reminder_task.cancel()
    try:
        await reminder_task
    except asyncio.CancelledError:
        pass


async def reminder_worker():
    """Check stale orders every minute and persist reminders in SQLite."""
    while True:
        try:
            await asyncio.to_thread(scan_stale_orders)
        except Exception:
            logging.exception("Unable to create stale-order reminders")
        await asyncio.sleep(60)


def scan_stale_orders():
    with SessionLocal() as db:
        create_stale_order_reminders(db)

app = FastAPI(
    title="CampusBite API",
    description="Backend API for the CampusBite restaurant ordering project.",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def log_request_summary(request, call_next):
    started = time.perf_counter()
    response = await call_next(request)
    elapsed_ms = (time.perf_counter() - started) * 1000
    logging.getLogger("campusbite.requests").info(
        "%s %s %s %.1fms",
        request.method,
        request.url.path,
        response.status_code,
        elapsed_ms,
    )
    return response


def initialize_database():
    backend_dir = Path(__file__).resolve().parents[1]
    migration_config = Config(str(backend_dir / "alembic.ini"))
    migration_config.set_main_option("script_location", str(backend_dir / "alembic"))
    migration_config.set_main_option("sqlalchemy.url", settings.database_url.replace("%", "%%"))
    command.upgrade(migration_config, "head")
    Base.metadata.create_all(bind=engine)


@app.get("/health", tags=["Health"])
def health_check():
    return {"status": "ok", "message": "CampusBite API is running."}


app.include_router(api_router, prefix="/api")
