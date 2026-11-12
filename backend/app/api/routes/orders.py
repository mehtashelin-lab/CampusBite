from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import joinedload, selectinload

from app.api.deps import DbSession, require_role
from app.models import CustomerAddress, MenuItem, Order, OrderItem, OrderStatus, PaymentLedger, RefundRequest, Restaurant, Review, User, UserRole
from app.schemas.order import (
    CustomerAddressCreate,
    CustomerAddressResponse,
    CustomerOrderResponse,
    OrderCreate,
    RefundRequestCreate,
    RefundRequestResponse,
    ReviewCreate,
    ReviewResponse,
    OrderStatusResponse,
)
from app.schemas.insight import InsightAnswer, InsightQuestion
from app.services.order_insights import (
    InsightRateLimited,
    InsightUnavailable,
    generate_order_insight,
)
from app.services.order_reminders import resolve_order_reminder
from app.core.config import settings

router = APIRouter()
MAX_CUSTOMER_ADDRESSES = 5
ORDER_INSIGHT_HISTORY_LIMIT = 20


@router.post("/insights", response_model=InsightAnswer)
def ask_about_order_history(
    request: InsightQuestion,
    db: DbSession,
    customer: User = Depends(require_role(UserRole.CUSTOMER)),
):
    if not settings.openai_api_key.strip():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Order insights are unavailable because the AI service is not configured.",
        )
    orders = list(
        db.scalars(
            select(Order)
            .where(Order.customer_id == customer.id)
            .options(selectinload(Order.items), joinedload(Order.restaurant))
            .order_by(Order.created_at.desc(), Order.id.desc())
            .limit(ORDER_INSIGHT_HISTORY_LIMIT)
        ).unique()
    )
    if not orders:
        return InsightAnswer(answer="You do not have any orders yet. Place an order, then ask again.")

    context = [
        {
            "date": order.created_at.isoformat(),
            "status": order.status.value,
            "restaurant": order.restaurant.name,
            "total_rupees": round(order.total_paise / 100, 2),
            "items": [
                {
                    "name": item.item_name,
                    "quantity": item.quantity,
                    "unit_price_rupees": round(item.unit_price_paise / 100, 2),
                }
                for item in order.items
            ],
        }
        for order in orders
    ]
    try:
        answer = generate_order_insight(
            request.question, context, settings.openai_api_key, settings.openai_model
        )
    except InsightRateLimited:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Order insights are temporarily rate-limited. Please try again later.",
        )
    except InsightUnavailable:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Order insights are temporarily unavailable. Please try again later.",
        )
    return InsightAnswer(answer=answer)


def get_or_create_address(db: DbSession, customer: User, address: str) -> CustomerAddress:
    saved_address = db.scalar(
        select(CustomerAddress).where(
            CustomerAddress.customer_id == customer.id,
            CustomerAddress.address == address,
        )
    )
    if saved_address is not None:
        return saved_address

    address_count = db.scalar(
        select(func.count(CustomerAddress.id)).where(CustomerAddress.customer_id == customer.id)
    )
    if address_count >= MAX_CUSTOMER_ADDRESSES:
        raise HTTPException(
            status_code=409,
            detail="You have five saved addresses. Remove one before adding another.",
        )
    saved_address = CustomerAddress(customer_id=customer.id, address=address)
    db.add(saved_address)
    db.flush()
    return saved_address


@router.get("/addresses", response_model=list[CustomerAddressResponse])
def list_customer_addresses(
    db: DbSession,
    customer: User = Depends(require_role(UserRole.CUSTOMER)),
):
    return list(
        db.scalars(
            select(CustomerAddress)
            .where(CustomerAddress.customer_id == customer.id)
            .order_by(CustomerAddress.created_at.desc(), CustomerAddress.id.desc())
        )
    )


@router.post("/addresses", response_model=CustomerAddressResponse, status_code=status.HTTP_201_CREATED)
def add_customer_address(
    request: CustomerAddressCreate,
    db: DbSession,
    customer: User = Depends(require_role(UserRole.CUSTOMER)),
):
    address = get_or_create_address(db, customer, request.address)
    db.commit()
    db.refresh(address)
    return address


@router.delete("/addresses/{address_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_customer_address(
    address_id: int,
    db: DbSession,
    customer: User = Depends(require_role(UserRole.CUSTOMER)),
):
    address = db.scalar(
        select(CustomerAddress).where(
            CustomerAddress.id == address_id,
            CustomerAddress.customer_id == customer.id,
        )
    )
    if address is None:
        raise HTTPException(status_code=404, detail="Saved address not found.")
    db.delete(address)
    db.commit()


@router.post("", response_model=CustomerOrderResponse, status_code=status.HTTP_201_CREATED)
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

    get_or_create_address(db, customer, request.delivery_address)
    total_paise = sum(items_by_id[line.menu_item_id].price_paise * line.quantity for line in request.items)
    order = Order(
        customer_id=customer.id,
        restaurant_id=restaurant.id,
        delivery_address=request.delivery_address,
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


@router.get("/me", response_model=list[CustomerOrderResponse])
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


@router.get("/reviews/me", response_model=list[ReviewResponse])
def my_reviews(db: DbSession, customer: User = Depends(require_role(UserRole.CUSTOMER))):
    rows = db.execute(
        select(Review, Restaurant)
        .join(Order, Review.order_id == Order.id)
        .join(Restaurant, Order.restaurant_id == Restaurant.id)
        .where(Review.customer_id == customer.id)
        .order_by(Review.id.desc())
    ).all()
    return [ReviewResponse(
        id=review.id, order_id=review.order_id, restaurant_id=restaurant.id,
        restaurant_name=restaurant.name, customer_name=customer.full_name,
        rating=review.rating, comment=review.comment,
    ) for review, restaurant in rows]


@router.post("/{order_id}/review", response_model=ReviewResponse, status_code=status.HTTP_201_CREATED)
def create_review(
    order_id: int, request: ReviewCreate, db: DbSession,
    customer: User = Depends(require_role(UserRole.CUSTOMER)),
):
    order = db.scalar(
        select(Order).where(Order.id == order_id, Order.customer_id == customer.id)
    )
    if order is None:
        raise HTTPException(status_code=404, detail="Order not found.")
    if order.status != OrderStatus.DELIVERED:
        raise HTTPException(status_code=400, detail="Only delivered orders can be reviewed.")
    if db.scalar(select(Review.id).where(Review.order_id == order.id)) is not None:
        raise HTTPException(status_code=409, detail="You have already reviewed this order.")
    review = Review(
        order_id=order.id, customer_id=customer.id,
        rating=request.rating, comment=request.comment,
    )
    db.add(review)
    db.commit()
    db.refresh(review)
    restaurant = db.get(Restaurant, order.restaurant_id)
    return ReviewResponse(
        id=review.id, order_id=order.id, restaurant_id=restaurant.id,
        restaurant_name=restaurant.name, customer_name=customer.full_name,
        rating=review.rating, comment=review.comment,
    )


@router.get("/refund-requests/me", response_model=list[RefundRequestResponse])
def my_refund_requests(db: DbSession, customer: User = Depends(require_role(UserRole.CUSTOMER))):
    rows = db.execute(
        select(RefundRequest, User)
        .join(User, RefundRequest.customer_id == User.id)
        .where(RefundRequest.customer_id == customer.id)
        .order_by(RefundRequest.id.desc())
    ).all()
    return [RefundRequestResponse(
        id=request.id, order_id=request.order_id, customer_name=account.full_name,
        reason=request.reason, status=request.status,
    ) for request, account in rows]


@router.post("/{order_id}/refund-request", response_model=RefundRequestResponse, status_code=status.HTTP_201_CREATED)
def create_refund_request(
    order_id: int, request: RefundRequestCreate, db: DbSession,
    customer: User = Depends(require_role(UserRole.CUSTOMER)),
):
    order = db.scalar(
        select(Order).where(Order.id == order_id, Order.customer_id == customer.id)
    )
    if order is None:
        raise HTTPException(status_code=404, detail="Order not found.")
    if order.status != OrderStatus.DELIVERED:
        raise HTTPException(status_code=400, detail="Only delivered orders can have a refund request.")
    if db.scalar(select(RefundRequest.id).where(RefundRequest.order_id == order.id)) is not None:
        raise HTTPException(status_code=409, detail="A refund request already exists for this order.")
    refund = RefundRequest(
        order_id=order.id, customer_id=customer.id, reason=request.reason,
    )
    db.add(refund)
    db.commit()
    db.refresh(refund)
    return RefundRequestResponse(
        id=refund.id, order_id=order.id, customer_name=customer.full_name,
        reason=refund.reason, status=refund.status,
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
    order.status_updated_at = datetime.now(UTC)
    resolve_order_reminder(db, order.id)
    db.commit()
    db.refresh(order)
    return order
