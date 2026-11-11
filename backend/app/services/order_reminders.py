from datetime import UTC, datetime, timedelta

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import Order, OrderReminder, OrderStatus


def resolve_order_reminder(db: Session, order_id: int) -> None:
    reminder = db.scalar(
        select(OrderReminder).where(OrderReminder.order_id == order_id, OrderReminder.is_active.is_(True))
    )
    if reminder is not None:
        reminder.is_active = False


def create_stale_order_reminders(db: Session, now: datetime | None = None) -> int:
    """Create a durable reminder for every eligible order idle for more than 15 minutes."""
    now = now or datetime.now(UTC)
    cutoff = now - timedelta(minutes=15)
    existing_ids = select(OrderReminder.order_id)
    eligible = db.scalars(
        select(Order)
        .where(
            Order.status.in_([OrderStatus.PLACED, OrderStatus.ACCEPTED]),
            func.coalesce(Order.status_updated_at, Order.created_at) < cutoff,
            Order.id.not_in(existing_ids),
        )
    ).all()
    for order in eligible:
        db.add(OrderReminder(order_id=order.id, created_at=now, is_active=True))
    if eligible:
        db.commit()
    return len(eligible)
