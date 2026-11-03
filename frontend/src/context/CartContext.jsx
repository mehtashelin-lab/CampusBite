import { createContext, useContext, useEffect, useMemo, useState } from "react";

const STORAGE_KEY = "campusbite_cart";
const CartContext = createContext(null);

function readSavedCart() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || { restaurant: null, items: [] };
  } catch {
    return { restaurant: null, items: [] };
  }
}

export function CartProvider({ children }) {
  const [cart, setCart] = useState(readSavedCart);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cart));
  }, [cart]);

  function addItem(item, restaurant) {
    if (cart.restaurant && cart.restaurant.id !== restaurant.id) return false;
    setCart((current) => {
      const existing = current.items.find((line) => line.id === item.id);
      const items = existing
        ? current.items.map((line) => line.id === item.id ? { ...line, quantity: Math.min(20, line.quantity + 1) } : line)
        : [...current.items, { ...item, quantity: 1 }];
      return { restaurant, items };
    });
    return true;
  }

  function setQuantity(itemId, quantity) {
    if (quantity <= 0) return removeItem(itemId);
    setCart((current) => ({
      ...current,
      items: current.items.map((line) => line.id === itemId ? { ...line, quantity: Math.min(20, quantity) } : line),
    }));
  }

  function removeItem(itemId) {
    setCart((current) => {
      const items = current.items.filter((line) => line.id !== itemId);
      return { restaurant: items.length ? current.restaurant : null, items };
    });
  }

  function clearCart() {
    setCart({ restaurant: null, items: [] });
  }

  const totalPaise = cart.items.reduce((sum, item) => sum + item.price_paise * item.quantity, 0);
  const value = useMemo(
    () => ({ ...cart, totalPaise, itemCount: cart.items.reduce((sum, item) => sum + item.quantity, 0), addItem, setQuantity, removeItem, clearCart }),
    [cart, totalPaise],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const value = useContext(CartContext);
  if (!value) throw new Error("useCart must be used inside CartProvider.");
  return value;
}
