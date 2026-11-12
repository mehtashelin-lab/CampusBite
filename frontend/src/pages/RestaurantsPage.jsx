import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client.js";
import Loading from "../components/Loading.jsx";
import Notice from "../components/Notice.jsx";
import RestaurantRating from "../components/RestaurantRating.jsx";

const accents = ["coral", "sage", "gold", "blue"];

export default function RestaurantsPage() {
  const [restaurants, setRestaurants] = useState([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    api.restaurants()
      .then((data) => active && setRestaurants(data))
      .catch((reason) => active && setError(reason.message))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, []);

  const filtered = useMemo(
    () => restaurants.filter((restaurant) => `${restaurant.name} ${restaurant.description}`.toLowerCase().includes(query.toLowerCase())),
    [restaurants, query],
  );

  return (
    <>
      <section className="hero">
        <div className="hero-copy">
          <p className="eyebrow">Fulfill your roadside cravings</p>
          <h1>Roadside Food.<br /><span>From across the city.</span></h1>
          <p className="hero-description">Explore roadside food stalls, discover something new and order to make your day</p>
          <a className="button" href="#restaurants">Explore restaurants <span aria-hidden="true">↓</span></a>
        </div>
        <div className="hero-art" aria-hidden="true">
          <div className="hero-orbit orbit-one" /><div className="hero-orbit orbit-two" />
          <div className="plate">
            <img className="plate-food-image" src="/roadside-stall-vendor.png" alt="" />
            <span className="stall-sign">CampusBite</span>
          </div>
          <span className="hero-sticker sticker-top">FRESH<br />& LOCAL</span>
          <span className="hero-sticker sticker-bottom">YOUR<br />CRAVINGS<br />FULFILLED</span>
        </div>
      </section>

      <section className="section-wrap" id="restaurants">
        <div className="section-heading">
          <div><p className="eyebrow">Made for your day</p><h2>Find your kind of food</h2></div>
          <label className="search-field"><span aria-hidden="true">⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search restaurants" aria-label="Search restaurants" /></label>
        </div>
        <Notice>{error}</Notice>
        {loading ? <Loading label="Finding restaurants" /> : filtered.length ? (
          <div className="restaurant-grid">
            {filtered.map((restaurant, index) => (
              <Link className="restaurant-card" to={`/restaurants/${restaurant.id}`} key={restaurant.id}>
                <div className={`restaurant-art art-${accents[index % accents.length]}`}>
                  <span className="art-number">{String(index + 1).padStart(2, "0")}</span>
                  <span className="art-symbol" aria-hidden="true">{["✳", "◒", "✦", "◈"][index % 4]}</span>
                  <span className="art-label">CAMPUS<br />FAVOURITE</span>
                </div>
                <div className="restaurant-card-info"><div><h3>{restaurant.name}</h3><p>{restaurant.description || "Fresh picks and campus favourites"}</p><RestaurantRating restaurant={restaurant} /></div><span className="arrow-round" aria-hidden="true">↗</span></div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="empty-state"><span className="empty-icon">⌕</span><h3>{query ? "No matches yet" : "No restaurants listed yet"}</h3><p>{query ? "Try another search." : "Restaurant owners can add a restaurant from their dashboard."}</p></div>
        )}
      </section>
      <section className="bottom-banner"><div><p className="eyebrow">A note for owners</p><h2>Bring your menu<br />to CampusBite.</h2></div><Link className="button button-light" to="/register">Create an owner account <span aria-hidden="true">↗</span></Link></section>
    </>
  );
}
