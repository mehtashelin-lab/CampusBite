import logging
from datetime import UTC, datetime, timedelta

from sqlalchemy import select

from app.models import Order, OrderReminder, PaymentLedger, RefundRequest, Review
from app.services.order_reminders import create_stale_order_reminders
from test_delivery_flow import advance_owner_order, create_order, create_restaurant_and_item, make_account


def mark_delivered(client, owner, partner, order_id):
    assert advance_owner_order(client, owner, order_id).status_code == 200
    response = client.patch(
        f"/api/delivery/orders/{order_id}/status", headers=partner,
        json={"status": "OUT_FOR_DELIVERY"},
    )
    assert response.status_code == 200, response.text
    response = client.patch(
        f"/api/delivery/orders/{order_id}/status", headers=partner,
        json={"status": "DELIVERED"},
    )
    assert response.status_code == 200, response.text


def test_owner_can_view_unavailable_dish_and_customers_cannot_order_it(client):
    owner = make_account(client, "menu-owner@example.com", "RESTAURANT_OWNER")
    customer = make_account(client, "menu-customer@example.com", "CUSTOMER")
    restaurant_id, item_id = create_restaurant_and_item(client, owner)

    response = client.patch(
        f"/api/restaurants/{restaurant_id}/menu/{item_id}",
        headers=owner, json={"is_available": False},
    )
    assert response.status_code == 200
    assert response.json()["is_available"] is False
    assert client.get(f"/api/restaurants/{restaurant_id}/menu").json() == []
    assert client.get(f"/api/restaurants/{restaurant_id}/menu/manage", headers=owner).json()[0]["is_available"] is False
    order = client.post(
        "/api/orders", headers=customer,
        json={"restaurant_id": restaurant_id, "delivery_address": "12 College Road, Pune", "items": [{"menu_item_id": item_id, "quantity": 1}]},
    )
    assert order.status_code == 400


def test_review_and_refund_permissions_and_owner_decisions(client):
    owner = make_account(client, "feedback-owner@example.com", "RESTAURANT_OWNER")
    customer = make_account(client, "feedback-customer@example.com", "CUSTOMER")
    other_customer = make_account(client, "other-customer@example.com", "CUSTOMER")
    partner = make_account(client, "feedback-partner@example.com", "DELIVERY_PARTNER")
    restaurant_id, item_id = create_restaurant_and_item(client, owner)
    client.patch("/api/delivery/availability", headers=partner, json={"is_available": True})
    order = create_order(client, customer, restaurant_id, item_id, "14 Campus Road, Pune")

    assert client.post(f"/api/orders/{order['id']}/review", headers=customer, json={"rating": 5}).status_code == 400
    mark_delivered(client, owner, partner, order["id"])
    review = client.post(f"/api/orders/{order['id']}/review", headers=customer, json={"rating": 4, "comment": "Good food"})
    assert review.status_code == 201, review.text
    assert review.json()["comment"] == "Good food"
    assert client.post(f"/api/orders/{order['id']}/review", headers=customer, json={"rating": 4}).status_code == 409
    assert client.post(f"/api/orders/{order['id']}/review", headers=other_customer, json={"rating": 4}).status_code == 404
    assert client.post(f"/api/orders/{order['id']}/review", headers=customer, json={"rating": 6}).status_code == 422

    refund = client.post(f"/api/orders/{order['id']}/refund-request", headers=customer, json={"reason": "Cold meal"})
    assert refund.status_code == 201, refund.text
    assert client.post(f"/api/orders/{order['id']}/refund-request", headers=customer, json={"reason": "Changed my mind"}).status_code == 409
    decision = client.patch(f"/api/owner/refund-requests/{refund.json()['id']}", headers=owner, json={"decision": "APPROVED"})
    assert decision.status_code == 200
    assert decision.json()["status"] == "APPROVED"
    assert client.get("/api/orders/me", headers=customer).json()[0]["status"] == "REFUNDED"
    customer_order = client.get("/api/orders/me", headers=customer).json()[0]
    owner_order = client.get("/api/owner/orders", headers=owner).json()[0]
    partner_order = client.get("/api/delivery/orders", headers=partner).json()[0]
    assert customer_order["status"] == "REFUNDED"
    assert owner_order["status"] == "REFUNDED"
    assert customer_order["delivered_at"]
    assert customer_order["delivery_partner_name"] == "Feedback-Partner"
    assert owner_order["delivered_at"] == customer_order["delivered_at"]
    assert owner_order["delivery_partner_name"] == "Feedback-Partner"
    assert partner_order["status"] == "DELIVERED"
    assert partner_order["delivered_at"] == customer_order["delivered_at"]
    assert partner_order["delivery_partner_name"] == "Feedback-Partner"
    assert client.patch(
        f"/api/delivery/orders/{order['id']}/status", headers=partner,
        json={"status": "DELIVERED"},
    ).status_code == 400
    assert client.patch(f"/api/owner/refund-requests/{refund.json()['id']}", headers=owner, json={"decision": "REJECTED"}).status_code == 400
    with client.session_factory() as db:
        assert db.scalar(select(Review).where(Review.order_id == order["id"])) is not None
        assert db.scalar(select(RefundRequest).where(RefundRequest.order_id == order["id"])).status == "APPROVED"
        ledger = db.scalars(select(PaymentLedger).where(PaymentLedger.order_id == order["id"])).all()
        assert [(entry.payment_type, entry.amount_paise) for entry in ledger].count(("refund", order["total_paise"])) == 1


def test_refund_rejection_keeps_order_delivered(client):
    owner = make_account(client, "reject-owner@example.com", "RESTAURANT_OWNER")
    customer = make_account(client, "reject-customer@example.com", "CUSTOMER")
    partner = make_account(client, "reject-partner@example.com", "DELIVERY_PARTNER")
    restaurant_id, item_id = create_restaurant_and_item(client, owner)
    client.patch("/api/delivery/availability", headers=partner, json={"is_available": True})
    order = create_order(client, customer, restaurant_id, item_id, "20 College Road, Pune")
    mark_delivered(client, owner, partner, order["id"])
    refund = client.post(f"/api/orders/{order['id']}/refund-request", headers=customer, json={"reason": "Late delivery"}).json()
    result = client.patch(f"/api/owner/refund-requests/{refund['id']}", headers=owner, json={"decision": "REJECTED"})
    assert result.status_code == 200
    assert client.get("/api/orders/me", headers=customer).json()[0]["status"] == "DELIVERED"
    with client.session_factory() as db:
        assert db.scalar(select(PaymentLedger.id).where(PaymentLedger.order_id == order["id"], PaymentLedger.payment_type == "refund")) is None


def test_stale_order_reminders_are_unique_and_resolve_on_status_change(client):
    owner = make_account(client, "reminder-owner@example.com", "RESTAURANT_OWNER")
    customer = make_account(client, "reminder-customer@example.com", "CUSTOMER")
    restaurant_id, item_id = create_restaurant_and_item(client, owner)
    order = create_order(client, customer, restaurant_id, item_id, "25 College Road, Pune")
    old = datetime.now(UTC) - timedelta(minutes=16)
    with client.session_factory() as db:
        db_order = db.get(Order, order["id"])
        db_order.status_updated_at = old
        db.commit()
        assert create_stale_order_reminders(db, datetime.now(UTC)) == 1
        assert create_stale_order_reminders(db, datetime.now(UTC)) == 0
    reminders = client.get("/api/owner/reminders", headers=owner)
    assert reminders.status_code == 200
    assert [item["order_id"] for item in reminders.json()] == [order["id"]]
    accepted = client.patch(f"/api/owner/orders/{order['id']}/accept", headers=owner)
    assert accepted.status_code == 200
    assert client.get("/api/owner/reminders", headers=owner).json() == []
    with client.session_factory() as db:
        reminder = db.scalar(select(OrderReminder).where(OrderReminder.order_id == order["id"]))
        assert reminder is not None and not reminder.is_active


def test_owner_statistics_exclude_cancelled_rejected_and_refunded_orders(client):
    owner = make_account(client, "stats-owner@example.com", "RESTAURANT_OWNER")
    customer = make_account(client, "stats-customer@example.com", "CUSTOMER")
    restaurant_id, item_id = create_restaurant_and_item(client, owner)
    placed = create_order(client, customer, restaurant_id, item_id, "30 College Road, Pune")
    cancelled = create_order(client, customer, restaurant_id, item_id, "31 College Road, Pune")
    client.patch(f"/api/orders/{cancelled['id']}/cancel", headers=customer)
    stats = client.get("/api/owner/stats", headers=owner)
    assert stats.status_code == 200
    assert stats.json() == {
        "total_orders": 2, "placed_orders": 1, "active_orders": 1,
        "delivered_orders": 0, "gross_total_paise": placed["total_paise"],
    }


def test_request_logs_do_not_include_request_body(client, caplog):
    caplog.set_level(logging.INFO, logger="campusbite.requests")
    secret = "sensitive-body-content"
    client.post("/api/auth/login", json={"email": "missing@example.com", "password": secret})
    records = [record.getMessage() for record in caplog.records if record.name == "campusbite.requests"]
    assert records
    assert all("POST /api/auth/login" in message for message in records)
    assert secret not in "\n".join(records)
