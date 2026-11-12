export default function RestaurantRating({ restaurant }) {
  if (!restaurant?.review_count) return <p className="restaurant-rating restaurant-rating-empty">No reviews yet</p>;
  const rating = Number(restaurant.average_rating);
  return <p className="restaurant-rating" aria-label={`${rating.toFixed(1)} out of 5 stars from ${restaurant.review_count} reviews`}>
    <span aria-hidden="true">★</span> {rating.toFixed(1)} <span className="restaurant-rating-count">· {restaurant.review_count} {restaurant.review_count === 1 ? "review" : "reviews"}</span>
  </p>;
}
