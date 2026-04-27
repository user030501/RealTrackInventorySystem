import { useEffect, useState } from "react";
import { io } from "socket.io-client";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4000";

function formatTimestamp(value) {
  if (!value) {
    return "Waiting for first update";
  }

  return new Date(value).toLocaleString();
}

function getStockState(stockLevel) {
  if (stockLevel <= 0) {
    return {
      key: "empty",
      label: "Out of stock",
      badgeClass: "border-rose-400/20 bg-rose-400/10 text-rose-100",
      dotClass: "bg-rose-400"
    };
  }

  if (stockLevel <= 5) {
    return {
      key: "low",
      label: "Low stock",
      badgeClass: "border-amber-300/20 bg-amber-300/10 text-amber-50",
      dotClass: "bg-amber-300"
    };
  }

  return {
    key: "healthy",
    label: "In stock",
    badgeClass: "border-emerald-300/20 bg-emerald-300/10 text-emerald-50",
    dotClass: "bg-emerald-300"
  };
}

function getCategoryLabel(category) {
  return category || "Uncategorized";
}

function isFoodCategory(category) {
  return [
    "Canned Goods",
    "Instant Noodles",
    "Coffee and Milk",
    "Beverages",
    "Snacks and Biscuits",
    "Cooking Staples"
  ].includes(getCategoryLabel(category));
}

function LogoMark() {
  return (
    <span className="relative block h-8 w-8 rounded-2xl bg-emerald-400/20">
      <span className="absolute left-1 top-2 h-2.5 w-2.5 rounded-full bg-emerald-300" />
      <span className="absolute left-3 top-1 h-2.5 w-2.5 rounded-full bg-emerald-400" />
      <span className="absolute left-4 top-4 h-2.5 w-2.5 rounded-full bg-emerald-200" />
      <span className="absolute left-1.5 top-4.5 h-1.5 w-4 rounded-full bg-emerald-100/90" />
    </span>
  );
}

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="11" cy="11" r="6" />
      <path d="M20 20l-4.2-4.2" strokeLinecap="round" />
    </svg>
  );
}

function GridIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
      <rect x="4" y="4" width="6" height="6" rx="1.5" />
      <rect x="14" y="4" width="6" height="6" rx="1.5" />
      <rect x="4" y="14" width="6" height="6" rx="1.5" />
      <rect x="14" y="14" width="6" height="6" rx="1.5" />
    </svg>
  );
}

function ListIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M8 7h11M8 12h11M8 17h11" strokeLinecap="round" />
      <circle cx="5" cy="7" r="1.25" fill="currentColor" stroke="none" />
      <circle cx="5" cy="12" r="1.25" fill="currentColor" stroke="none" />
      <circle cx="5" cy="17" r="1.25" fill="currentColor" stroke="none" />
    </svg>
  );
}

function DotsIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
      <circle cx="5" cy="12" r="1.8" />
      <circle cx="12" cy="12" r="1.8" />
      <circle cx="19" cy="12" r="1.8" />
    </svg>
  );
}

function SyncIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M20 7v5h-5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4 17v-5h5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M7.5 8.5A6.5 6.5 0 0 1 18 12M6 12a6.5 6.5 0 0 0 10.5 3.5" strokeLinecap="round" />
    </svg>
  );
}

const NAV_ITEMS = ["Inventory", "Sales", "Reports"];

export default function App() {
  const [products, setProducts] = useState([]);
  const [status, setStatus] = useState("Connecting to live inventory...");
  const [pendingProductId, setPendingProductId] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All Categories");
  const [selectedStockFilter, setSelectedStockFilter] = useState("all");
  const [sortBy, setSortBy] = useState("alphabetical");
  const [viewMode, setViewMode] = useState("list");

  useEffect(() => {
    let isMounted = true;

    async function loadProducts() {
      try {
        const response = await fetch(`${API_URL}/api/products`);
        const data = await response.json();

        if (isMounted) {
          setProducts(data);
        }
      } catch (_error) {
        if (isMounted) {
          setStatus("Unable to load products from the API.");
        }
      }
    }

    loadProducts();

    const socket = io(API_URL, {
      transports: ["websocket", "polling"]
    });

    socket.on("connect", () => {
      setStatus("Live inventory connected.");
    });

    socket.on("disconnect", () => {
      setStatus("Realtime connection lost. Reconnecting...");
    });

    socket.on("products:snapshot", (nextProducts) => {
      setProducts(nextProducts);
    });

    socket.on("stock:deducted", (product) => {
      setStatus(`${product.productName} updated in real time.`);
    });

    return () => {
      isMounted = false;
      socket.disconnect();
    };
  }, []);

  async function deductStock(productId, amount = 1) {
    setPendingProductId(productId);

    try {
      const response = await fetch(`${API_URL}/api/products/${productId}/deduct`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ amount })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Stock deduction failed.");
      }
    } catch (error) {
      setStatus(error.message);
    } finally {
      setPendingProductId(null);
    }
  }

  const normalizedSearchQuery = searchQuery.trim().toLowerCase();
  const availableCategories = [
    "All Categories",
    ...Array.from(new Set(products.map((product) => getCategoryLabel(product.category)))).sort(
      (categoryA, categoryB) => categoryA.localeCompare(categoryB)
    )
  ];

  const productCounts = {
    all: products.length,
    food: products.filter((product) => isFoodCategory(product.category)).length,
    low: products.filter((product) => product.stockLevel > 0 && product.stockLevel <= 5).length,
    empty: products.filter((product) => product.stockLevel <= 0).length
  };

  const categorySummary = availableCategories
    .filter((category) => category !== "All Categories")
    .map((category) => ({
      label: category,
      count: products.filter((product) => getCategoryLabel(product.category) === category).length
    }))
    .sort((categoryA, categoryB) => categoryB.count - categoryA.count || categoryA.label.localeCompare(categoryB.label));

  const filteredProducts = products
    .filter((product) => {
      const category = getCategoryLabel(product.category);
      const stockState = getStockState(product.stockLevel).key;

      if (selectedCategory !== "All Categories" && category !== selectedCategory) {
        return false;
      }

      if (selectedStockFilter !== "all" && stockState !== selectedStockFilter) {
        if (selectedStockFilter !== "food" || !isFoodCategory(product.category)) {
          return false;
        }
      }

      if (!normalizedSearchQuery) {
        return true;
      }

      return (
        product.productName.toLowerCase().includes(normalizedSearchQuery) ||
        category.toLowerCase().includes(normalizedSearchQuery)
      );
    })
    .sort((productA, productB) => {
      if (sortBy === "stock-high") {
        return productB.stockLevel - productA.stockLevel;
      }

      if (sortBy === "stock-low") {
        return productA.stockLevel - productB.stockLevel;
      }

      if (sortBy === "updated") {
        return new Date(productB.lastUpdated || 0) - new Date(productA.lastUpdated || 0);
      }

      return productA.productName.localeCompare(productB.productName);
    });

  const totalUnits = filteredProducts.reduce((sum, product) => sum + product.stockLevel, 0);
  const lowStockCount = filteredProducts.filter((product) => product.stockLevel <= 5).length;
  const activeCategories = new Set(filteredProducts.map((product) => getCategoryLabel(product.category))).size;

  const statusFilters = [
    { key: "all", label: "All", count: productCounts.all },
    { key: "food", label: "Food", count: productCounts.food },
    { key: "low", label: "Low", count: productCounts.low },
    { key: "empty", label: "Empty", count: productCounts.empty }
  ];

  return (
    <main className="min-h-screen bg-transparent px-4 py-5 text-slate-100 md:px-6 xl:px-8">
      <div className="mx-auto max-w-[1500px]">
        <div className="rounded-[32px] border border-white/8 bg-[#223235]/58 p-3 shadow-[0_40px_120px_rgba(3,10,12,0.35)] backdrop-blur-lg">
          <header className="mb-4 flex flex-col gap-4 rounded-[28px] border border-white/6 bg-[#223235]/60 px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-8">
              <div className="flex items-center gap-3">
                <LogoMark />
                <div>
                  <p className="text-xl font-black tracking-tight text-white">RealTrack</p>
                  <p className="text-xs uppercase tracking-[0.28em] text-slate-400">retail control for small stores</p>
                </div>
              </div>

              <nav className="hidden flex-wrap gap-2 xl:flex">
                {NAV_ITEMS.map((item) => {
                  const isActive = item === "Inventory";

                  return (
                    <button
                      key={item}
                      type="button"
                      className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${
                        isActive
                          ? "border-emerald-300/30 bg-emerald-300/14 text-white shadow-[0_0_0_1px_rgba(110,231,183,0.08)]"
                          : "border-white/8 bg-white/[0.03] text-slate-300 hover:border-white/15 hover:text-white"
                      }`}
                    >
                      {item}
                    </button>
                  );
                })}
              </nav>
            </div>

            <div className="self-end lg:self-auto">
              <div className="flex items-center gap-3 rounded-2xl border border-white/8 bg-white/[0.05] px-3 py-2">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-[#f8e38c] to-[#f1bf3f] text-sm font-black text-slate-900">
                  A
                </div>
                <div className="hidden sm:block">
                  <p className="text-sm font-semibold text-white">Admin</p>
                  <p className="text-xs text-slate-400">Store owner</p>
                </div>
              </div>
            </div>
          </header>

          <div className="grid gap-4 xl:grid-cols-[280px_minmax(0,1fr)]">
            <aside className="rounded-[28px] border border-white/8 bg-[#304247]/54 p-5 backdrop-blur-md">
              <div className="mb-6">
                <div className="flex items-center gap-3">
                  <h1 className="text-4xl font-black tracking-tight text-white">Product</h1>
                  <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-sm font-semibold text-slate-200">
                    {products.length} total
                  </span>
                </div>
              </div>

              <section className="mb-6">
                <p className="mb-3 text-xs font-semibold uppercase tracking-[0.26em] text-slate-400">
                  Product Status
                </p>
                <div className="grid grid-cols-2 gap-3">
                  {statusFilters.map((filter) => {
                    const isActive = selectedStockFilter === filter.key;

                    return (
                      <button
                        key={filter.key}
                        type="button"
                        onClick={() => setSelectedStockFilter(filter.key)}
                        className={`rounded-2xl border px-4 py-3 text-left transition ${
                          isActive
                            ? "border-emerald-300 bg-emerald-300/10 text-white shadow-[0_10px_30px_rgba(74,222,128,0.12)]"
                            : "border-white/10 bg-[#28393d] text-slate-200 hover:border-white/20"
                        }`}
                      >
                        <div className="text-sm font-semibold">{filter.label}</div>
                        <div className="mt-1 text-xs text-slate-400">{filter.count} items</div>
                      </button>
                    );
                  })}
                </div>
              </section>

              <section className="mb-6">
                <p className="mb-3 text-xs font-semibold uppercase tracking-[0.26em] text-slate-400">
                  Product Type
                </p>
                <div className="space-y-2">
                  <button
                    type="button"
                    onClick={() => setSelectedCategory("All Categories")}
                    className={`flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-sm font-semibold transition ${
                      selectedCategory === "All Categories"
                        ? "border-emerald-300 bg-emerald-300/10 text-white"
                        : "border-white/10 bg-[#28393d] text-slate-200 hover:border-white/20"
                    }`}
                  >
                    <span>All categories</span>
                    <span className="text-slate-400">{products.length}</span>
                  </button>
                  {categorySummary.slice(0, 6).map((category) => (
                    <button
                      key={category.label}
                      type="button"
                      onClick={() => setSelectedCategory(category.label)}
                      className={`flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-sm font-semibold transition ${
                        selectedCategory === category.label
                          ? "border-emerald-300 bg-emerald-300/10 text-white"
                          : "border-white/10 bg-[#28393d] text-slate-200 hover:border-white/20"
                      }`}
                    >
                      <span className="truncate">{category.label}</span>
                      <span className="text-slate-400">{category.count}</span>
                    </button>
                  ))}
                </div>
              </section>

              <section className="mb-6">
                <label
                  htmlFor="sort-by"
                  className="mb-3 block text-xs font-semibold uppercase tracking-[0.26em] text-slate-400"
                >
                  Sort By
                </label>
                <select
                  id="sort-by"
                  value={sortBy}
                  onChange={(event) => setSortBy(event.target.value)}
                  className="w-full rounded-2xl border border-white/10 bg-[#28393d] px-4 py-3 text-sm font-medium text-white outline-none transition focus:border-emerald-300"
                >
                  <option value="alphabetical">Alphabetical: A-Z</option>
                  <option value="stock-high">Stock level: High-Low</option>
                  <option value="stock-low">Stock level: Low-High</option>
                  <option value="updated">Recently updated</option>
                </select>
              </section>

              <section className="mb-6 rounded-[24px] border border-white/8 bg-[#28393d] p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.26em] text-slate-400">
                  Live Pulse
                </p>
                <div className="mt-4 space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-300">Visible products</span>
                    <span className="font-semibold text-white">{filteredProducts.length}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-300">Units on hand</span>
                    <span className="font-semibold text-white">{totalUnits}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-300">Low-stock alerts</span>
                    <span className="font-semibold text-amber-200">{lowStockCount}</span>
                  </div>
                </div>
              </section>

              <button
                type="button"
                onClick={() => {
                  setSearchQuery("");
                  setSelectedCategory("All Categories");
                  setSelectedStockFilter("all");
                  setSortBy("alphabetical");
                }}
                className="w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-semibold text-white transition hover:border-white/20 hover:bg-white/[0.07]"
              >
                Reset Filters
              </button>
            </aside>

            <section className="rounded-[28px] border border-white/8 bg-[#27373b]/50 p-4 backdrop-blur-md md:p-5">
              <div className="mb-4 flex flex-col gap-3 xl:flex-row xl:items-center">
                  <div className="flex min-w-0 flex-1 items-center gap-3 rounded-[24px] border border-white/8 bg-[#243438]/68 px-4 py-3">
                  <span className="text-slate-400">
                    <SearchIcon />
                  </span>
                  <input
                    id="product-search"
                    type="search"
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    placeholder="Search product or category..."
                    className="w-full bg-transparent text-sm text-white outline-none placeholder:text-slate-500"
                  />
                </div>

                <div className="flex flex-wrap gap-3">
                  <div className="flex items-center gap-2 rounded-2xl border border-emerald-300/20 bg-emerald-300/10 px-4 py-3 text-sm font-semibold text-emerald-50">
                    <SyncIcon />
                    <span>Live sync</span>
                  </div>
                  <div className="flex rounded-2xl border border-white/8 bg-[#243438]/68 p-1">
                    <button
                      type="button"
                      onClick={() => setViewMode("list")}
                      className={`rounded-xl px-3 py-2 transition ${
                        viewMode === "list" ? "bg-emerald-300/12 text-white" : "text-slate-400"
                      }`}
                    >
                      <ListIcon />
                    </button>
                    <button
                      type="button"
                      onClick={() => setViewMode("grid")}
                      className={`rounded-xl px-3 py-2 transition ${
                        viewMode === "grid" ? "bg-emerald-300/12 text-white" : "text-slate-400"
                      }`}
                    >
                      <GridIcon />
                    </button>
                  </div>
                  <button
                    type="button"
                    className="rounded-2xl bg-gradient-to-r from-emerald-300 to-green-400 px-5 py-3 text-sm font-black text-slate-900 transition hover:brightness-105"
                  >
                    Add Product
                  </button>
                </div>
              </div>

              <div className="mb-4 grid gap-3 md:grid-cols-3">
                <article className="rounded-[24px] border border-white/8 bg-[#243438]/64 p-4">
                  <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Tracked Products</p>
                  <p className="mt-3 text-3xl font-black text-white">{filteredProducts.length}</p>
                  <p className="mt-2 text-sm text-slate-400">Items after your current filters.</p>
                </article>
                <article className="rounded-[24px] border border-white/8 bg-[#243438]/64 p-4">
                  <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Category Spread</p>
                  <p className="mt-3 text-3xl font-black text-white">{activeCategories}</p>
                  <p className="mt-2 text-sm text-slate-400">Distinct product sections on screen.</p>
                </article>
                <article className="rounded-[24px] border border-white/8 bg-[#243438]/64 p-4">
                  <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Connection Status</p>
                  <p className="mt-3 text-lg font-black text-white">{status}</p>
                  <p className="mt-2 text-sm text-slate-400">Realtime inventory updates via Socket.io.</p>
                </article>
              </div>

              {filteredProducts.length > 0 && viewMode === "list" && (
                <div className="space-y-3">
                  {filteredProducts.map((product) => {
                    const category = getCategoryLabel(product.category);
                    const stockState = getStockState(product.stockLevel);

                    return (
                      <article
                        key={product.id}
                        className="grid gap-4 rounded-[26px] border border-white/8 bg-[#304247]/58 px-4 py-4 shadow-[0_18px_40px_rgba(7,15,17,0.12)] backdrop-blur-sm lg:grid-cols-[minmax(0,1.6fr)_160px_140px_70px]"
                      >
                        <div className="flex min-w-0 items-center gap-4">
                          <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-[20px] bg-white">
                            {product.imageUrl ? (
                              <img
                                src={product.imageUrl}
                                alt={product.productName}
                                loading="lazy"
                                className="h-full w-full object-contain p-2"
                              />
                            ) : (
                              <div className="px-2 text-center text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">
                                No Image
                              </div>
                            )}
                          </div>

                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <h2 className="truncate text-lg font-black tracking-tight text-white">
                                {product.productName}
                              </h2>
                              <span className={`rounded-full border px-2.5 py-1 text-[11px] font-bold ${stockState.badgeClass}`}>
                                {stockState.label}
                              </span>
                            </div>
                            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-300">
                              <span>{category}</span>
                              <span className="text-slate-500">•</span>
                              <span className="flex items-center gap-2">
                                <span className={`h-2 w-2 rounded-full ${stockState.dotClass}`} />
                                {product.stockLevel} units on hand
                              </span>
                              <span className="text-slate-500">•</span>
                              <span className="text-slate-400">
                                Updated {formatTimestamp(product.lastUpdated)}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="rounded-[22px] border border-white/8 bg-[#243438]/64 px-4 py-3">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
                            Stock Level
                          </p>
                          <p className="mt-2 text-2xl font-black text-white">{product.stockLevel}</p>
                          <p className="mt-1 text-sm text-slate-400">Physical units available</p>
                        </div>

                        <div className="rounded-[22px] border border-white/8 bg-[#243438]/64 px-4 py-3">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
                            Action
                          </p>
                          <button
                            type="button"
                            onClick={() => deductStock(product.id, 1)}
                            disabled={pendingProductId === product.id}
                            className="mt-3 w-full rounded-xl bg-white px-3 py-2.5 text-sm font-black text-slate-900 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {pendingProductId === product.id ? "Updating..." : "Deduct 1"}
                          </button>
                        </div>

                        <div className="flex items-start justify-end">
                          <button
                            type="button"
                            className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/8 bg-[#243438]/64 text-slate-400 transition hover:text-white"
                          >
                            <DotsIcon />
                          </button>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}

              {filteredProducts.length > 0 && viewMode === "grid" && (
                <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
                  {filteredProducts.map((product) => {
                    const category = getCategoryLabel(product.category);
                    const stockState = getStockState(product.stockLevel);

                    return (
                      <article
                        key={product.id}
                        className="rounded-[26px] border border-white/8 bg-[#304247]/58 p-4 shadow-[0_18px_40px_rgba(7,15,17,0.12)] backdrop-blur-sm"
                      >
                        <div className="mb-4 flex items-start justify-between gap-3">
                          <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-[20px] bg-white">
                            {product.imageUrl ? (
                              <img
                                src={product.imageUrl}
                                alt={product.productName}
                                loading="lazy"
                                className="h-full w-full object-contain p-2"
                              />
                            ) : (
                              <div className="px-2 text-center text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">
                                No Image
                              </div>
                            )}
                          </div>
                          <span className={`rounded-full border px-2.5 py-1 text-[11px] font-bold ${stockState.badgeClass}`}>
                            {stockState.label}
                          </span>
                        </div>
                        <h2 className="text-lg font-black tracking-tight text-white">{product.productName}</h2>
                        <p className="mt-1 text-sm text-slate-400">{category}</p>
                        <div className="mt-4 rounded-[22px] border border-white/8 bg-[#243438]/64 p-4">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
                            Units Available
                          </p>
                          <p className="mt-2 text-3xl font-black text-white">{product.stockLevel}</p>
                        </div>
                        <div className="mt-4 flex items-center justify-between gap-3">
                          <p className="text-xs leading-5 text-slate-400">
                            Updated {formatTimestamp(product.lastUpdated)}
                          </p>
                          <button
                            type="button"
                            onClick={() => deductStock(product.id, 1)}
                            disabled={pendingProductId === product.id}
                            className="rounded-xl bg-white px-4 py-2.5 text-sm font-black text-slate-900 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {pendingProductId === product.id ? "Updating..." : "Deduct 1"}
                          </button>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}

              {products.length > 0 && filteredProducts.length === 0 && (
                <div className="rounded-[26px] border border-dashed border-white/12 bg-[#243438]/58 px-6 py-14 text-center backdrop-blur-sm">
                  <p className="text-xl font-bold text-white">No matching products</p>
                  <p className="mt-2 text-slate-400">
                    Try another search term or loosen the status and category filters.
                  </p>
                </div>
              )}

              {products.length === 0 && (
                <div className="rounded-[26px] border border-dashed border-white/12 bg-[#243438]/58 px-6 py-14 text-center backdrop-blur-sm">
                  <p className="text-xl font-bold text-white">Your inventory is waiting for data</p>
                  <p className="mt-2 text-slate-400">
                    Seed Firestore or add products through the API to populate this dashboard.
                  </p>
                </div>
              )}
            </section>
          </div>
        </div>
      </div>
    </main>
  );
}
