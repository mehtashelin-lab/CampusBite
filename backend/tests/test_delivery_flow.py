def make_account(client, email, role):
    response = client.post(
        "/api/auth/register",
        json={
            "full_name": email.split("@")[0].title(),
            "email": email,
            "password": "password123",
            "confirm_password": "password123",
            "role": role,
        },
    )
    assert response.status_code == 201, response.text
    response = client.post(
        "/api/auth/login",
        json={"email": email, "password": "password123"},
    )
    assert response.status_code == 200, response.text
    return {"Authorization": f"Bearer {response.json()['access_token']}"}


def create_order(client, customer_headers, restaurant_id, item_id, address):
    response = client.post(
        "/api/orders",
        headers=customer_headers,
        json={
            "restaurant_id": restaurant_id,
            "delivery_address": address,
            "items": [{"menu_item_id": item_id, "quantity": 1}],
        },
    )
    assert response.status_code == 201, response.text
    return response.json()


def create_restaurant_and_item(client, owner_headers):
    response = client.post(
        "/api/restaurants",
        headers=owner_headers,
        json={"name": "Test Tiffin", "description": "Test kitchen"},
    )
    assert response.status_code == 201, response.text
    restaurant = response.json()
    response = client.post(
        f"/api/restaurants/{restaurant['id']}/menu",
        headers=owner_headers,
        json={"name": "Masala Dosa", "description": "Crisp dosa", "price_paise": 12000},
    )
    assert response.status_code == 201, response.text
    return restaurant["id"], response.json()["id"]


def advance_owner_order(client, owner_headers, order_id):
    accepted = client.patch(f"/api/owner/orders/{order_id}/accept", headers=owner_headers)
    assert accepted.status_code == 200, accepted.text
    preparing = client.patch(
        f"/api/owner/orders/{order_id}/status",
        headers=owner_headers,
        json={"status": "PREPARING"},
    )
    assert preparing.status_code == 200, preparing.text
    return client.patch(
        f"/api/owner/orders/{order_id}/status",
        headers=owner_headers,
        json={"status": "READY"},
    )


def test_delivery_assignment_load_tie_break_privacy_and_lifecycle(client):
    owner = make_account(client, "owner@example.com", "RESTAURANT_OWNER")
    customer = make_account(client, "customer@example.com", "CUSTOMER")
    partner_one = make_account(client, "partner-one@example.com", "DELIVERY_PARTNER")
    partner_two = make_account(client, "partner-two@example.com", "DELIVERY_PARTNER")
    restaurant_id, item_id = create_restaurant_and_item(client, owner)

    for headers in (partner_one, partner_two):
        response = client.patch(
            "/api/delivery/availability",
            headers=headers,
            json={"is_available": True},
        )
        assert response.status_code == 200

    first_order = create_order(client, customer, restaurant_id, item_id, "12 College Road, Pune")
    assert first_order["created_at"]
    response = advance_owner_order(client, owner, first_order["id"])
    assert response.status_code == 200, response.text
    assert response.json()["status"] == "ASSIGNED"

    # Both partners had no active work, so the lower user ID wins the tie.
    first_partner_orders = client.get("/api/delivery/orders", headers=partner_one).json()
    second_partner_orders = client.get("/api/delivery/orders", headers=partner_two).json()
    assert [order["id"] for order in first_partner_orders] == [first_order["id"]]
    assert second_partner_orders == []
    assert first_partner_orders[0]["customer_name"] == "Customer"
    assert first_partner_orders[0]["delivery_address"] == "12 College Road, Pune"

    owner_orders = client.get("/api/owner/orders", headers=owner).json()
    assert all("delivery_address" not in order for order in owner_orders)
    assigned_owner_order = next(order for order in owner_orders if order["id"] == first_order["id"])
    assert assigned_owner_order["delivery_partner_name"] == "Partner-One"
    customer_orders = client.get("/api/orders/me", headers=customer).json()
    assert customer_orders[0]["delivery_address"] == "12 College Road, Pune"
    saved_addresses = client.get("/api/orders/addresses", headers=customer).json()
    assert {address["address"] for address in saved_addresses} == {"12 College Road, Pune"}

    # The partner with fewer active deliveries receives the next ready order.
    second_order = create_order(client, customer, restaurant_id, item_id, "5 Market Lane, Pune")
    response = advance_owner_order(client, owner, second_order["id"])
    assert response.status_code == 200, response.text
    partner_two_orders = client.get("/api/delivery/orders", headers=partner_two).json()
    assert [order["id"] for order in partner_two_orders] == [second_order["id"]]

    # A different partner cannot update this partner's order.
    response = client.patch(
        f"/api/delivery/orders/{first_order['id']}/status",
        headers=partner_two,
        json={"status": "OUT_FOR_DELIVERY"},
    )
    assert response.status_code == 404

    # Going offline prevents new assignments but does not cancel active work.
    response = client.patch(
        "/api/delivery/availability",
        headers=partner_one,
        json={"is_available": False},
    )
    assert response.status_code == 200
    response = client.patch(
        f"/api/delivery/orders/{first_order['id']}/status",
        headers=partner_one,
        json={"status": "OUT_FOR_DELIVERY"},
    )
    assert response.status_code == 200
    assert response.json()["status"] == "OUT_FOR_DELIVERY"
    assert response.json()["delivered_at"] is None
    response = client.patch(
        f"/api/delivery/orders/{first_order['id']}/status",
        headers=partner_one,
        json={"status": "DELIVERED"},
    )
    assert response.status_code == 200
    assert response.json()["status"] == "DELIVERED"
    assert response.json()["delivered_at"]
    assert response.json()["delivery_partner_name"] == "Partner-One"
    delivered_customer_order = next(
        order for order in client.get("/api/orders/me", headers=customer).json()
        if order["id"] == first_order["id"]
    )
    assert delivered_customer_order["delivered_at"]
    assert delivered_customer_order["delivery_partner_name"] == "Partner-One"


def test_ready_order_is_blocked_until_partner_is_available(client):
    owner = make_account(client, "second-owner@example.com", "RESTAURANT_OWNER")
    customer = make_account(client, "second-customer@example.com", "CUSTOMER")
    partner = make_account(client, "offline-partner@example.com", "DELIVERY_PARTNER")
    restaurant_id, item_id = create_restaurant_and_item(client, owner)
    order = create_order(client, customer, restaurant_id, item_id, "100 Campus Drive")

    response = advance_owner_order(client, owner, order["id"])
    assert response.status_code == 409
    current = client.get("/api/owner/orders", headers=owner).json()[0]
    assert current["status"] == "PREPARING"

    client.patch("/api/delivery/availability", headers=partner, json={"is_available": True})
    response = client.patch(
        f"/api/owner/orders/{order['id']}/status",
        headers=owner,
        json={"status": "READY"},
    )
    assert response.status_code == 200
    assert response.json()["status"] == "ASSIGNED"


def test_roles_and_invalid_status_transitions_are_rejected(client):
    owner = make_account(client, "third-owner@example.com", "RESTAURANT_OWNER")
    customer = make_account(client, "third-customer@example.com", "CUSTOMER")
    partner = make_account(client, "third-partner@example.com", "DELIVERY_PARTNER")
    restaurant_id, item_id = create_restaurant_and_item(client, owner)
    order = create_order(client, customer, restaurant_id, item_id, "42 Main Street")

    assert client.get("/api/delivery/orders", headers=customer).status_code == 403
    assert client.patch(
        "/api/delivery/availability",
        headers=customer,
        json={"is_available": True},
    ).status_code == 403
    response = client.patch(
        f"/api/owner/orders/{order['id']}/status",
        headers=owner,
        json={"status": "READY"},
    )
    assert response.status_code == 400
    response = client.patch(
        f"/api/delivery/orders/{order['id']}/status",
        headers=partner,
        json={"status": "DELIVERED"},
    )
    assert response.status_code == 404


def test_partner_with_active_order_is_not_assigned_another_until_delivered(client):
    owner = make_account(client, "single-owner@example.com", "RESTAURANT_OWNER")
    customer = make_account(client, "single-customer@example.com", "CUSTOMER")
    partner = make_account(client, "single-partner@example.com", "DELIVERY_PARTNER")
    restaurant_id, item_id = create_restaurant_and_item(client, owner)
    client.patch("/api/delivery/availability", headers=partner, json={"is_available": True})

    first = create_order(client, customer, restaurant_id, item_id, "1 College Road, Pune")
    assert advance_owner_order(client, owner, first["id"]).json()["status"] == "ASSIGNED"

    second = create_order(client, customer, restaurant_id, item_id, "2 College Road, Pune")
    response = advance_owner_order(client, owner, second["id"])
    assert response.status_code == 409
    assert client.get("/api/owner/orders", headers=owner).json()[0]["status"] == "PREPARING"

    client.patch(
        f"/api/delivery/orders/{first['id']}/status",
        headers=partner,
        json={"status": "OUT_FOR_DELIVERY"},
    )
    delivered = client.patch(
        f"/api/delivery/orders/{first['id']}/status",
        headers=partner,
        json={"status": "DELIVERED"},
    )
    assert delivered.status_code == 200
    assert delivered.json()["delivered_at"]
    assert delivered.json()["delivery_partner_name"] == "Single-Partner"
    assigned = client.patch(
        f"/api/owner/orders/{second['id']}/status",
        headers=owner,
        json={"status": "READY"},
    )
    assert assigned.status_code == 200
    assert assigned.json()["status"] == "ASSIGNED"
    assert assigned.json()["delivered_at"] is None


def test_owner_can_create_only_one_restaurant_and_registration_checks_confirmation(client):
    owner = make_account(client, "one-restaurant@example.com", "RESTAURANT_OWNER")
    first = client.post(
        "/api/restaurants",
        headers=owner,
        json={"name": "First Kitchen", "description": ""},
    )
    assert first.status_code == 201
    second = client.post(
        "/api/restaurants",
        headers=owner,
        json={"name": "Second Kitchen", "description": ""},
    )
    assert second.status_code == 409

    mismatch = client.post(
        "/api/auth/register",
        json={
            "full_name": "Mismatch User",
            "email": "mismatch@example.com",
            "password": "password123",
            "confirm_password": "different123",
            "role": "CUSTOMER",
        },
    )
    assert mismatch.status_code == 422


def test_customer_saved_addresses_are_limited_and_can_be_removed(client):
    customer = make_account(client, "addresses@example.com", "CUSTOMER")
    for number in range(5):
        response = client.post(
            "/api/orders/addresses",
            headers=customer,
            json={"address": f"{number + 1} Address Road, Pune"},
        )
        assert response.status_code == 201, response.text

    extra = client.post(
        "/api/orders/addresses",
        headers=customer,
        json={"address": "6 Address Road, Pune"},
    )
    assert extra.status_code == 409

    saved = client.get("/api/orders/addresses", headers=customer).json()
    removed = client.delete(f"/api/orders/addresses/{saved[0]['id']}", headers=customer)
    assert removed.status_code == 204
    added = client.post(
        "/api/orders/addresses",
        headers=customer,
        json={"address": "6 Address Road, Pune"},
    )
    assert added.status_code == 201
    assert len(client.get("/api/orders/addresses", headers=customer).json()) == 5
