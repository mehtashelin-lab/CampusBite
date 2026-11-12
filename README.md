# CampusBite

CampusBite is a full-stack food ordering app built with React, FastAPI, SQLAlchemy, and SQLite. Customers order from local restaurants, restaurant owners manage menus and orders, and delivery partners complete assigned deliveries.

## Main features

- **Customers:** browse restaurants and menus, manage a cart, place mock-paid orders, save up to five delivery addresses, track orders, and cancel while an order is still placed. After delivery, customers can leave a review or request a refund. The customer dashboard also offers optional AI answers based on that customer's recent orders.
- **Restaurant owners:** create one restaurant, manage its menu, accept or reject incoming orders, prepare orders, and mark them ready for automatic delivery-partner assignment. The dashboard includes order filters, basic statistics, stale-order reminders, reviews, and refund decisions.
- **Delivery partners:** set availability, view assigned deliveries, update delivery status, and review completed deliveries.

The backend enforces roles, ownership, order transitions, and address privacy. Delivery addresses are visible to the customer who placed the order and the partner assigned to it. The AI insights feature sends only a limited summary of the authenticated customer's recent order history to OpenAI; it does not send their address or account identity.

## Run the app with Docker Compose

Requirements: Docker Desktop with Docker Compose, Node.js, and npm.

1. From the project folder, make a local environment file:

   ```powershell
   Copy-Item .env.example .env
   ```

2. Edit `.env` and set `JWT_SECRET_KEY` to a long, random secret. `OPENAI_API_KEY` is optional; set it to enable customer order insights. Keep `.env` private and out of Git.

3. Start the API and database:

   ```powershell
   docker compose up --build
   ```

4. Open the API at [http://localhost:8000/docs](http://localhost:8000/docs). Check that the service is running at [http://localhost:8000/health](http://localhost:8000/health).

5. In a second terminal, start the React app:

   ```powershell
   Set-Location frontend
   npm ci
   npm run dev
   ```

   Open the local address Vite prints, normally [http://localhost:5173](http://localhost:5173).

The SQLite database is stored at `backend/data/campusbite.db` and persists across container restarts. Both the database and local environment files are ignored by Git. Stop the running services with `Ctrl+C`; `docker compose down` removes the stopped container but keeps the database file.

## Local checks

Run the backend tests from the project folder:

```powershell
.\.venv\Scripts\python.exe -m pip install -r backend\requirements-dev.txt
.\.venv\Scripts\python.exe -m pytest backend\tests
```

Run the frontend checks from `frontend`:

```powershell
npm test
npm run build
```

The backend tests use an in-memory SQLite database and do not modify the local app database.

## Configuration

| Variable | Required | Purpose |
| --- | --- | --- |
| `JWT_SECRET_KEY` | Yes for Docker Compose | Signs login tokens. Use a long, private random value. |
| `OPENAI_API_KEY` | No | Enables customer order-insight answers. Without it, the feature returns a clear unavailable error. |
| `OPENAI_MODEL` | No | OpenAI model name; defaults to `gpt-4o-mini`. |
| `VITE_API_URL` | No | Frontend API base URL; defaults to `http://localhost:8000`. See `frontend/.env.example`. |

## Project layout

- `backend/app/api/routes`: FastAPI endpoints, grouped by feature.
- `backend/app/models` and `backend/app/schemas`: database records and API request/response shapes.
- `backend/alembic`: SQLite schema migrations, applied when the API starts.
- `frontend/src/pages` and `frontend/src/components`: React screens and shared UI.
- `LEARNING_LOG.md`: project learning notes.

## Demo walkthrough

Register separate customer, restaurant-owner, and delivery-partner accounts from the app. Create the owner's restaurant and menu, then use the customer account to place an order. From the owner dashboard, accept the order, start preparation, and mark it ready. Set a partner account to available and complete the delivery from its dashboard. Return to the customer account to check the delivered order, review it, or submit a refund request.

Payments are mocked for this project; no real payment is collected. SQLite is intended for this local project setup. The Compose configuration does not publish the app to a cloud host.

For feature and endpoint details, see [backend/README.md](backend/README.md) and [frontend/README.md](frontend/README.md).
