from pathlib import Path

from alembic import command
from alembic.config import Config
from sqlalchemy import create_engine, inspect, text

from app.core.config import settings


def test_delivery_migration_preserves_existing_sqlite_orders(tmp_path, monkeypatch):
    database_path = tmp_path / "legacy-campusbite.db"
    database_url = f"sqlite:///{database_path.as_posix()}"
    legacy_engine = create_engine(database_url)
    with legacy_engine.begin() as connection:
        connection.exec_driver_sql(
            "CREATE TABLE users (id INTEGER PRIMARY KEY, full_name VARCHAR(120), "
            "email VARCHAR(255), password_hash VARCHAR(255), role VARCHAR(40))"
        )
        connection.exec_driver_sql(
            "CREATE TABLE orders (id INTEGER PRIMARY KEY, customer_id INTEGER, "
            "restaurant_id INTEGER, delivery_partner_id INTEGER, status VARCHAR(40), "
            "delivery_address VARCHAR(500), total_paise INTEGER)"
        )
        connection.exec_driver_sql(
            "CREATE TABLE restaurants (id INTEGER PRIMARY KEY, owner_id INTEGER, "
            "name VARCHAR(160), description VARCHAR(500), is_active BOOLEAN)"
        )
        connection.execute(
            text("INSERT INTO users (id, full_name, email, password_hash, role) VALUES (1, 'Test Customer', 'test@example.com', 'hash', 'CUSTOMER')")
        )
        connection.execute(
            text("INSERT INTO orders (id, customer_id, restaurant_id, status, delivery_address, total_paise) VALUES (7, 1, 2, 'PLACED', '', 12000)")
        )
        connection.execute(
            text("INSERT INTO orders (id, customer_id, restaurant_id, status, delivery_address, total_paise) VALUES (8, 1, 2, 'DELIVERED', '8 College Road, Pune', 12000)")
        )
        connection.execute(
            text("INSERT INTO orders (id, customer_id, restaurant_id, status, delivery_address, total_paise) VALUES (9, 1, 2, 'DELIVERED', '8 College Road, Pune', 12000)")
        )
        connection.execute(
            text("INSERT INTO restaurants (id, owner_id, name, description, is_active) VALUES (2, 1, 'Test Kitchen', '', 1)")
        )

    monkeypatch.setattr(settings, "database_url", database_url)
    backend_dir = Path(__file__).resolve().parents[1]
    alembic_config = Config(str(backend_dir / "alembic.ini"))
    alembic_config.set_main_option("script_location", str(backend_dir / "alembic"))
    command.upgrade(alembic_config, "head")

    inspector = inspect(legacy_engine)
    assert "delivery_address" in {column["name"] for column in inspector.get_columns("orders")}
    assert "created_at" in {column["name"] for column in inspector.get_columns("orders")}
    assert "delivered_at" in {column["name"] for column in inspector.get_columns("orders")}
    assert "status_updated_at" in {column["name"] for column in inspector.get_columns("orders")}
    assert "is_available" in {column["name"] for column in inspector.get_columns("users")}
    assert any(index["name"] == "uq_restaurants_owner_id" and index["unique"] for index in inspector.get_indexes("restaurants"))
    assert "customer_addresses" in inspector.get_table_names()
    assert {"reviews", "refund_requests", "order_reminders"}.issubset(inspector.get_table_names())
    with legacy_engine.connect() as connection:
        assert connection.execute(text("SELECT COUNT(*) FROM orders WHERE id = 7")).scalar_one() == 1
        assert connection.execute(text("SELECT delivery_address FROM orders WHERE id = 7")).scalar_one() == ""
        assert connection.execute(text("SELECT is_available FROM users WHERE id = 1")).scalar_one() == 0
        assert connection.execute(text("SELECT created_at FROM orders WHERE id = 7")).scalar_one() is not None
        assert connection.execute(text("SELECT status_updated_at FROM orders WHERE id = 7")).scalar_one() is not None
        assert connection.execute(text("SELECT delivered_at FROM orders WHERE id = 9")).scalar_one() is None
        assert connection.execute(text("SELECT name FROM restaurants WHERE id = 2")).scalar_one() == "Test Kitchen"
        assert connection.execute(text("SELECT COUNT(*) FROM customer_addresses WHERE customer_id = 1")).scalar_one() == 1
        assert connection.execute(text("SELECT address FROM customer_addresses WHERE customer_id = 1")).scalar_one() == "8 College Road, Pune"
    legacy_engine.dispose()
