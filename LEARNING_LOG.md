# CampusBite Learning Log

## Phase 2: Delivery flow

### Concepts to explain

- **Database model:** the SQLAlchemy `Order` stores its delivery address, UTC creation time, and nullable delivery completion time. `User` stores delivery availability and has up to five saved customer addresses.
- **Migration:** Alembic upgrades existing SQLite databases without removing orders. Legacy orders receive a blank delivery address if needed and a migration timestamp; the five most recent unique addresses are copied into each customer's saved address list. Already delivered orders keep an unknown completion time.
- **Request schema:** Pydantic requires a nonblank delivery address when a customer places a new order.
- **Role and ownership checks:** the backend checks the logged-in role and checks that the delivery partner assigned to an order is the same partner making the update.
- **Status transition:** owners move accepted orders to `PREPARING`. Marking an order ready assigns it and moves it to `ASSIGNED`. Partners move it to `OUT_FOR_DELIVERY`, then `DELIVERED`.
- **Delivery completion:** when the assigned partner marks an order delivered, the backend records the current UTC timestamp. Summaries format order and delivery timestamps in `Asia/Kolkata` and identify the assigned partner.
- **Automatic assignment:** the backend assigns a ready order only to an available partner with no `ASSIGNED` or `OUT_FOR_DELIVERY` order. The lowest user ID breaks ties.
- **Saved addresses:** customers can select an address or add a new one at checkout. Adding a sixth address requires removing one of the five saved addresses first.
- **Restaurant ownership:** the API and database enforce one restaurant per owner account.
- **Order filters:** dashboards filter the loaded orders by status and an inclusive date range; status choices differ by role.
- **Privacy:** customers receive addresses for their own orders. Only the partner assigned to an order receives its delivery address; owner order responses leave it out.
- **Polling:** the customer and delivery dashboards refresh every 15 seconds to show status changes without WebSockets.

### Errors and questions to revisit

- When local API tests appear stuck on Windows, check whether Python is blocked while creating its local event-loop socket. Run the in-memory API checks with the necessary local socket permission; they do not need the production database.
- Practice tracing one API call from the React screen, through `src/api/client.js`, to the FastAPI route, Pydantic schema, SQLAlchemy model, and SQLite row.

### Phase 2 verification

- `backend/tests/test_delivery_flow.py` covers one-active-order assignment, role restrictions, order privacy, saved-address limits, and the complete delivery status path.
- `backend/tests/test_database_migration.py` checks that legacy orders remain present and timestamps, restaurant limits, and saved addresses are migrated.
