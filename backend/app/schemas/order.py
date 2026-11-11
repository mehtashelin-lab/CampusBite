from datetime import UTC, datetime

from pydantic import BaseModel, ConfigDict, Field, field_serializer, field_validator

from app.models.order import OrderStatus


class OrderLineCreate(BaseModel):
    menu_item_id: int
    quantity: int = Field(gt=0, le=20)


class OrderCreate(BaseModel):
    restaurant_id: int
    delivery_address: str = Field(min_length=5, max_length=500)
    items: list[OrderLineCreate] = Field(min_length=1)

    @field_validator("delivery_address")
    @classmethod
    def trim_delivery_address(cls, value: str) -> str:
        value = value.strip()
        if len(value) < 5:
            raise ValueError("Enter a delivery address with at least 5 characters.")
        return value


class OrderItemResponse(BaseModel):
    id: int
    menu_item_id: int
    item_name: str
    unit_price_paise: int
    quantity: int
    model_config = ConfigDict(from_attributes=True)


class OrderResponse(BaseModel):
    id: int
    customer_id: int
    restaurant_id: int
    status: OrderStatus
    total_paise: int
    created_at: datetime
    delivered_at: datetime | None = None
    items: list[OrderItemResponse]
    model_config = ConfigDict(from_attributes=True)

    @field_serializer("created_at", "delivered_at")
    def serialize_timestamps(self, value: datetime | None) -> str | None:
        if value is None:
            return None
        # SQLite drops timezone metadata for DateTime columns; timestamps are stored as UTC.
        if value.tzinfo is None:
            value = value.replace(tzinfo=UTC)
        return value.isoformat()


class CustomerOrderResponse(OrderResponse):
    delivery_address: str
    delivery_partner_name: str | None = None


class CustomerAddressCreate(BaseModel):
    address: str = Field(min_length=5, max_length=500)

    @field_validator("address")
    @classmethod
    def trim_address(cls, value: str) -> str:
        value = value.strip()
        if len(value) < 5:
            raise ValueError("Enter an address with at least 5 characters.")
        return value


class CustomerAddressResponse(BaseModel):
    id: int
    address: str
    model_config = ConfigDict(from_attributes=True)


class OwnerOrderResponse(OrderResponse):
    delivery_partner_name: str | None = None


class DeliveryPartnerOrderResponse(OrderResponse):
    customer_name: str
    restaurant_name: str
    delivery_address: str
    delivery_partner_name: str | None = None


class OwnerOrderStatusUpdate(BaseModel):
    status: str = Field(pattern="^(PREPARING|READY)$")


class DeliveryOrderStatusUpdate(BaseModel):
    status: str = Field(pattern="^(OUT_FOR_DELIVERY|DELIVERED)$")


class DeliveryAvailabilityUpdate(BaseModel):
    is_available: bool


class DeliveryAvailabilityResponse(BaseModel):
    is_available: bool


class OrderStatusResponse(BaseModel):
    id: int
    status: OrderStatus
    delivered_at: datetime | None = None
    delivery_partner_name: str | None = None
    model_config = ConfigDict(from_attributes=True)

    @field_serializer("delivered_at")
    def serialize_delivered_at(self, value: datetime | None) -> str | None:
        if value is None:
            return None
        if value.tzinfo is None:
            value = value.replace(tzinfo=UTC)
        return value.isoformat()


class ReviewCreate(BaseModel):
    rating: int = Field(ge=1, le=5)
    comment: str = Field(default="", max_length=1000)

    @field_validator("comment")
    @classmethod
    def trim_comment(cls, value: str) -> str:
        return value.strip()


class ReviewResponse(BaseModel):
    id: int
    order_id: int
    restaurant_id: int
    restaurant_name: str
    customer_name: str
    rating: int
    comment: str


class RefundRequestCreate(BaseModel):
    reason: str = Field(min_length=3, max_length=1000)

    @field_validator("reason")
    @classmethod
    def trim_reason(cls, value: str) -> str:
        value = value.strip()
        if len(value) < 3:
            raise ValueError("Please provide a reason with at least 3 characters.")
        return value


class RefundDecision(BaseModel):
    decision: str = Field(pattern="^(APPROVED|REJECTED)$")


class RefundRequestResponse(BaseModel):
    id: int
    order_id: int
    customer_name: str
    reason: str
    status: str


class OwnerStatsResponse(BaseModel):
    total_orders: int
    placed_orders: int
    active_orders: int
    delivered_orders: int
    gross_total_paise: int


class OwnerReminderResponse(BaseModel):
    id: int
    order_id: int
    restaurant_name: str
    status: OrderStatus
    created_at: datetime

    @field_serializer("created_at")
    def serialize_created_at(self, value: datetime) -> str:
        if value.tzinfo is None:
            value = value.replace(tzinfo=UTC)
        return value.isoformat()
