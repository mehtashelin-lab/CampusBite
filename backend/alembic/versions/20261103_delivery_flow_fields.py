"""Add delivery addresses and partner availability."""

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect

revision = "20261103_delivery_fields"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)
    tables = set(inspector.get_table_names())

    # The first application version created tables with create_all. This guarded
    # migration upgrades those existing SQLite files while also allowing a fresh
    # database to be initialized by create_all immediately after migration.
    if "orders" in tables:
        order_columns = {column["name"] for column in inspector.get_columns("orders")}
        if "delivery_address" not in order_columns:
            op.add_column(
                "orders",
                sa.Column("delivery_address", sa.String(length=500), nullable=False, server_default=""),
            )

    if "users" in tables:
        user_columns = {column["name"] for column in inspector.get_columns("users")}
        if "is_available" not in user_columns:
            op.add_column(
                "users",
                sa.Column("is_available", sa.Boolean(), nullable=False, server_default=sa.false()),
            )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)
    tables = set(inspector.get_table_names())

    if "users" in tables and "is_available" in {column["name"] for column in inspector.get_columns("users")}:
        with op.batch_alter_table("users") as batch_op:
            batch_op.drop_column("is_available")
    if "orders" in tables and "delivery_address" in {column["name"] for column in inspector.get_columns("orders")}:
        with op.batch_alter_table("orders") as batch_op:
            batch_op.drop_column("delivery_address")
