# CampusBite backend

This folder contains the FastAPI application. It stores project data in a SQLite file. For the full project overview and the recommended Docker Compose setup, see the [root README](../README.md).

## Run with Docker Compose

1. From the project folder, copy `.env.example` to `.env` and set `JWT_SECRET_KEY` to a long random value. Compose will refuse to start if this value is missing.
2. Run `docker compose up --build` from the project folder.
3. Open `http://localhost:8000/docs` to explore and try the API.

The database is saved in `backend/data/campusbite.db`. The database file is ignored by Git.
On startup, Alembic applies any pending database migrations before the API begins serving requests. The migration adds the delivery address and partner availability fields without deleting existing users or orders.

## Delivery flow

1. An owner accepts a placed order, starts preparing it, then marks it ready.
2. When the owner marks it ready, the backend assigns an available delivery partner with no active delivery. Ties go to the partner with the lower user ID.
3. If no partner is available, the order stays in `PREPARING`; the owner can retry after a partner switches to available.
4. The assigned partner moves the order from `ASSIGNED` to `OUT_FOR_DELIVERY` and then to `DELIVERED`.

Delivery partners can only see orders assigned to their account. Their delivery screen shows the customer name and delivery address. A customer can see the address on their own orders; restaurant owners do not receive it in their order response.

Each restaurant owner can create one restaurant. Orders include a UTC creation timestamp, which the customer, owner, and delivery dashboards use for status and date range filters. Existing orders are backfilled with the migration timestamp. New deliveries record a UTC completion timestamp; older delivered orders keep this field empty because their completion time is unknown.

Customers can save up to five delivery addresses. Existing order addresses are migrated into each customer's saved list (up to the five most recent unique addresses); saved addresses can be selected or removed at checkout.

## Customer order insights

Customers can ask `POST /api/orders/insights` questions about their 20 most recent orders. The backend scopes the query to the authenticated customer and sends only the date, restaurant, status, total, and item summaries to OpenAI. It excludes delivery addresses and customer identity details. Set `OPENAI_API_KEY` in the local `.env`; `OPENAI_MODEL` defaults to `gpt-4o-mini`. Missing configuration, provider failures, and rate limits return clear errors instead of a generated fallback answer.

## Useful delivery endpoints

- `PATCH /api/owner/orders/{order_id}/status` with `PREPARING` or `READY`
- `GET /api/delivery/availability` and `PATCH /api/delivery/availability`
- `GET /api/delivery/orders`
- `PATCH /api/delivery/orders/{order_id}/status` with `OUT_FOR_DELIVERY` or `DELIVERED`

`POST /api/orders` now requires `delivery_address` along with the restaurant and item list.
`POST /api/orders/insights` accepts `{ "question": "..." }` and returns `{ "answer": "..." }` for authenticated customers.

## Main folders

- `app/api/routes`: URLs and request handling, grouped by feature.
- `app/core`: settings and password/token helpers.
- `app/db`: SQLAlchemy database connection and base class.
- `app/models`: Python classes that become database tables.
- `app/schemas`: shapes of API requests and responses.

For local development without Docker, install `requirements.txt`, set `DATABASE_URL=sqlite:///./campusbite.db` and a private `JWT_SECRET_KEY`, then run `uvicorn app.main:app --reload` from this folder. Set `OPENAI_API_KEY` only if you want to use customer order insights.

## Run the backend checks

From the `backend` folder, install the development tools and run the API and migration checks:

```powershell
..\.venv\Scripts\python.exe -m pip install -r requirements-dev.txt
..\.venv\Scripts\python.exe -m pytest
```

The tests use an in-memory SQLite database. They do not use the persistent `backend/data/campusbite.db` file.
