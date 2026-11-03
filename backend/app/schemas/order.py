from pydantic import BaseModel, ConfigDict, Field

from app.models.order import OrderStatus


class OrderLineCreate(BaseModel):
    menu_item_id: int
    quantity: int = Field(gt=0, le=20)


class OrderCreate(BaseModel):
    restaurant_id: int
    items: list[OrderLineCreate] = Field(min_length=1)


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
    items: list[OrderItemResponse]
    model_config = ConfigDict(from_attributes=True)


class OrderStatusResponse(BaseModel):
    id: int
    status: OrderStatus
    model_config = ConfigDict(from_attributes=True)
