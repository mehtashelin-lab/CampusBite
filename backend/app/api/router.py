from fastapi import APIRouter

from app.api.routes import auth, delivery, orders, owner, restaurants

api_router = APIRouter()
api_router.include_router(auth.router, prefix="/auth", tags=["Authentication"])
api_router.include_router(restaurants.router, prefix="/restaurants", tags=["Restaurants and menus"])
api_router.include_router(orders.router, prefix="/orders", tags=["Customer orders"])
api_router.include_router(owner.router, prefix="/owner", tags=["Restaurant owner"])
api_router.include_router(delivery.router, prefix="/delivery", tags=["Delivery partner"])
