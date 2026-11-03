# CampusBite backend

This folder contains the FastAPI application. It stores project data in a SQLite file.

## Run with Docker Compose

1. From the project folder, copy `.env.example` to `.env` and replace `JWT_SECRET_KEY` with a long random value.
2. Run `docker compose up --build` from the project folder.
3. Open `http://localhost:8000/docs` to explore and try the API.

The database is saved in `backend/data/campusbite.db`. The database file is ignored by Git.

## Main folders

- `app/api/routes`: URLs and request handling, grouped by feature.
- `app/core`: settings and password/token helpers.
- `app/db`: SQLAlchemy database connection and base class.
- `app/models`: Python classes that become database tables.
- `app/schemas`: shapes of API requests and responses.

For local development without Docker, install `requirements.txt`, set `DATABASE_URL=sqlite:///./campusbite.db`, then run `uvicorn app.main:app --reload` from this folder.
