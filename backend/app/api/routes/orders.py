from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select

from app.api.deps import DbSession, require_role
from app.models import MenuItem, Order, OrderItem, OrderStatus, PaymentLedger, Restaurant, User, UserRole
from app.schemas.order import OrderCreate, OrderResponse, OrderStatusResponse

router = APIRouter()


@router.post("", response_model=OrderResponse, status_code=status.HTTP_201_CREATED)
def place_order(
    request: OrderCreate,
    db: DbSession,
    customer: User = Depends(require_role(UserRole.CUSTOMER)),
):
    restaurant = db.get(Restaurant, request.restaurant_id)
    if restaurant is None or not restaurant.is_active:
        raise HTTPException(status_code=404, detail="Restaurant not found.")
    if restaurant.owner_id == customer.id:
        raise HTTPException(status_code=403, detail="You cannot order from your own restaurant.")

    menu_item_ids = [line.menu_item_id for line in request.items]
    if len(menu_item_ids) != len(set(menu_item_ids)):
        raise HTTPException(status_code=400, detail="Add each dish once and set its quantity.")

    menu_items = db.scalars(
        select(MenuItem).where(
            MenuItem.id.in_(menu_item_ids),
            MenuItem.restaurant_id == restaurant.id,
            MenuItem.is_available.is_(True),
        )
    ).all()
    items_by_id = {item.id: item for item in menu_items}
    if len(items_by_id) != len(menu_item_ids):
        raise HTTPException(status_code=400, detail="A dish is unavailable or not part of this restaurant.")

    total_paise = sum(items_by_id[line.menu_item_id].price_paise * line.quantity for line in request.items)
    order = Order(
        customer_id=customer.id,
        restaurant_id=restaurant.id,
        status=OrderStatus.PLACED,
        total_paise=total_paise,
    )
    for line in request.items:
        item = items_by_id[line.menu_item_id]
        order.items.append(
            OrderItem(
                menu_item_id=item.id,
                item_name=item.name,
                unit_price_paise=item.price_paise,
                quantity=line.quantity,
            )
        )
    order.payment_entries.append(
        PaymentLedger(amount_paise=total_paise, status="mock_paid", payment_type="payment")
    )
    db.add(order)
    db.commit()
    db.refresh(order)
    return order


@router.get("/me", response_model=list[OrderResponse])
def my_orders(
    db: DbSession,
    customer: User = Depends(require_role(UserRole.CUSTOMER)),
):
    return list(
        db.scalars(
            select(Order)
            .where(Order.customer_id == customer.id)
            .order_by(Order.id.desc())
        ).unique()
    )


@router.patch("/{order_id}/cancel", response_model=OrderStatusResponse)
def cancel_order(
    order_id: int,
    db: DbSession,
    customer: User = Depends(require_role(UserRole.CUSTOMER)),
):
    order = db.get(Order, order_id)
    if order is None or order.customer_id != customer.id:
        raise HTTPException(status_code=404, detail="Order not found.")
    if order.status != OrderStatus.PLACED:
        raise HTTPException(status_code=400, detail="Only a placed order can be cancelled.")
    order.status = OrderStatus.CANCELLED
    db.commit()
    db.refresh(order)
    return order
