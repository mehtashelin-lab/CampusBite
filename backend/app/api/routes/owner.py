from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select

from app.api.deps import DbSession, require_role
from app.models import Order, OrderStatus, Restaurant, User, UserRole
from app.schemas.order import OrderResponse

router = APIRouter()


@router.get("/orders", response_model=list[OrderResponse])
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
    return list(db.scalars(query).unique())


@router.patch("/orders/{order_id}/accept", response_model=OrderResponse)
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
    db.commit()
    db.refresh(order)
    return order


@router.patch("/orders/{order_id}/reject", response_model=OrderResponse)
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
    db.commit()
    db.refresh(order)
    return order
