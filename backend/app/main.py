import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.router import api_router
from app.db.base import Base
from app.db.session import engine
from app import models  # Import models so SQLAlchemy knows which tables to create.

logging.basicConfig(level=logging.INFO)

app = FastAPI(
    title="CampusBite API",
    description="Backend API for the CampusBite restaurant ordering project.",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def create_database_tables():
    # Simple setup for the first version. Database migrations can replace this later.
    Base.metadata.create_all(bind=engine)


@app.get("/health", tags=["Health"])
def health_check():
    return {"status": "ok", "message": "CampusBite API is running."}


app.include_router(api_router, prefix="/api")
