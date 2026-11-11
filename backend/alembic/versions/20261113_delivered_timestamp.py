"""Record when an order is delivered."""

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect

revision = "20261113_delivered_timestamp"
down_revision = "20261112_customer_addresses"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    tables = set(inspect(bind).get_table_names())
    if "orders" not in tables:
        return
    columns = {column["name"] for column in inspect(bind).get_columns("orders")}
    if "delivered_at" not in columns:
        op.add_column("orders", sa.Column("delivered_at", sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    bind = op.get_bind()
    if "orders" not in inspect(bind).get_table_names():
        return
    columns = {column["name"] for column in inspect(bind).get_columns("orders")}
    if "delivered_at" in columns:
        op.drop_column("orders", "delivered_at")
