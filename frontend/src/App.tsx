import { useCallback, useEffect, useState } from "react";
import OrdersPanel from "./OrdersPanel";
import {
  Activity, BarChart3, Bell, Box, CheckCircle2,
  CircleHelp, Cpu, LayoutDashboard, Menu, Package, Plus,
  RefreshCw, Search, Settings, ShoppingCart, Pencil, X, Zap
} from "lucide-react";
import {
  BarChart, Bar, CartesianGrid, ResponsiveContainer, Tooltip,
  XAxis, YAxis
} from "recharts";
import {
  getProducts, getOrders, getJobs, getHealth,
  getSchedulerComparison, runScheduler, runDemoSimulation, createProduct,
  updateProduct, deleteProduct,
  type Product, type ProductInput, type Order, type OSJob, type AuthUser
} from "./api";
import "./App.css";

type TimelineSegment = {
  process_id: string;
  start_time: number;
  finish_time: number;
  duration: number;
};

type Comparison = {
  algorithm: string;
  average_response_time: number;
  average_turnaround_time: number;
  average_waiting_time: number;
  processes: unknown[];
  timeline?: TimelineSegment[];
};

type DashboardData = {
  products: Product[];
  orders: Order[];
  jobs: OSJob[];
  comparisons: Comparison[];
};

const navigation = [
  { label: "Overview", icon: LayoutDashboard },
  { label: "Products", icon: Package },
  { label: "Orders", icon: ShoppingCart },
  { label: "OS Job Queue", icon: Cpu },
  { label: "CPU Scheduler", icon: BarChart3 },
];

const emptyForm: ProductInput = {
  name: "",
  description: "",
  sku: "",
  price: 0,
  stock_quantity: 0,
};

const money = (value: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(value);

const readable = (value: string) =>
  value.replaceAll("_", " ").toLowerCase()
    .replace(/\b\w/g, (character) => character.toUpperCase());

function App({ user, onLogout }: { user: AuthUser; onLogout: () => void }) {
  const [activePage, setActivePage] = useState("Overview");
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordMessage, setPasswordMessage] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [algorithm, setAlgorithm] = useState("FCFS");
  const [search, setSearch] = useState("");
  const [data, setData] = useState<DashboardData>({
    products: [], orders: [], jobs: [], comparisons: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [connection, setConnection] = useState("Connecting...");
  const [notice, setNotice] = useState("");
  const [schedulerBusy, setSchedulerBusy] = useState(false);
  const [demoBusy, setDemoBusy] = useState(false);
  const [realCompareBusy, setRealCompareBusy] = useState(false);
  const [demoComparisons, setDemoComparisons] = useState<Comparison[] | null>(null);

  const [showProductForm, setShowProductForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [productForm, setProductForm] = useState<ProductInput>(emptyForm);
  const [savingProduct, setSavingProduct] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const [products, orders, jobs, comparison] = await Promise.all([
        getProducts(),
        getOrders(),
        getJobs(),
        getSchedulerComparison(),
      ]);

      const result = comparison as { comparisons?: Comparison[] };

      setData({
        products: products.products,
        orders: orders.orders,
        jobs: jobs.jobs,
        comparisons: result.comparisons ?? [],
      });

      try {
        await getHealth();
        setConnection("Backend connected");
      } catch {
        setConnection("API responding");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load dashboard data.");
      setConnection("Connection error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const filteredProducts = data.products.filter((product) =>
    `${product.id} ${product.name} ${product.sku}`
      .toLowerCase().includes(search.toLowerCase())
  );

  const [selectedJob, setSelectedJob] = useState<OSJob | null>(null);

  const filteredJobs = data.jobs.filter((job) =>
    `${job.id} ${job.process_id} ${job.process_state} ${job.scheduling_algorithm}`
      .toLowerCase().includes(search.toLowerCase())
  );

  const jobStateCounts = [
    { label: "New", state: "NEW" },
    { label: "Ready", state: "READY" },
    { label: "Completed", state: "COMPLETED" },
    { label: "Failed", state: "FAILED" },
  ].map((item) => ({
    ...item,
    count: data.jobs.filter(
      (job) => job.process_state.toUpperCase() === item.state
    ).length,
  }));

  const activeComparisons = demoComparisons ?? data.comparisons;

  const chartData = activeComparisons.map((item) => ({
    name: item.algorithm === "ROUND_ROBIN" ? "Round Robin" : item.algorithm,
    waiting: item.average_waiting_time,
    turnaround: item.average_turnaround_time,
  }));

  const bestMetric = (
    metric: "average_waiting_time" | "average_turnaround_time" | "average_response_time"
  ) => {
    if (activeComparisons.length === 0) {
      return { value: null as number | null, algorithms: [] as string[] };
    }

    const minimum = Math.min(
      ...activeComparisons.map((item) => item[metric])
    );

    return {
      value: minimum,
      algorithms: activeComparisons
        .filter((item) => item[metric] === minimum)
        .map((item) =>
          item.algorithm === "ROUND_ROBIN" ? "Round Robin" : item.algorithm
        ),
    };
  };

  const bestWaiting = bestMetric("average_waiting_time");
  const bestTurnaround = bestMetric("average_turnaround_time");
  const bestResponse = bestMetric("average_response_time");

  const selectedComparison = activeComparisons.find(
    (item) => item.algorithm === algorithm
  );

  const selectedTimeline = selectedComparison?.timeline ?? [];
  const timelineEnd = Math.max(
    1,
    ...selectedTimeline.map((segment) => segment.finish_time)
  );

  function openAddForm() {
    setEditingProduct(null);
    setProductForm(emptyForm);
    setShowProductForm(true);
    setError("");
    setNotice("");
  }

  function openEditForm(product: Product) {
    setEditingProduct(product);
    setProductForm({
      name: product.name,
      description: product.description ?? "",
      sku: product.sku,
      price: product.price,
      stock_quantity: product.stock_quantity,
    });
    setShowProductForm(true);
    setError("");
    setNotice("");
  }

  function closeProductForm() {
    setShowProductForm(false);
    setEditingProduct(null);
    setProductForm(emptyForm);
  }

  async function handleProductSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSavingProduct(true);
    setError("");
    setNotice("");

    try {
      if (editingProduct) {
        await updateProduct(editingProduct.id, {
          name: productForm.name.trim(),
          description: productForm.description,
          price: Number(productForm.price),
          stock_quantity: Number(productForm.stock_quantity),
        });
        setNotice("Product updated successfully.");
      } else {
        await createProduct({
          ...productForm,
          name: productForm.name.trim(),
          sku: productForm.sku.trim(),
          price: Number(productForm.price),
          stock_quantity: Number(productForm.stock_quantity),
        });
        setNotice("Product created successfully.");
      }

      closeProductForm();
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save product.");
    } finally {
      setSavingProduct(false);
    }
  }

  async function handleDeactivate(product: Product) {
    if (!window.confirm(
      `Deactivate "${product.name}"?\n\nThe product may be permanently deleted if it has no order history.`
    )) return;

    setError("");
    setNotice("");

    try {
      const result = await deleteProduct(product.id);
      setNotice(result.message || "Product removed or deactivated.");
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not remove product.");
    }
  }

  async function handleRunScheduler() {
    if (!window.confirm(
      `Run ${readable(algorithm)} on ready jobs?\n\nThis can change job states in the database. Continue?`
    )) return;

    setSchedulerBusy(true);
    setError("");
    setNotice("");

    try {
      const result = await runScheduler(algorithm, 2);
      setNotice(
        typeof result.message === "string"
          ? result.message
          : `${readable(algorithm)} scheduler finished.`
      );
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Scheduler run failed.");
    } finally {
      setSchedulerBusy(false);
    }
  }

  async function handleDemoSimulation() {
    setDemoBusy(true);
    setError("");
    setNotice("");

    try {
      const result = await runDemoSimulation() as {
        comparisons?: Comparison[];
        message?: string;
      };

      setDemoComparisons(result.comparisons ?? []);
      setNotice(result.message || "Demo simulation completed. Real database unchanged.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Demo simulation failed.");
    } finally {
      setDemoBusy(false);
    }
  }
  async function handleRealComparison() {
    setRealCompareBusy(true);
    setError("");
    setNotice("");

    try {
      const result = await getSchedulerComparison() as {
        comparisons?: Comparison[];
        message?: string;
        process_count?: number;
      };

      const comparisons = result.comparisons ?? [];

      setData((previous) => ({
        ...previous,
        comparisons,
      }));

      setDemoComparisons(null);

      setNotice(
        comparisons.length > 0
          ? `Real-data comparison completed using ${result.process_count ?? "available"} database job(s). Database unchanged.`
          : result.message || "No eligible real jobs are available for comparison."
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Real-data comparison failed.");
    } finally {
      setRealCompareBusy(false);
    }
  }

  return (
    <div className="app-shell">
      <aside className={`sidebar ${sidebarOpen ? "sidebar-open" : ""}`}>
        <div className="brand">
          <div className="brand-icon"><Box size={23} /></div>
          <div><strong>CartOS</strong><span>RESOURCE MANAGER</span></div>
        </div>

        <div className="nav-caption">WORKSPACE</div>
        <nav className="navigation">
          {navigation.map(({ label, icon: Icon }) => (
            <button
              key={label}
              className={`nav-link ${activePage === label ? "active" : ""}`}
              onClick={() => {
                setActivePage(label);
                setSearch("");
                setSidebarOpen(false);
                setShowProductForm(false);
                setError("");
                setNotice("");
              }}
            >
              <Icon size={18} />
              <span>{label}</span>
              {label === "OS Job Queue" &&
                <span className="nav-count">{data.jobs.length}</span>}
            </button>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <div className="system-status">
            <span className="status-dot" />
            <div><strong>System status</strong><span>{connection}</span></div>
          </div>
          <button className={`nav-link ${activePage === "Settings" ? "active" : ""}`} onClick={() => { setActivePage("Settings"); setSidebarOpen(false); setNotice(""); setError(""); }}>
            <Settings size={18} /><span>Settings</span>
          </button>
          <button className="nav-link" onClick={() => setNotice("CartOS uses React, Flask and MySQL.")}>
            <CircleHelp size={18} /><span>Help & documentation</span>
          </button>

        </div>
      </aside>

      {sidebarOpen && (
        <button className="mobile-backdrop" onClick={() => setSidebarOpen(false)} aria-label="Close menu" />
      )}

      <main className="main-area">
        <header className="topbar">
          <button className="icon-button mobile-menu" onClick={() => setSidebarOpen(!sidebarOpen)} aria-label="Toggle menu">
            <Menu />
          </button>
          <div className="breadcrumbs">Workspace <span>/</span> <strong>{activePage}</strong></div>
          <div className="topbar-actions">
            <div className="connection"><span className="status-dot" /> {connection}</div>
            <button className="icon-button" onClick={() => void loadData()} aria-label="Refresh data">
              <RefreshCw size={18} />
            </button>
            <button className="icon-button" aria-label="Notifications"><Bell size={18} /></button>
                        <div className="account-menu-wrap">
              <button
                type="button"
                className="top-avatar"
                onClick={() => setProfileMenuOpen(!profileMenuOpen)}
                aria-label="Open account menu"
                aria-expanded={profileMenuOpen}
                title={user.name}
              >
                {user.name.trim().split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0].toUpperCase()).join("") || "U"}
              </button>
              {profileMenuOpen && (
                <div className="account-dropdown">
                  <div className="account-dropdown-info">
                    <strong>{user.name}</strong>
                    <span>{user.email}</span>
                    <small>{readable(user.role)}</small>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setActivePage("Settings");
                      setProfileMenuOpen(false);
                      setNotice("");
                      setError("");
                    }}
                  >
                    <Settings size={16} /> Account Settings
                  </button>
                  <button
                    type="button"
                    className="dropdown-logout"
                    onClick={onLogout}
                  >
                    Logout
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        <div className="page-content">
          <section className="welcome-row">
            <div>
              <div className="eyebrow"><Zap size={14} /> E-COMMERCE OPERATIONS</div>
              <h1>{activePage === "Overview" ? "Dashboard overview" : activePage}</h1>
              <p>Manage orders, inventory, and operating-system processes in one place.</p>
            </div>
            <div className="date-label"><Activity size={16} /> CartOS workspace</div>
          </section>

          {error && (
            <div className="panel" role="alert">
              <strong>Something went wrong</strong>
              <p>{error}</p>
              <button className="secondary-button" onClick={() => void loadData()}>Refresh data</button>
            </div>
          )}

          {notice && (
            <div className="panel">
              <p>{notice}</p>
              <button className="secondary-button" onClick={() => setNotice("")}>Dismiss</button>
            </div>
          )}

          {activePage === "Products" && (
            <section className="panel orders-panel">
              <div className="panel-heading orders-heading">
                <div>
                  <h2>Product inventory</h2>
                  <p>Manage product details and stock stored in MySQL</p>
                </div>
                <button className="primary-button" onClick={openAddForm}>
                  <Plus size={16} /> Add product
                </button>
              </div>

              {showProductForm && (
                <form className="panel" onSubmit={handleProductSubmit}>
                  <div className="panel-heading">
                    <div>
                      <h2>{editingProduct ? "Edit product" : "Add new product"}</h2>
                      <p>{editingProduct ? `Editing product #${editingProduct.id}` : "Enter the new product details"}</p>
                    </div>
                    <button type="button" className="icon-button" onClick={closeProductForm} aria-label="Close form">
                      <X size={18} />
                    </button>
                  </div>

                  <div className="product-form-grid">
                    <label className="product-field">
                      Product name
                      <input
                        required
                        maxLength={120}
                        value={productForm.name}
                        onChange={(e) => setProductForm({ ...productForm, name: e.target.value })}
                        placeholder="e.g. Wireless Keyboard"
                      />
                    </label>

                    <label className="product-field">
                      SKU
                      <input
                        required
                        maxLength={80}
                        disabled={Boolean(editingProduct)}
                        value={productForm.sku}
                        onChange={(e) => setProductForm({ ...productForm, sku: e.target.value })}
                        placeholder="e.g. KEYBOARD-001"
                      />
                      {editingProduct && <small>SKU editing is not supported by the current API.</small>}
                    </label>

                    <label className="product-field">
                      Price (₹)
                      <input
                        required
                        type="number"
                        min="0"
                        step="0.01"
                        value={productForm.price}
                        onChange={(e) => setProductForm({ ...productForm, price: Number(e.target.value) })}
                      />
                    </label>

                    <label className="product-field">
                      Stock quantity
                      <input
                        required
                        type="number"
                        min="0"
                        step="1"
                        value={productForm.stock_quantity}
                        onChange={(e) => setProductForm({ ...productForm, stock_quantity: Number(e.target.value) })}
                      />
                    </label>

                    <label className="product-field product-field-wide">
                      Description
                      <textarea
                        rows={3}
                        maxLength={1000}
                        value={productForm.description}
                        onChange={(e) => setProductForm({ ...productForm, description: e.target.value })}
                        placeholder="Describe this product"
                      />
                    </label>
                  </div>

                  <div className="table-actions">
                    <button type="submit" className="primary-button" disabled={savingProduct}>
                      {savingProduct ? "Saving..." : editingProduct ? "Save changes" : "Create product"}
                    </button>
                    <button type="button" className="secondary-button" onClick={closeProductForm} disabled={savingProduct}>
                      Cancel
                    </button>
                  </div>
                </form>
              )}

              <div className="panel-heading orders-heading">
                <div><h2>Inventory list</h2><p>{data.products.length} product(s) in the database</p></div>
                <div className="search-box">
                  <Search size={16} />
                  <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name or SKU..." />
                </div>
              </div>

              <div className="table-scroll">
                <table>
                  <thead>
                    <tr><th>PRODUCT</th><th>SKU</th><th>PRICE</th><th>STOCK</th><th>STATUS</th><th>ACTIONS</th></tr>
                  </thead>
                  <tbody>
                    {filteredProducts.map((product) => (
                      <tr key={product.id}>
                        <td>
                          <strong>{product.name}</strong>
                          {product.description && <div className="product-description">{product.description}</div>}
                        </td>
                        <td>{product.sku}</td>
                        <td>{money(product.price)}</td>
                        <td>
                          <span className={product.stock_quantity <= 5 ? "stock-low" : ""}>
                            {product.stock_quantity}
                          </span>
                        </td>
                        <td>
                          <span className="status-badge pending">
                            {product.is_active ? "Active" : "Inactive"}
                          </span>
                        </td>
                        <td>
                          <div className="product-actions">
                            <button className="secondary-button" onClick={() => openEditForm(product)} title="Edit product">
                              <Pencil size={14} /> Edit
                            </button>
                            {product.is_active ? (
                              <button className="secondary-button" onClick={() => void handleDeactivate(product)}>
                                Deactivate
                              </button>
                            ) : (
                              <button className="secondary-button" onClick={async () => {
                                try {
                                  await updateProduct(product.id, { is_active: true });
                                  setNotice("Product reactivated.");
                                  await loadData();
                                } catch (err) {
                                  setError(err instanceof Error ? err.message : "Could not reactivate product.");
                                }
                              }}>
                                Reactivate
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                    {!loading && filteredProducts.length === 0 && (
                      <tr><td colSpan={6} className="empty-state">No matching products.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
              <div className="table-footer">
                <span>Showing {filteredProducts.length} of {data.products.length} products</span>
                <span><CheckCircle2 size={14} /> Live API data</span>
              </div>
            </section>
          )}

          {activePage === "Overview" && (
            <>
              <section className="metric-grid">
                <MetricCard title="Total products" value={loading ? "…" : String(data.products.length)} note="Loaded from the API" icon={Package} color="blue" />
                <MetricCard title="Total orders" value={loading ? "…" : String(data.orders.length)} note="Loaded from the API" icon={ShoppingCart} color="purple" />
                <MetricCard title="OS jobs" value={loading ? "…" : String(data.jobs.length)} note="Process records from the API" icon={Cpu} color="orange" />
                <MetricCard title="Scheduling algorithms" value={String(data.comparisons.length || 4)} note="FCFS, SJF, Priority, RR" icon={Activity} color="green" />
              </section>

              <section className="content-grid">
                <div className="panel chart-panel">
                  <div className="panel-heading">
                    <div><h2>CPU scheduling analysis</h2><p>Average times returned by the backend</p></div>
                    <span className="tag"><span className="status-dot" /> Live API</span>
                  </div>
                  <div className="chart-legend">
                    <span><i className="legend-blue" /> Waiting time</span>
                    <span><i className="legend-purple" /> Turnaround time</span>
                  </div>
                  <div className="chart-wrap">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={chartData} barGap={5} margin={{ top: 10, right: 8, left: -18, bottom: 2 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#273246" />
                        <XAxis dataKey="name" tick={{ fill: "#9ca9bd", fontSize: 11 }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fill: "#9ca9bd", fontSize: 11 }} axisLine={false} tickLine={false} />
                        <Tooltip contentStyle={{ background: "#151f30", border: "1px solid #2b374b", borderRadius: 10 }} />
                        <Bar dataKey="waiting" name="Waiting time" fill="#62a6ff" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="turnaround" name="Turnaround time" fill="#a78bfa" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="chart-footnote">Based on {data.jobs.length} job(s).</div>
                </div>

                <div className="panel scheduler-panel">
                  <div className="panel-heading">
                    <div><h2>Scheduler control</h2><p>Choose an algorithm</p></div>
                    <div className="cpu-icon"><Cpu size={20} /></div>
                  </div>
                  <label className="field-label" htmlFor="algorithm">Scheduling algorithm</label>
                  <select id="algorithm" value={algorithm} onChange={(e) => setAlgorithm(e.target.value)}>
                    <option value="FCFS">First Come, First Served</option>
                    <option value="SJF">Shortest Job First</option>
                    <option value="PRIORITY">Priority Scheduling</option>
                    <option value="ROUND_ROBIN">Round Robin</option>
                  </select>
                  <div className="algorithm-info">
                    <span className="info-label">SELECTED ALGORITHM</span>
                    <strong>{readable(algorithm)}</strong>
                    <p>{algorithm === "FCFS" ? "Processes execute in arrival order." : algorithm === "SJF" ? "The shortest available job executes first." : algorithm === "PRIORITY" ? "Ready jobs are scheduled by priority." : "Processes share CPU time in fixed time slices."}</p>
                  </div>
                  <button className="primary-button" disabled={schedulerBusy || loading} onClick={() => void handleRunScheduler()}>
                    <Zap size={16} /> {schedulerBusy ? "Running..." : "Run scheduler"} <span>→</span>
                  </button>
                  <p className="preview-note">Confirmation appears before job states can change.</p>
                </div>
              </section>

              <section className="panel orders-panel">
                <div className="panel-heading orders-heading">
                  <div><h2>Recent orders</h2><p>Orders fetched from the database</p></div>
                  <button className="secondary-button" onClick={() => setActivePage("Orders")}>View all orders →</button>
                </div>
                <div className="table-scroll">
                  <table>
                    <thead><tr><th>ORDER ID</th><th>USER ID</th><th>AMOUNT</th><th>STATUS</th></tr></thead>
                    <tbody>
                      {data.orders.slice(0, 5).map((order) => (
                        <tr key={order.id}>
                          <td className="order-id">#ORD-{String(order.id).padStart(4, "0")}</td>
                          <td>{order.user_id}</td><td>{money(order.total_amount)}</td>
                          <td><span className="status-badge pending">{readable(order.status)}</span></td>
                        </tr>
                      ))}
                      {!loading && data.orders.length === 0 && <tr><td colSpan={4} className="empty-state">No orders yet.</td></tr>}
                    </tbody>
                  </table>
                </div>
              </section>
            </>
          )}

          {activePage === "Orders" && <OrdersPanel onOrderCreated={loadData} />}

          {activePage === "OS Job Queue" && (
            <section className="panel orders-panel">
              <div className="panel-heading orders-heading">
                <div><h2>OS job queue</h2><p>Process states and scheduling metrics</p></div>
                <div className="search-box"><Search size={16} /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search jobs..." /></div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: "14px", marginBottom: "20px" }}>
                {jobStateCounts.map((item) => (
                  <div
                    key={item.state}
                    style={{
                      padding: "18px",
                      border: "1px solid #263449",
                      borderRadius: "12px",
                      background: "#111c2e",
                    }}
                  >
                    <div style={{ color: "#9caec4", fontSize: "13px", marginBottom: "10px" }}>
                      {item.label} Jobs
                    </div>
                    <div style={{ fontSize: "28px", fontWeight: 700 }}>
                      {item.count}
                    </div>
                  </div>
                ))}
              </div>
              {selectedJob && (
                <section
                  style={{
                    padding: "20px",
                    marginBottom: "20px",
                    border: "1px solid #334155",
                    borderRadius: "12px",
                    background: "#111c2e",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px", marginBottom: "18px" }}>
                    <div>
                      <h3 style={{ margin: 0 }}>Process Control Block (PCB)</h3>
                      <p style={{ color: "#9caec4", margin: "6px 0 0" }}>Job #{selectedJob.id} · {selectedJob.process_id}</p>
                    </div>
                    <button className="secondary-button" onClick={() => setSelectedJob(null)}>
                      Close
                    </button>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: "16px" }}>
                    {[
                      ["Process State", readable(selectedJob.process_state)],
                      ["Order ID", selectedJob.order_id],
                      ["Priority", selectedJob.priority],
                      ["Scheduling Algorithm", readable(selectedJob.scheduling_algorithm)],
                      ["Arrival Time", selectedJob.arrival_time],
                      ["Burst Time", selectedJob.burst_time],
                      ["Waiting Time", selectedJob.waiting_time],
                      ["Turnaround Time", selectedJob.turnaround_time],
                      ["Response Time", selectedJob.response_time ?? "Not available"],
                    ].map(([label, value]) => (
                      <div key={String(label)} style={{ padding: "12px", borderRadius: "8px", background: "#0b1424" }}>
                        <div style={{ color: "#9caec4", fontSize: "12px", marginBottom: "7px" }}>{label}</div>
                        <div style={{ fontWeight: 600, overflowWrap: "anywhere" }}>{value}</div>
                      </div>
                    ))}
                  </div>
                </section>
              )}
              <section style={{ marginBottom: "22px", padding: "20px", border: "1px solid #263449", borderRadius: "12px", background: "#111c2e" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
                  <div>
                    <h3 style={{ margin: 0 }}>Ready Queue</h3>
                    <p style={{ color: "#9caec4", margin: "6px 0 0" }}>Processes waiting for CPU scheduling</p>
                  </div>
                  <span className="status-badge status-ready">
                    {data.jobs.filter((job) => job.process_state.toUpperCase() === "READY").length} waiting
                  </span>
                </div>
                {data.jobs.filter((job) => job.process_state.toUpperCase() === "READY").length === 0 ? (
                  <div style={{ padding: "18px", textAlign: "center", color: "#9caec4", border: "1px dashed #334155", borderRadius: "8px" }}>
                    Ready Queue is empty. New orders create READY jobs.
                  </div>
                ) : (
                  <div style={{ display: "flex", gap: "12px", overflowX: "auto", paddingBottom: "6px" }}>
                    {data.jobs
                      .filter((job) => job.process_state.toUpperCase() === "READY")
                      .sort((a, b) => a.arrival_time - b.arrival_time || a.id - b.id)
                      .map((job, index) => (
                        <div key={job.id} onClick={() => setSelectedJob(job)} title="Click to view PCB details" style={{ minWidth: "155px", padding: "14px", border: "1px solid #2563eb", borderRadius: "10px", background: "#0b1424", cursor: "pointer" }}>
                          <div style={{ color: "#60a5fa", fontSize: "12px", marginBottom: "8px" }}>QUEUE POSITION {index + 1}</div>
                          <div style={{ fontWeight: 700, marginBottom: "10px" }}>{job.process_id}</div>
                          <div style={{ color: "#cbd5e1", fontSize: "13px" }}>Priority: {job.priority}</div>
                          <div style={{ color: "#cbd5e1", fontSize: "13px" }}>Burst: {job.burst_time}</div>
                          <div style={{ color: "#cbd5e1", fontSize: "13px" }}>Arrival: {job.arrival_time}</div>
                        </div>
                      ))}
                  </div>
                )}
              </section>
              <div className="table-scroll">
                <table>
                  <thead><tr><th>JOB ID</th><th>PROCESS ID</th><th>STATE</th><th>ALGORITHM</th><th>BURST</th><th>WAITING</th><th>TURNAROUND</th></tr></thead>
                  <tbody>
                    {filteredJobs.map((job) => (
                      <tr key={job.id} onClick={() => setSelectedJob(job)} style={{ cursor: "pointer" }} title="Click to view PCB details">
                        <td>{job.id}</td>
<td>{job.process_id}</td>
<td>
  <span className={`status-badge status-${job.process_state.toLowerCase()}`}>
    {readable(job.process_state)}
  </span>
</td>
                        <td>{readable(job.scheduling_algorithm)}</td><td>{job.burst_time}</td>
                        <td>{job.waiting_time}</td><td>{job.turnaround_time}</td>
                      </tr>
                    ))}
                    {!loading && filteredJobs.length === 0 && <tr><td colSpan={7} className="empty-state">No jobs found.</td></tr>}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {activePage === "CPU Scheduler" && (
            <>
              <section className="metric-grid">
                <MetricCard
                  title="Lowest avg. waiting"
                  value={bestWaiting.value === null ? "—" : bestWaiting.value.toFixed(2)}
                  note={bestWaiting.algorithms.length ? bestWaiting.algorithms.join(", ") : "Run a comparison"}
                  icon={Activity}
                  color="blue"
                />
                <MetricCard
                  title="Lowest avg. turnaround"
                  value={bestTurnaround.value === null ? "—" : bestTurnaround.value.toFixed(2)}
                  note={bestTurnaround.algorithms.length ? bestTurnaround.algorithms.join(", ") : "Run a comparison"}
                  icon={CheckCircle2}
                  color="green"
                />
                <MetricCard
                  title="Lowest avg. response"
                  value={bestResponse.value === null ? "—" : bestResponse.value.toFixed(2)}
                  note={bestResponse.algorithms.length ? bestResponse.algorithms.join(", ") : "Run a comparison"}
                  icon={Zap}
                  color="purple"
                />
              </section>

              <section className="panel chart-panel">
                <div className="panel-heading">
                  <div>
                    <h2>Algorithm comparison</h2>
                    <p>Compare scheduling policies using real jobs or sample processes</p>
                  </div>
                  <div className="table-actions">
                    <button
                      className="secondary-button"
                      disabled={realCompareBusy || demoBusy}
                      onClick={() => void handleRealComparison()}
                    >
                      {realCompareBusy ? "Comparing..." : "Compare Real Jobs"}
                    </button>
                    <button
                      className="secondary-button"
                      disabled={demoBusy || realCompareBusy}
                      onClick={() => void handleDemoSimulation()}
                    >
                      {demoBusy ? "Simulating..." : "Run Demo Simulation"}
                    </button>
                    <button
                      className="primary-button"
                      disabled={schedulerBusy || loading || demoBusy || realCompareBusy}
                      onClick={() => void handleRunScheduler()}
                    >
                      <Zap size={16} /> {schedulerBusy ? "Running..." : "Run Real Scheduler"}
                    </button>
                  </div>
                </div>
                <p className="preview-note">
                  {demoComparisons !== null
                    ? "DEMO MODE · Sample processes · Real database unchanged"
                    : "REAL DATA MODE · Database jobs · Comparison does not execute jobs"}
                </p>
                <div className="chart-wrap">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#273246" />
                      <XAxis dataKey="name" tick={{ fill: "#9ca9bd", fontSize: 11 }} />
                      <YAxis tick={{ fill: "#9ca9bd", fontSize: 11 }} />
                      <Tooltip />
                      <Bar dataKey="waiting" name="Waiting time" fill="#62a6ff" />
                      <Bar dataKey="turnaround" name="Turnaround time" fill="#a78bfa" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </section>
              <section className="panel chart-panel">
                <div className="panel-heading">
                  <div>
                    <h2>CPU execution timeline</h2>
                    <p>Gantt chart · each block represents a CPU execution segment</p>
                  </div>
                  <label className="field-label">
                    Algorithm
                    <select value={algorithm} onChange={(e) => setAlgorithm(e.target.value)}>
                      <option value="FCFS">FCFS</option>
                      <option value="SJF">SJF</option>
                      <option value="PRIORITY">Priority</option>
                      <option value="ROUND_ROBIN">Round Robin</option>
                    </select>
                  </label>
                </div>

                {selectedTimeline.length > 0 ? (
                  <>
                    <div style={{ display: "flex", width: "100%", minHeight: "76px", overflowX: "auto", padding: "12px 0" }}>
                      {selectedTimeline.map((segment, index) => (
                        <div
                          key={`${segment.process_id}-${segment.start_time}-${index}`}
                          title={`${segment.process_id}: ${segment.start_time} to ${segment.finish_time}`}
                          style={{
                            flex: `${segment.duration} 0 0`,
                            minWidth: "48px",
                            background: segment.process_id === "IDLE" ? "#475569" : ["#2563eb", "#7c3aed", "#0d9488", "#d97706"][index % 4],
                            color: "#ffffff",
                            borderRight: "2px solid #111827",
                            borderRadius: "5px",
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center",
                            justifyContent: "center",
                            padding: "8px 3px",
                            fontSize: "12px",
                          }}
                        >
                          <strong>{segment.process_id}</strong>
                          <span>{segment.duration} unit(s)</span>
                        </div>
                      ))}
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", color: "#9ca9bd", fontSize: "12px" }}>
                      <span>Start: {selectedTimeline[0].start_time}</span>
                      <span>Finish: {timelineEnd}</span>
                    </div>
                  </>
                ) : (
                  <p className="empty-state">
                    No timeline available for this algorithm. Run a comparison to load its execution timeline.
                  </p>
                )}
              </section>

              <section className="panel orders-panel">
                <div className="panel-heading">
                  <div>
                    <h2>Process execution details</h2>
                    <p>
                      {readable(algorithm)} ·
                      {" "}{demoComparisons !== null ? "Demo processes" : "Real database jobs"}
                    </p>
                  </div>
                  <span className="tag">{selectedComparison?.processes.length ?? 0} process(es)</span>
                </div>
                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>PROCESS ID</th>
                        <th>ARRIVAL</th>
                        <th>BURST</th>
                        <th>FIRST START</th>
                        <th>COMPLETION</th>
                        <th>WAITING</th>
                        <th>TURNAROUND</th>
                        <th>RESPONSE</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(selectedComparison?.processes ?? []).map((rawProcess, index) => {
                        const process = rawProcess as {
                          process_id?: string;
                          id?: number | string;
                          arrival_time?: number;
                          burst_time?: number;
                          start_time?: number;
                          completion_time?: number;
                          waiting_time?: number;
                          turnaround_time?: number;
                          response_time?: number;
                        };

                        return (
                          <tr key={`${process.process_id ?? process.id ?? "process"}-${index}`}>
                            <td>{process.process_id ?? `P${process.id ?? index + 1}`}</td>
                            <td>{process.arrival_time ?? "—"}</td>
                            <td>{process.burst_time ?? "—"}</td>
                            <td>{process.start_time ?? "—"}</td>
                            <td>{process.completion_time ?? "—"}</td>
                            <td>{process.waiting_time ?? "—"}</td>
                            <td>{process.turnaround_time ?? "—"}</td>
                            <td>{process.response_time ?? "—"}</td>
                          </tr>
                        );
                      })}
                      {(selectedComparison?.processes.length ?? 0) === 0 && (
                        <tr>
                          <td colSpan={8} className="empty-state">
                            Run a real-data comparison or demo simulation to see process details.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </section>

              <section className="panel orders-panel">
                <div className="table-scroll">
                  <table>
                    <thead><tr><th>ALGORITHM</th><th>AVG. WAITING</th><th>AVG. TURNAROUND</th><th>AVG. RESPONSE</th></tr></thead>
                    <tbody>
                      {(demoComparisons ?? data.comparisons).map((item) => (
                        <tr key={item.algorithm}>
                          <td>{readable(item.algorithm)}</td><td>{item.average_waiting_time.toFixed(2)}</td>
                          <td>{item.average_turnaround_time.toFixed(2)}</td><td>{item.average_response_time.toFixed(2)}</td>
                        </tr>
                      ))}
                      {(demoComparisons ?? data.comparisons).length === 0 && (
                        <tr>
                          <td colSpan={4} className="empty-state">
                            No real jobs available yet. Place an order or run the demo simulation.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </section>
            </>
          )}

          {activePage === "Settings" && (
            <section className="settings-layout">
              <section className="panel settings-panel">
                <div className="panel-heading">
                  <div>
                    <h2>Account information</h2>
                    <p>Your signed-in CartOS account details</p>
                  </div>
                </div>
                <div className="settings-details">
                  <div className="settings-avatar">
                    {user.name.trim().split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0].toUpperCase()).join("") || "U"}
                  </div>
                  <div className="settings-field">
                    <span>Full name</span>
                    <strong>{user.name}</strong>
                  </div>
                  <div className="settings-field">
                    <span>Email address</span>
                    <strong>{user.email}</strong>
                  </div>
                  <div className="settings-field">
                    <span>Account role</span>
                    <strong>{readable(user.role)}</strong>
                  </div>
                </div>
              </section>

              <section className="panel settings-panel">
                <div className="panel-heading">
                  <div>
                    <h2>Change password</h2>
                    <p>Verify your current password before choosing a new one.</p>
                  </div>
                </div>
                <form
                  className="password-form"
                  onSubmit={(event) => {
                    event.preventDefault();
                    setPasswordMessage("");
                    if (newPassword.length < 8) {
                      setPasswordMessage("Your new password must contain at least 8 characters.");
                      return;
                    }
                    if (newPassword !== confirmPassword) {
                      setPasswordMessage("The new password and confirmation do not match.");
                      return;
                    }
                    setPasswordMessage("The form is ready. Password saving will be enabled after the secure backend endpoint is added.");
                  }}
                >
                  <label>
                    Current password
                    <input type="password" autoComplete="current-password" required value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} />
                  </label>
                  <label>
                    New password
                    <input type="password" autoComplete="new-password" minLength={8} required value={newPassword} onChange={(event) => setNewPassword(event.target.value)} />
                  </label>
                  <label>
                    Confirm new password
                    <input type="password" autoComplete="new-password" minLength={8} required value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} />
                  </label>
                  <button className="primary-button" type="submit">Update password</button>
                  {passwordMessage && <p className="password-message" role="status">{passwordMessage}</p>}
                </form>
              </section>
            </section>
          )}

          <footer className="page-footer">
            <span>CartOS <b>·</b> E-Commerce Order Processing System</span>
            <span>React + Flask + MySQL</span>
          </footer>
        </div>
      </main>
    </div>
  );
}

function MetricCard({
  title, value, note, icon: Icon, color,
}: {
  title: string;
  value: string;
  note: string;
  icon: typeof Package;
  color: string;
}) {
  return (
    <div className="metric-card">
      <div className="metric-top"><span>{title}</span><div className={`metric-icon ${color}`}><Icon size={19} /></div></div>
      <div className="metric-value">{value}</div>
      <div className="metric-note">{note}</div>
    </div>
  );
}

export default App;




















