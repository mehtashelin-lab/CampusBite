from fastapi import APIRouter, Depends, HTTPException
from datetime import UTC, datetime

from sqlalchemy import func, select

from app.api.deps import DbSession, require_role
from app.models import (
    Order, OrderReminder, OrderStatus, PaymentLedger, RefundRequest, Restaurant, Review, User, UserRole,
)
from app.schemas.order import (
    OwnerOrderResponse, OwnerOrderStatusUpdate, OwnerReminderResponse, OwnerStatsResponse,
    OrderResponse, RefundDecision, RefundRequestResponse, ReviewResponse,
)
from app.services.order_reminders import resolve_order_reminder

router = APIRouter()


def owner_order_response(order: Order) -> OwnerOrderResponse:
    data = OrderResponse.model_validate(order).model_dump()
    data["delivery_partner_name"] = order.delivery_partner.full_name if order.delivery_partner else None
    data["cancelled_at"] = order.status_updated_at if order.status == OrderStatus.CANCELLED else None
    return OwnerOrderResponse.model_validate(data)


@router.get("/orders", response_model=list[OwnerOrderResponse])
def incoming_orders(
    db: DbSession,
    owner: User = Depends(require_role(UserRole.RESTAURANT_OWNER)),
):
    query = (
        select(Order)
        .join(Restaurant, Order.restaurant_id == Restaurant.id)
        .where(Restaurant.owner_id == owner.id)
        .order_by(Order.id.desc())
    )
    return [owner_order_response(order) for order in db.scalars(query).unique()]


@router.get("/stats", response_model=OwnerStatsResponse)
def owner_stats(db: DbSession, owner: User = Depends(require_role(UserRole.RESTAURANT_OWNER))):
    orders = db.scalars(
        select(Order).join(Restaurant, Order.restaurant_id == Restaurant.id).where(Restaurant.owner_id == owner.id)
    ).all()
    excluded = {OrderStatus.CANCELLED, OrderStatus.REJECTED, OrderStatus.REFUNDED}
    active = {OrderStatus.PLACED, OrderStatus.ACCEPTED, OrderStatus.PREPARING, OrderStatus.READY,
              OrderStatus.ASSIGNED, OrderStatus.OUT_FOR_DELIVERY}
    return OwnerStatsResponse(
        total_orders=len(orders),
        placed_orders=sum(order.status == OrderStatus.PLACED for order in orders),
        active_orders=sum(order.status in active for order in orders),
        delivered_orders=sum(order.status == OrderStatus.DELIVERED for order in orders),
        gross_total_paise=sum(order.total_paise for order in orders if order.status not in excluded),
    )


@router.get("/reminders", response_model=list[OwnerReminderResponse])
def owner_reminders(db: DbSession, owner: User = Depends(require_role(UserRole.RESTAURANT_OWNER))):
    rows = db.execute(
        select(OrderReminder, Order, Restaurant)
        .join(Order, OrderReminder.order_id == Order.id)
        .join(Restaurant, Order.restaurant_id == Restaurant.id)
        .where(Restaurant.owner_id == owner.id, OrderReminder.is_active.is_(True))
        .order_by(OrderReminder.created_at)
    ).all()
    return [OwnerReminderResponse(
        id=reminder.id, order_id=order.id, restaurant_name=restaurant.name,
        status=order.status, created_at=reminder.created_at,
    ) for reminder, order, restaurant in rows]


@router.get("/reviews", response_model=list[ReviewResponse])
def owner_reviews(db: DbSession, owner: User = Depends(require_role(UserRole.RESTAURANT_OWNER))):
    rows = db.execute(
        select(Review, Restaurant, User)
        .join(Order, Review.order_id == Order.id)
        .join(Restaurant, Order.restaurant_id == Restaurant.id)
        .join(User, Review.customer_id == User.id)
        .where(Restaurant.owner_id == owner.id)
        .order_by(Review.id.desc())
    ).all()
    return [ReviewResponse(
        id=review.id, order_id=review.order_id, restaurant_id=restaurant.id,
        restaurant_name=restaurant.name, customer_name=customer.full_name,
        rating=review.rating, comment=review.comment,
    ) for review, restaurant, customer in rows]


@router.get("/refund-requests", response_model=list[RefundRequestResponse])
def owner_refund_requests(db: DbSession, owner: User = Depends(require_role(UserRole.RESTAURANT_OWNER))):
    rows = db.execute(
        select(RefundRequest, User)
        .join(Order, RefundRequest.order_id == Order.id)
        .join(Restaurant, Order.restaurant_id == Restaurant.id)
        .join(User, RefundRequest.customer_id == User.id)
        .where(Restaurant.owner_id == owner.id)
        .order_by(RefundRequest.id.desc())
    ).all()
    return [RefundRequestResponse(
        id=request.id, order_id=request.order_id, customer_name=customer.full_name,
        reason=request.reason, status=request.status,
    ) for request, customer in rows]


@router.patch("/refund-requests/{request_id}", response_model=RefundRequestResponse)
def decide_refund_request(
    request_id: int, decision: RefundDecision, db: DbSession,
    owner: User = Depends(require_role(UserRole.RESTAURANT_OWNER)),
):
    rows = db.execute(
        select(RefundRequest, Order, Restaurant, User)
        .join(Order, RefundRequest.order_id == Order.id)
        .join(Restaurant, Order.restaurant_id == Restaurant.id)
        .join(User, RefundRequest.customer_id == User.id)
        .where(RefundRequest.id == request_id, Restaurant.owner_id == owner.id)
    ).first()
    if rows is None:
        raise HTTPException(status_code=404, detail="Refund request not found.")
    request, order, _restaurant, customer = rows
    if request.status != "PENDING" or order.status != OrderStatus.DELIVERED:
        raise HTTPException(status_code=400, detail="This refund request has already been decided.")
    request.status = decision.decision
    if decision.decision == "APPROVED":
        order.status = OrderStatus.REFUNDED
        order.status_updated_at = datetime.now(UTC)
        resolve_order_reminder(db, order.id)
        db.add(PaymentLedger(
            order_id=order.id, amount_paise=order.total_paise,
            status="mock_refunded", payment_type="refund",
        ))
    db.commit()
    return RefundRequestResponse(
        id=request.id, order_id=order.id, customer_name=customer.full_name,
        reason=request.reason, status=request.status,
    )


@router.patch("/orders/{order_id}/accept", response_model=OwnerOrderResponse)
def accept_order(
    order_id: int,
    db: DbSession,
    owner: User = Depends(require_role(UserRole.RESTAURANT_OWNER)),
):
    query = (
        select(Order)
        .join(Restaurant, Order.restaurant_id == Restaurant.id)
        .where(Order.id == order_id, Restaurant.owner_id == owner.id)
    )
    order = db.scalar(query)
    if order is None:
        raise HTTPException(status_code=404, detail="Order not found.")
    if order.status != OrderStatus.PLACED:
        raise HTTPException(status_code=400, detail="Only a placed order can be accepted.")
    order.status = OrderStatus.ACCEPTED
    order.status_updated_at = datetime.now(UTC)
    resolve_order_reminder(db, order.id)
    db.commit()
    db.refresh(order)
    return owner_order_response(order)


@router.patch("/orders/{order_id}/reject", response_model=OwnerOrderResponse)
def reject_order(
    order_id: int,
    db: DbSession,
    owner: User = Depends(require_role(UserRole.RESTAURANT_OWNER)),
):
    query = (
        select(Order)
        .join(Restaurant, Order.restaurant_id == Restaurant.id)
        .where(Order.id == order_id, Restaurant.owner_id == owner.id)
    )
    order = db.scalar(query)
    if order is None:
        raise HTTPException(status_code=404, detail="Order not found.")
    if order.status != OrderStatus.PLACED:
        raise HTTPException(status_code=400, detail="Only a placed order can be rejected.")
    order.status = OrderStatus.REJECTED
    order.status_updated_at = datetime.now(UTC)
    resolve_order_reminder(db, order.id)
    db.commit()
    db.refresh(order)
    return owner_order_response(order)


@router.patch("/orders/{order_id}/status", response_model=OwnerOrderResponse)
def update_order_status(
    order_id: int,
    request: OwnerOrderStatusUpdate,
    db: DbSession,
    owner: User = Depends(require_role(UserRole.RESTAURANT_OWNER)),
):
    query = (
        select(Order)
        .join(Restaurant, Order.restaurant_id == Restaurant.id)
        .where(Order.id == order_id, Restaurant.owner_id == owner.id)
    )
    order = db.scalar(query)
    if order is None:
        raise HTTPException(status_code=404, detail="Order not found.")

    if request.status == "PREPARING":
        if order.status != OrderStatus.ACCEPTED:
            raise HTTPException(status_code=400, detail="Only an accepted order can be marked as preparing.")
        order.status = OrderStatus.PREPARING
        order.status_updated_at = datetime.now(UTC)
        resolve_order_reminder(db, order.id)
    else:
        if order.status != OrderStatus.PREPARING:
            raise HTTPException(status_code=400, detail="Only an order being prepared can be marked ready.")

        active_counts = (
            select(Order.delivery_partner_id.label("partner_id"), func.count(Order.id).label("active_count"))
            .where(Order.status.in_([OrderStatus.ASSIGNED, OrderStatus.OUT_FOR_DELIVERY]))
            .group_by(Order.delivery_partner_id)
            .subquery()
        )
        partner = db.scalar(
            select(User)
            .outerjoin(active_counts, User.id == active_counts.c.partner_id)
            .where(User.role == UserRole.DELIVERY_PARTNER, User.is_available.is_(True))
            .where(func.coalesce(active_counts.c.active_count, 0) == 0)
            .order_by(func.coalesce(active_counts.c.active_count, 0), User.id)
            .limit(1)
        )
        if partner is None:
            raise HTTPException(
                status_code=409,
                detail="No delivery partner is available. Ask a partner to switch to available, then try again.",
            )
        order.delivery_partner = partner
        # READY is immediately followed by ASSIGNED in this request.
        order.status = OrderStatus.ASSIGNED
        order.status_updated_at = datetime.now(UTC)
        resolve_order_reminder(db, order.id)

    db.commit()
    db.refresh(order)
    return owner_order_response(order)
