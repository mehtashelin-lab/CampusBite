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
- Restaurant owners can create multiple restaurants, add and edit dishes, view incoming orders, and accept placed orders.
- Owner accounts are limited to the owner dashboard and cannot browse restaurant menus, use the cart, or place customer orders.
- The delivery partner route is a placeholder until the backend has assigned-delivery endpoints.

## Code map

- `src/api/client.js`: sends requests to FastAPI and attaches the saved JWT when present.
- `src/context/AuthContext.jsx`: holds the logged-in user and token.
- `src/context/CartContext.jsx`: holds the cart in browser storage.
- `src/pages`: screens for customers, owners, registration, and login.
- `src/components`: shared navigation, access checks, loading and error messages, and order cards.
