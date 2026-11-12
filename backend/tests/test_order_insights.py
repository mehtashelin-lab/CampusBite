import json
from datetime import UTC, datetime, timedelta

import pytest
from sqlalchemy import select

from app.api.routes import orders as orders_route
from app.core.config import settings
from app.models import Order, OrderItem, OrderStatus, Restaurant, User
from app.services import order_insights
from app.services.order_insights import InsightRateLimited, InsightUnavailable
from test_delivery_flow import create_restaurant_and_item, make_account


def seed_order_history(client, customer_email, other_email, owner):
    customer = make_account(client, customer_email, "CUSTOMER")
    other_customer = make_account(client, other_email, "CUSTOMER")
    restaurant_id, _ = create_restaurant_and_item(client, owner)
    with client.session_factory() as db:
        account = db.scalar(select(User).where(User.email == customer_email))
        other_account = db.scalar(select(User).where(User.email == other_email))
        restaurant = db.get(Restaurant, restaurant_id)
        now = datetime.now(UTC)
        for index in range(23):
            order = Order(
                customer_id=account.id,
                restaurant_id=restaurant.id,
                delivery_address=f"PRIVATE ADDRESS {index}",
                status=OrderStatus.DELIVERED,
                total_paise=12000,
                created_at=now - timedelta(days=22 - index),
            )
            order.items.append(
                OrderItem(
                    menu_item_id=1,
                    item_name=f"Own dish {index:02d}",
                    unit_price_paise=12000,
                    quantity=1,
                )
            )
            db.add(order)
        other_order = Order(
            customer_id=other_account.id,
            restaurant_id=restaurant.id,
            delivery_address="OTHER PRIVATE ADDRESS",
            status=OrderStatus.DELIVERED,
            total_paise=5000,
            created_at=now,
        )
        other_order.items.append(
            OrderItem(menu_item_id=1, item_name="Other customer's dish", unit_price_paise=5000, quantity=1)
        )
        db.add(other_order)
        db.commit()
    return customer, other_customer


def test_insights_only_include_current_customers_20_latest_orders(client, monkeypatch):
    owner = make_account(client, "insights-owner@example.com", "RESTAURANT_OWNER")
    customer, _ = seed_order_history(
        client, "insights-customer@example.com", "insights-other@example.com", owner
    )
    monkeypatch.setattr(settings, "openai_api_key", "test-secret-key")
    captured = {}

    def fake_generate(question, orders, api_key, model):
        captured.update(question=question, orders=orders, api_key=api_key, model=model)
        return "You ordered these dishes recently."

    monkeypatch.setattr(orders_route, "generate_order_insight", fake_generate)
    response = client.post(
        "/api/orders/insights", headers=customer, json={"question": "What did I order?"}
    )

    assert response.status_code == 200, response.text
    assert response.json() == {"answer": "You ordered these dishes recently."}
    assert captured["api_key"] == "test-secret-key"
    assert captured["model"] == settings.openai_model
    assert [order["items"][0]["name"] for order in captured["orders"]] == [
        f"Own dish {index:02d}" for index in range(22, 2, -1)
    ]
    payload = json.dumps(captured["orders"])
    assert "PRIVATE ADDRESS" not in payload
    assert "Other customer's dish" not in payload
    assert all("customer_id" not in order and "delivery_address" not in order for order in captured["orders"])


def test_insights_require_customer_role_and_valid_question(client):
    owner = make_account(client, "insights-role-owner@example.com", "RESTAURANT_OWNER")
    customer = make_account(client, "insights-validation@example.com", "CUSTOMER")

    assert client.post("/api/orders/insights", json={"question": "What did I order?"}).status_code == 401
    assert client.post(
        "/api/orders/insights", headers=owner, json={"question": "What did I order?"}
    ).status_code == 403
    assert client.post(
        "/api/orders/insights", headers=customer, json={"question": "   "}
    ).status_code == 422
    assert client.post(
        "/api/orders/insights", headers=customer, json={"question": "x" * 501}
    ).status_code == 422


def test_insights_return_clear_error_without_key_or_when_provider_fails(client, monkeypatch):
    owner = make_account(client, "insights-error-owner@example.com", "RESTAURANT_OWNER")
    customer, _ = seed_order_history(
        client, "insights-error-customer@example.com", "insights-error-other@example.com", owner
    )
    monkeypatch.setattr(settings, "openai_api_key", "")
    request = {"question": "What did I order recently?"}

    missing_key = client.post("/api/orders/insights", headers=customer, json=request)
    assert missing_key.status_code == 503
    assert "not configured" in missing_key.json()["detail"]

    monkeypatch.setattr(settings, "openai_api_key", "test-secret-key")
    monkeypatch.setattr(
        orders_route, "generate_order_insight",
        lambda *_args: (_ for _ in ()).throw(InsightRateLimited()),
    )
    rate_limited = client.post("/api/orders/insights", headers=customer, json=request)
    assert rate_limited.status_code == 429
    assert "rate-limited" in rate_limited.json()["detail"]

    monkeypatch.setattr(
        orders_route, "generate_order_insight",
        lambda *_args: (_ for _ in ()).throw(InsightUnavailable()),
    )
    unavailable = client.post("/api/orders/insights", headers=customer, json=request)
    assert unavailable.status_code == 503
    assert "temporarily unavailable" in unavailable.json()["detail"]


def test_no_order_history_has_a_clear_answer_without_openai(client, monkeypatch):
    customer = make_account(client, "insights-empty@example.com", "CUSTOMER")
    monkeypatch.setattr(settings, "openai_api_key", "test-secret-key")
    response = client.post(
        "/api/orders/insights", headers=customer, json={"question": "What did I order?"}
    )
    assert response.status_code == 200
    assert "do not have any orders yet" in response.json()["answer"]


def test_openai_service_sends_configured_model_and_returns_clean_answer(monkeypatch):
    observed = {}

    class FakeCompletion:
        choices = [type("Choice", (), {"message": type("Message", (), {"content": "  Recent answer.  "})()})()]

    class FakeCompletions:
        def create(self, **kwargs):
            observed["request"] = kwargs
            return FakeCompletion()

    class FakeClient:
        def __init__(self, **kwargs):
            observed["client"] = kwargs
            self.chat = type("Chat", (), {"completions": FakeCompletions()})()

    monkeypatch.setattr(order_insights, "OpenAI", FakeClient)
    answer = order_insights.generate_order_insight(
        "What did I order?", [{"restaurant": "Test Tiffin"}], "secret", "gpt-4o-mini"
    )

    assert answer == "Recent answer."
    assert observed["client"] == {"api_key": "secret", "timeout": 20.0, "max_retries": 0}
    assert observed["request"]["model"] == "gpt-4o-mini"
    assert '"restaurant": "Test Tiffin"' in observed["request"]["messages"][1]["content"]
    assert observed["request"]["max_tokens"] == 300
