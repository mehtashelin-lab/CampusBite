from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select

from app.api.deps import DbSession, require_role
from app.models import Order, OrderStatus, User, UserRole
from app.schemas.order import (
    DeliveryAvailabilityResponse,
    DeliveryAvailabilityUpdate,
    DeliveryOrderStatusUpdate,
    DeliveryPartnerOrderResponse,
    OrderResponse,
    OrderStatusResponse,
)
from app.services.order_reminders import resolve_order_reminder

router = APIRouter()


def delivery_order_response(order: Order) -> DeliveryPartnerOrderResponse:
    data = OrderResponse.model_validate(order).model_dump()
    # Refund status is financial; the partner dashboard shows fulfillment progress.
    if order.status == OrderStatus.REFUNDED:
        data["status"] = OrderStatus.DELIVERED
    data.update(
        customer_name=order.customer.full_name,
        restaurant_name=order.restaurant.name,
        delivery_address=order.delivery_address,
        delivery_partner_name=order.delivery_partner.full_name if order.delivery_partner else None,
    )
    return DeliveryPartnerOrderResponse.model_validate(data)


@router.get("/availability", response_model=DeliveryAvailabilityResponse)
def get_availability(
    partner: User = Depends(require_role(UserRole.DELIVERY_PARTNER)),
):
    return DeliveryAvailabilityResponse(is_available=partner.is_available)


@router.patch("/availability", response_model=DeliveryAvailabilityResponse)
def update_availability(
    request: DeliveryAvailabilityUpdate,
    db: DbSession,
    partner: User = Depends(require_role(UserRole.DELIVERY_PARTNER)),
):
    partner.is_available = request.is_available
    db.commit()
    db.refresh(partner)
    return DeliveryAvailabilityResponse(is_available=partner.is_available)


@router.get("/orders", response_model=list[DeliveryPartnerOrderResponse])
def assigned_orders(
    db: DbSession,
    partner: User = Depends(require_role(UserRole.DELIVERY_PARTNER)),
):
    query = (
        select(Order)
        .where(Order.delivery_partner_id == partner.id)
        .order_by(Order.id.desc())
    )
    return [delivery_order_response(order) for order in db.scalars(query).unique()]


@router.patch("/orders/{order_id}/status", response_model=OrderStatusResponse)
def update_delivery_status(
    order_id: int,
    request: DeliveryOrderStatusUpdate,
    db: DbSession,
    partner: User = Depends(require_role(UserRole.DELIVERY_PARTNER)),
):
    order = db.get(Order, order_id)
    if order is None or order.delivery_partner_id != partner.id:
        raise HTTPException(status_code=404, detail="Order not found.")

    allowed_transition = (
        order.status == OrderStatus.ASSIGNED and request.status == "OUT_FOR_DELIVERY"
    ) or (
        order.status == OrderStatus.OUT_FOR_DELIVERY and request.status == "DELIVERED"
    )
    if not allowed_transition:
        raise HTTPException(status_code=400, detail="This delivery status change is not allowed.")

    order.status = OrderStatus(request.status)
    order.status_updated_at = datetime.now(UTC)
    if order.status == OrderStatus.DELIVERED:
        order.delivered_at = datetime.now(UTC)
    resolve_order_reminder(db, order.id)
    db.commit()
    db.refresh(order)
    return order
