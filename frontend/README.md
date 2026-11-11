# CampusBite frontend

The frontend is a React app built with Vite. It calls the FastAPI backend at `http://localhost:8000` by default.

## Start the app

1. Start the backend from the project folder with `docker compose up --build`.
2. In a second terminal, open this `frontend` folder and run `npm install` once.
3. Run `npm run dev` and open the local address printed by Vite (normally `http://localhost:5173`).
4. Optional: copy `.env.example` to `.env` and set `VITE_API_URL` if the backend runs at a different address.

## Screens

- Restaurant listing and menu browsing are public.
- Customers can register, log in, save a cart, place a mock-paid order, view their orders, and cancel an order while it is still placed.
- Restaurant owners can create one restaurant, add and edit dishes, view incoming orders, accept or reject placed orders, and move accepted orders through preparation to automatic delivery assignment.
- Owner accounts are limited to the owner dashboard and cannot browse restaurant menus, use the cart, or place customer orders.
- Customers provide a delivery address at checkout and see order status updates in their dashboard.
- Customers can select saved delivery addresses or add and remove addresses, with a maximum of five per account. The checkout carries the saved address into the order.
- Order summaries show the order date and time beneath the order number. Delivered orders also show their completion date, time, and delivery partner when that information is recorded.
- Delivery partners cannot browse restaurants or menus. They can set availability, receive one active delivery at a time, start a delivery, mark it delivered, and review completed deliveries.
- Customer, owner, and delivery dashboards can filter orders by status and date range.
- New accounts require matching password and confirmation fields.

## Code map

- `src/api/client.js`: sends requests to FastAPI and attaches the saved JWT when present.
- `src/context/AuthContext.jsx`: holds the logged-in user and token.
- `src/context/CartContext.jsx`: holds the cart in browser storage.
- `src/pages`: screens for customers, owners, registration, and login.
- `src/components`: shared navigation, access checks, loading and error messages, and order cards.
