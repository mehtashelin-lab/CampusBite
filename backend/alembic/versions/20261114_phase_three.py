"""Add reviews, refund requests, reminders, and order status timestamps."""

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect

revision = "20261114_phase_three"
down_revision = "20261113_delivered_timestamp"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)
    tables = set(inspector.get_table_names())

    if "orders" in tables:
        columns = {column["name"] for column in inspector.get_columns("orders")}
        if "status_updated_at" not in columns:
            op.add_column("orders", sa.Column("status_updated_at", sa.DateTime(timezone=True), nullable=True))
            if "created_at" in columns:
                op.execute(sa.text("UPDATE orders SET status_updated_at = created_at WHERE status_updated_at IS NULL"))

    if "reviews" not in tables:
        op.create_table(
            "reviews",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("order_id", sa.Integer(), sa.ForeignKey("orders.id", ondelete="CASCADE"), nullable=False),
            sa.Column("customer_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
            sa.Column("rating", sa.Integer(), nullable=False),
            sa.Column("comment", sa.String(length=1000), nullable=False, server_default=""),
            sa.CheckConstraint("rating >= 1 AND rating <= 5", name="ck_reviews_rating_range"),
            sa.UniqueConstraint("order_id", name="uq_reviews_order_id"),
        )
        op.create_index("ix_reviews_id", "reviews", ["id"])
        op.create_index("ix_reviews_order_id", "reviews", ["order_id"])
        op.create_index("ix_reviews_customer_id", "reviews", ["customer_id"])

    if "refund_requests" not in tables:
        op.create_table(
            "refund_requests",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("order_id", sa.Integer(), sa.ForeignKey("orders.id", ondelete="CASCADE"), nullable=False),
            sa.Column("customer_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
            sa.Column("reason", sa.String(length=1000), nullable=False),
            sa.Column("status", sa.String(length=20), nullable=False, server_default="PENDING"),
            sa.CheckConstraint("status IN ('PENDING', 'APPROVED', 'REJECTED')", name="ck_refund_requests_status"),
            sa.UniqueConstraint("order_id", name="uq_refund_requests_order_id"),
        )
        op.create_index("ix_refund_requests_id", "refund_requests", ["id"])
        op.create_index("ix_refund_requests_order_id", "refund_requests", ["order_id"])
        op.create_index("ix_refund_requests_customer_id", "refund_requests", ["customer_id"])
        op.create_index("ix_refund_requests_status", "refund_requests", ["status"])

    if "order_reminders" not in tables:
        op.create_table(
            "order_reminders",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("order_id", sa.Integer(), sa.ForeignKey("orders.id", ondelete="CASCADE"), nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
            sa.UniqueConstraint("order_id", name="uq_order_reminders_order_id"),
        )
        op.create_index("ix_order_reminders_id", "order_reminders", ["id"])
        op.create_index("ix_order_reminders_order_id", "order_reminders", ["order_id"])
        op.create_index("ix_order_reminders_is_active", "order_reminders", ["is_active"])


def downgrade() -> None:
    bind = op.get_bind()
    tables = set(inspect(bind).get_table_names())
    for table in ("order_reminders", "refund_requests", "reviews"):
        if table in tables:
            op.drop_table(table)
    if "orders" in tables:
        columns = {column["name"] for column in inspect(bind).get_columns("orders")}
        if "status_updated_at" in columns:
            op.drop_column("orders", "status_updated_at")
