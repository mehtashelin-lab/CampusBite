"""Add order creation dates and enforce one restaurant per owner."""

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect

revision = "20261111_order_dates_owner_limit"
down_revision = "20261103_delivery_fields"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)
    tables = set(inspector.get_table_names())

    if "orders" in tables:
        columns = {column["name"] for column in inspector.get_columns("orders")}
        if "created_at" not in columns:
            op.add_column("orders", sa.Column("created_at", sa.DateTime(timezone=True), nullable=True))
            # SQLite's ALTER TABLE does not accept CURRENT_TIMESTAMP as a default.
            # Backfill existing orders, then enforce non-null for future rows.
            op.execute(sa.text("UPDATE orders SET created_at = CURRENT_TIMESTAMP WHERE created_at IS NULL"))
            with op.batch_alter_table("orders") as batch_op:
                batch_op.alter_column(
                    "created_at",
                    existing_type=sa.DateTime(timezone=True),
                    nullable=False,
                )

    if "restaurants" in tables:
        indexes = {index["name"] for index in inspector.get_indexes("restaurants")}
        if "uq_restaurants_owner_id" not in indexes:
            op.create_index("uq_restaurants_owner_id", "restaurants", ["owner_id"], unique=True)


def downgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)
    tables = set(inspector.get_table_names())

    if "restaurants" in tables:
        indexes = {index["name"] for index in inspector.get_indexes("restaurants")}
        if "uq_restaurants_owner_id" in indexes:
            op.drop_index("uq_restaurants_owner_id", table_name="restaurants")

    if "orders" in tables:
        columns = {column["name"] for column in inspector.get_columns("orders")}
        if "created_at" in columns:
            with op.batch_alter_table("orders") as batch_op:
                batch_op.drop_column("created_at")
