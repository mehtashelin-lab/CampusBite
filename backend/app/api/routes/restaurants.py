from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select

from app.api.deps import DbSession, require_role
from app.models import MenuItem, Restaurant, User, UserRole
from app.schemas.restaurant import (
    MenuItemCreate,
    MenuItemResponse,
    MenuItemUpdate,
    RestaurantCreate,
    RestaurantResponse,
)

router = APIRouter()


@router.get("", response_model=list[RestaurantResponse])
def list_restaurants(db: DbSession):
    return list(db.scalars(select(Restaurant).where(Restaurant.is_active.is_(True)).order_by(Restaurant.name)))


@router.get("/mine", response_model=list[RestaurantResponse])
def list_my_restaurants(
    db: DbSession,
    owner: User = Depends(require_role(UserRole.RESTAURANT_OWNER)),
):
    """Return only restaurants owned by the logged-in restaurant owner."""
    query = select(Restaurant).where(Restaurant.owner_id == owner.id).order_by(Restaurant.name)
    return list(db.scalars(query))


@router.post("", response_model=RestaurantResponse, status_code=status.HTTP_201_CREATED)
def create_restaurant(
    request: RestaurantCreate,
    db: DbSession,
    owner: User = Depends(require_role(UserRole.RESTAURANT_OWNER)),
):
    existing_restaurant = db.scalar(select(Restaurant.id).where(Restaurant.owner_id == owner.id))
    if existing_restaurant is not None:
        raise HTTPException(status_code=409, detail="Each owner can create only one restaurant.")
    restaurant = Restaurant(owner_id=owner.id, name=request.name, description=request.description)
    db.add(restaurant)
    db.commit()
    db.refresh(restaurant)
    return restaurant


@router.get("/{restaurant_id}/menu", response_model=list[MenuItemResponse])
def list_menu(restaurant_id: int, db: DbSession):
    restaurant = db.get(Restaurant, restaurant_id)
    if restaurant is None or not restaurant.is_active:
        raise HTTPException(status_code=404, detail="Restaurant not found.")
    query = select(MenuItem).where(
        MenuItem.restaurant_id == restaurant_id,
        MenuItem.is_available.is_(True),
    ).order_by(MenuItem.name)
    return list(db.scalars(query))


@router.get("/{restaurant_id}/menu/manage", response_model=list[MenuItemResponse])
def manage_menu(
    restaurant_id: int,
    db: DbSession,
    owner: User = Depends(require_role(UserRole.RESTAURANT_OWNER)),
):
    restaurant = db.get(Restaurant, restaurant_id)
    if restaurant is None or restaurant.owner_id != owner.id:
        raise HTTPException(status_code=404, detail="Restaurant not found.")
    return list(db.scalars(
        select(MenuItem).where(MenuItem.restaurant_id == restaurant_id).order_by(MenuItem.name)
    ))


@router.post("/{restaurant_id}/menu", response_model=MenuItemResponse, status_code=status.HTTP_201_CREATED)
def create_menu_item(
    restaurant_id: int,
    request: MenuItemCreate,
    db: DbSession,
    owner: User = Depends(require_role(UserRole.RESTAURANT_OWNER)),
):
    restaurant = db.get(Restaurant, restaurant_id)
    if restaurant is None or restaurant.owner_id != owner.id:
        raise HTTPException(status_code=404, detail="Restaurant not found.")
    item = MenuItem(restaurant_id=restaurant_id, **request.model_dump())
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


@router.patch("/{restaurant_id}/menu/{item_id}", response_model=MenuItemResponse)
def update_menu_item(
    restaurant_id: int,
    item_id: int,
    request: MenuItemUpdate,
    db: DbSession,
    owner: User = Depends(require_role(UserRole.RESTAURANT_OWNER)),
):
    restaurant = db.get(Restaurant, restaurant_id)
    if restaurant is None or restaurant.owner_id != owner.id:
        raise HTTPException(status_code=404, detail="Restaurant not found.")
    item = db.get(MenuItem, item_id)
    if item is None or item.restaurant_id != restaurant.id:
        raise HTTPException(status_code=404, detail="Menu item not found.")
    for field, value in request.model_dump(exclude_unset=True, exclude_none=True).items():
        setattr(item, field, value)
    db.commit()
    db.refresh(item)
    return item
