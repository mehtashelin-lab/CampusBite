from datetime import UTC, datetime
from enum import Enum

from sqlalchemy import DateTime, Enum as SqlEnum, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class OrderStatus(str, Enum):
    PLACED = "PLACED"
    ACCEPTED = "ACCEPTED"
    PREPARING = "PREPARING"
    READY = "READY"
    ASSIGNED = "ASSIGNED"
    OUT_FOR_DELIVERY = "OUT_FOR_DELIVERY"
    DELIVERED = "DELIVERED"
    CANCELLED = "CANCELLED"
    REJECTED = "REJECTED"
    REFUNDED = "REFUNDED"


class Order(Base):
    __tablename__ = "orders"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    customer_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    restaurant_id: Mapped[int] = mapped_column(ForeignKey("restaurants.id"), index=True)
    delivery_partner_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    delivery_address: Mapped[str] = mapped_column(String(500), default="", nullable=False)
    status: Mapped[OrderStatus] = mapped_column(
        SqlEnum(OrderStatus, native_enum=False), default=OrderStatus.PLACED, index=True
    )
    total_paise: Mapped[int] = mapped_column(Integer)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC), nullable=False
    )
    delivered_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    status_updated_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC), nullable=True
    )

    customer: Mapped["User"] = relationship(
        back_populates="customer_orders", foreign_keys=[customer_id]
    )
    delivery_partner: Mapped["User | None"] = relationship(
        back_populates="assigned_orders", foreign_keys=[delivery_partner_id]
    )
    restaurant: Mapped["Restaurant"] = relationship(back_populates="orders")
    items: Mapped[list["OrderItem"]] = relationship(back_populates="order", cascade="all, delete-orphan")
    payment_entries: Mapped[list["PaymentLedger"]] = relationship(
        back_populates="order", cascade="all, delete-orphan"
    )

    @property
    def delivery_partner_name(self) -> str | None:
        return self.delivery_partner.full_name if self.delivery_partner else None


class OrderItem(Base):
    __tablename__ = "order_items"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    order_id: Mapped[int] = mapped_column(ForeignKey("orders.id"), index=True)
    menu_item_id: Mapped[int] = mapped_column(ForeignKey("menu_items.id"))
    item_name: Mapped[str] = mapped_column(String(160))
    unit_price_paise: Mapped[int] = mapped_column(Integer)
    quantity: Mapped[int] = mapped_column(Integer)

    order: Mapped["Order"] = relationship(back_populates="items")


class PaymentLedger(Base):
    __tablename__ = "payment_ledger"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    order_id: Mapped[int] = mapped_column(ForeignKey("orders.id"), index=True)
    amount_paise: Mapped[int] = mapped_column(Integer)
    status: Mapped[str] = mapped_column(String(30), default="mock_paid")
    payment_type: Mapped[str] = mapped_column(String(30), default="payment")

    order: Mapped["Order"] = relationship(back_populates="payment_entries")
