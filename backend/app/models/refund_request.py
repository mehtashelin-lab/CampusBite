from sqlalchemy import CheckConstraint, ForeignKey, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class RefundRequest(Base):
    __tablename__ = "refund_requests"
    __table_args__ = (
        UniqueConstraint("order_id", name="uq_refund_requests_order_id"),
        CheckConstraint("status IN ('PENDING', 'APPROVED', 'REJECTED')", name="ck_refund_requests_status"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    order_id: Mapped[int] = mapped_column(ForeignKey("orders.id", ondelete="CASCADE"), nullable=False, index=True)
    customer_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    reason: Mapped[str] = mapped_column(String(1000), nullable=False)
    status: Mapped[str] = mapped_column(String(20), default="PENDING", nullable=False, index=True)

    order: Mapped["Order"] = relationship()
    customer: Mapped["User"] = relationship()
