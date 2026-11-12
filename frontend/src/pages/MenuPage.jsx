import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api, formatMoney } from "../api/client.js";
import Loading from "../components/Loading.jsx";
import Notice from "../components/Notice.jsx";
import RestaurantRating from "../components/RestaurantRating.jsx";
import { useCart } from "../context/CartContext.jsx";

export default function MenuPage() {
  const { restaurantId } = useParams();
  const [restaurant, setRestaurant] = useState(null);
  const [items, setItems] = useState([]);
  const [query, setQuery] = useState("");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [cartMessage, setCartMessage] = useState("");
  const { addItem, itemCount } = useCart();

  useEffect(() => {
    let active = true;
    Promise.all([api.restaurants(), api.menu(restaurantId)])
      .then(([restaurants, menu]) => {
        if (!active) return;
        setRestaurant(restaurants.find((entry) => entry.id === Number(restaurantId)) || null);
        setItems(menu);
      })
      .catch((reason) => active && setError(reason.message))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [restaurantId]);

  const filteredItems = useMemo(() => items.filter((item) => {
    const matchesName = `${item.name} ${item.description}`.toLowerCase().includes(query.toLowerCase());
    const rupees = item.price_paise / 100;
    const matchesMin = minPrice === "" || rupees >= Number(minPrice);
    const matchesMax = maxPrice === "" || rupees <= Number(maxPrice);
    return matchesName && matchesMin && matchesMax;
  }), [items, query, minPrice, maxPrice]);

  function handleAdd(item) {
    if (!restaurant) return;
    const added = addItem(item, restaurant);
    setCartMessage(added ? `${item.name} added to your cart.` : "Your cart has items from another restaurant. Finish that order or clear your cart first.");
    window.setTimeout(() => setCartMessage(""), 4000);
  }

  if (loading) return <section className="section-wrap"><Loading label="Loading menu" /></section>;

  return (
    <section className="section-wrap menu-page">
      <Link className="back-link" to="/">← All restaurants</Link>
      <div className="menu-heading"><div><p className="eyebrow">Today’s menu</p><h1>{restaurant?.name || "Restaurant menu"}</h1><p>{restaurant?.description}</p>{restaurant && <RestaurantRating restaurant={restaurant} />}</div><Link className="button button-outline" to="/cart">View cart <span className="button-count">{itemCount}</span></Link></div>
      <Notice>{error}</Notice><Notice tone="success">{cartMessage}</Notice>
      <div className="menu-filters">
        <label className="search-field"><span aria-hidden="true">⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search dishes" aria-label="Search dishes" /></label>
        <label className="price-filter">Min ₹<input type="number" min="0" value={minPrice} onChange={(event) => setMinPrice(event.target.value)} placeholder="0" /></label>
        <label className="price-filter">Max ₹<input type="number" min="0" value={maxPrice} onChange={(event) => setMaxPrice(event.target.value)} placeholder="Any" /></label>
      </div>
      {filteredItems.length ? <div className="menu-grid">
        {filteredItems.map((item, index) => <article className="menu-card" key={item.id}>
          <div className={`dish-art dish-${index % 4}`}><span>{["BOWL", "FRESH", "FAVOURITE", "TODAY"][index % 4]}</span><i aria-hidden="true">{["◉", "✿", "◌", "✳"][index % 4]}</i></div>
          <div className="menu-card-body"><div className="menu-card-title"><h3>{item.name}</h3><strong>{formatMoney(item.price_paise)}</strong></div><p>{item.description || "Made fresh for you."}</p><button className="button button-small button-add" onClick={() => handleAdd(item)}>Add to cart <span aria-hidden="true">+</span></button></div>
        </article>)}
      </div> : <div className="empty-state"><h3>{items.length ? "No dishes match those filters" : "This menu is empty"}</h3><p>{items.length ? "Change your search or price range." : "Check back later for new dishes."}</p></div>}
    </section>
  );
}
