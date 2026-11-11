from enum import Enum

from sqlalchemy import Boolean, Enum as SqlEnum, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class UserRole(str, Enum):
    CUSTOMER = "CUSTOMER"
    RESTAURANT_OWNER = "RESTAURANT_OWNER"
    DELIVERY_PARTNER = "DELIVERY_PARTNER"


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    full_name: Mapped[str] = mapped_column(String(120))
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    role: Mapped[UserRole] = mapped_column(SqlEnum(UserRole, native_enum=False))
    is_available: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    restaurants: Mapped[list["Restaurant"]] = relationship(back_populates="owner")
    saved_addresses: Mapped[list["CustomerAddress"]] = relationship(
        back_populates="customer", cascade="all, delete-orphan"
    )
    customer_orders: Mapped[list["Order"]] = relationship(
        back_populates="customer", foreign_keys="Order.customer_id"
    )
    assigned_orders: Mapped[list["Order"]] = relationship(
        back_populates="delivery_partner", foreign_keys="Order.delivery_partner_id"
    )
