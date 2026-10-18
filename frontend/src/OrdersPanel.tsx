import { useEffect, useState } from "react";
import { CheckCircle2, Plus, Trash2, ShoppingCart } from "lucide-react";
import { getProducts, createOrder, type Product } from "./api";

type CartItem = {
  product_id: number;
  quantity: number;
};

export default function OrdersPanel({ onOrderCreated }: { onOrderCreated: () => Promise<void> }) {
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [productId, setProductId] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function loadProducts() {
    setLoading(true);
    try {
      const result = await getProducts();
      setProducts(result.products.filter((p) => p.is_active));
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load products.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadProducts();
  }, []);

  const cartDetails = cart.map((item) => {
    const product = products.find((p) => p.id === item.product_id)!;
    return { ...item, product, subtotal: product.price * item.quantity };
  }).filter((item) => item.product);

  const total = cartDetails.reduce((sum, item) => sum + item.subtotal, 0);

  function addItem() {
    setError("");
    setMessage("");

    const id = Number(productId);
    const product = products.find((p) => p.id === id);

    if (!product) {
      setError("Select a valid product.");
      return;
    }

    if (!Number.isInteger(quantity) || quantity < 1) {
      setError("Quantity must be at least 1.");
      return;
    }

    const existing = cart.find((item) => item.product_id === id);
    const newQuantity = (existing?.quantity ?? 0) + quantity;

    if (newQuantity > product.stock_quantity) {
      setError(`Only ${product.stock_quantity} unit(s) of ${product.name} are available.`);
      return;
    }

    setCart((current) => existing
      ? current.map((item) => item.product_id === id
          ? { ...item, quantity: newQuantity }
          : item)
      : [...current, { product_id: id, quantity }]);

    setProductId("");
    setQuantity(1);
  }

  async function placeOrder() {
    if (cart.length === 0) {
      setError("Add at least one product to the order.");
      return;
    }

    if (!window.confirm(
      `Place this order for ${total.toLocaleString("en-IN", {
        style: "currency",
        currency: "INR"
      })}?\n\nThis will create an order, reduce stock, and create an OS job in your database.`
    )) return;

    setSaving(true);
    setError("");
    setMessage("");

    try {
      const result = await createOrder({
        items: cart.map(({ product_id, quantity }) => ({ product_id, quantity })),
      });

      setMessage(
        `Order #${result.order.id} created successfully. Total: ${result.order.total_amount.toLocaleString("en-IN", {
          style: "currency",
          currency: "INR"
        })}.`
      );
      setCart([]);
      await Promise.all([loadProducts(), onOrderCreated()]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not place the order.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="panel orders-panel">
      <div className="panel-heading">
        <div>
          <h2>Create an order</h2>
          <p>Select products and quantities. Prices come from your database.</p>
        </div>
        <ShoppingCart size={22} />
      </div>

      {error && <p role="alert" className="order-message-error">{error}</p>}
      {message && (
        <p className="order-message-success">
          <CheckCircle2 size={17} /> {message}
        </p>
      )}

      <div className="order-form-row">
        <label className="product-field">
          Product
          <select
            value={productId}
            onChange={(e) => setProductId(e.target.value)}
            disabled={loading}
          >
            <option value="">Choose a product</option>
            {products.map((product) => (
              <option key={product.id} value={product.id}>
                {product.name} — ₹{product.price} ({product.stock_quantity} in stock)
              </option>
            ))}
          </select>
        </label>

        <label className="product-field">
          Quantity
          <input
            type="number"
            min="1"
            step="1"
            value={quantity}
            onChange={(e) => setQuantity(Number(e.target.value))}
          />
        </label>

        <button className="primary-button order-add-button" onClick={addItem} disabled={loading}>
          <Plus size={16} /> Add item
        </button>
      </div>

      <div className="table-scroll">
        <table>
          <thead>
            <tr><th>PRODUCT</th><th>UNIT PRICE</th><th>QUANTITY</th><th>SUBTOTAL</th><th>ACTION</th></tr>
          </thead>
          <tbody>
            {cartDetails.map((item) => (
              <tr key={item.product_id}>
                <td>{item.product.name}</td>
                <td>₹{item.product.price.toFixed(2)}</td>
                <td>{item.quantity}</td>
                <td>₹{item.subtotal.toFixed(2)}</td>
                <td>
                  <button
                    className="secondary-button"
                    onClick={() => setCart((current) =>
                      current.filter((row) => row.product_id !== item.product_id)
                    )}
                  >
                    <Trash2 size={14} /> Remove
                  </button>
                </td>
              </tr>
            ))}
            {cartDetails.length === 0 && (
              <tr><td colSpan={5} className="empty-state">Your order is empty. Add a product above.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="order-total-row">
        <span>Order total</span>
        <strong>{total.toLocaleString("en-IN", {
          style: "currency",
          currency: "INR"
        })}</strong>
      </div>

      <button
        className="primary-button"
        onClick={() => void placeOrder()}
        disabled={saving || loading || cart.length === 0}
      >
        <ShoppingCart size={16} />
        {saving ? "Placing order..." : "Place order"}
      </button>

      <p className="preview-note">
        Customer: your signed-in account. Stock is revalidated by the backend when the order is submitted.
      </p>
    </section>
  );
}


