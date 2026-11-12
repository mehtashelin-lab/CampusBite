from pydantic import BaseModel, ConfigDict, Field


class RestaurantCreate(BaseModel):
    name: str = Field(min_length=2, max_length=160)
    description: str = Field(default="", max_length=500)


class RestaurantResponse(BaseModel):
    id: int
    name: str
    description: str
    is_active: bool
    model_config = ConfigDict(from_attributes=True)


class PublicRestaurantResponse(RestaurantResponse):
    average_rating: float | None
    review_count: int


class MenuItemCreate(BaseModel):
    name: str = Field(min_length=2, max_length=160)
    description: str = Field(default="", max_length=500)
    price_paise: int = Field(gt=0)


class MenuItemUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=160)
    description: str | None = Field(default=None, max_length=500)
    price_paise: int | None = Field(default=None, gt=0)
    is_available: bool | None = None


class MenuItemResponse(BaseModel):
    id: int
    restaurant_id: int
    name: str
    description: str
    price_paise: int
    is_available: bool
    model_config = ConfigDict(from_attributes=True)
