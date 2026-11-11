"""Save up to five customer delivery addresses."""

from datetime import UTC, datetime

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect

revision = "20261112_customer_addresses"
down_revision = "20261111_order_dates_owner_limit"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)
    tables = set(inspector.get_table_names())
    if "users" not in tables or "customer_addresses" in tables:
        return

    op.create_table(
        "customer_addresses",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("customer_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("address", sa.String(length=500), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("customer_id", "address", name="uq_customer_addresses_customer_address"),
    )
    op.create_index("ix_customer_addresses_id", "customer_addresses", ["id"])
    op.create_index("ix_customer_addresses_customer_id", "customer_addresses", ["customer_id"])

    if "orders" not in tables:
        return
    order_columns = {column["name"] for column in inspector.get_columns("orders")}
    if not {"customer_id", "delivery_address", "id"}.issubset(order_columns):
        return

    orders = sa.table(
        "orders",
        sa.column("id", sa.Integer()),
        sa.column("customer_id", sa.Integer()),
        sa.column("delivery_address", sa.String()),
        *( [sa.column("created_at", sa.DateTime(timezone=True))] if "created_at" in order_columns else [] ),
    )
    addresses = sa.table(
        "customer_addresses",
        sa.column("customer_id", sa.Integer()),
        sa.column("address", sa.String()),
        sa.column("created_at", sa.DateTime(timezone=True)),
    )
    ordering = [orders.c.created_at.desc(), orders.c.id.desc()] if "created_at" in order_columns else [orders.c.id.desc()]
    seen: dict[int, set[str]] = {}
    for row in bind.execute(sa.select(orders).order_by(*ordering)).mappings():
        address = (row["delivery_address"] or "").strip()
        customer_id = row["customer_id"]
        if not address or customer_id is None:
            continue
        customer_addresses = seen.setdefault(customer_id, set())
        if address in customer_addresses or len(customer_addresses) >= 5:
            continue
        customer_addresses.add(address)
        bind.execute(
            sa.insert(addresses).values(
                customer_id=customer_id,
                address=address,
                created_at=row.get("created_at") or datetime.now(UTC),
            )
        )


def downgrade() -> None:
    bind = op.get_bind()
    if "customer_addresses" in inspect(bind).get_table_names():
        op.drop_index("ix_customer_addresses_id", table_name="customer_addresses")
        op.drop_index("ix_customer_addresses_customer_id", table_name="customer_addresses")
        op.drop_table("customer_addresses")
