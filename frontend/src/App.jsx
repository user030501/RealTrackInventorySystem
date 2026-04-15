import { useEffect, useState } from "react";
import { io } from "socket.io-client";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4000";

function formatTimestamp(value) {
  if (!value) {
    return "Waiting for first update";
  }

  return new Date(value).toLocaleString();
}

export default function App() {
  const [products, setProducts] = useState([]);
  const [status, setStatus] = useState("Connecting to live inventory...");
  const [pendingProductId, setPendingProductId] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All Categories");

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
    ...Array.from(
      new Set(products.map((product) => product.category || "Uncategorized"))
    ).sort((categoryA, categoryB) => categoryA.localeCompare(categoryB))
  ];
  const filteredProducts = products.filter((product) => {
    const productCategory = product.category || "Uncategorized";

    if (
      selectedCategory !== "All Categories" &&
      productCategory !== selectedCategory
    ) {
      return false;
    }

    if (!normalizedSearchQuery) {
      return true;
    }

    return (
      product.productName.toLowerCase().includes(normalizedSearchQuery) ||
      productCategory.toLowerCase().includes(normalizedSearchQuery)
    );
  });
  const totalUnits = filteredProducts.reduce((sum, product) => sum + product.stockLevel, 0);
  const lowStockCount = filteredProducts.filter((product) => product.stockLevel <= 5).length;
  const productsByCategory = Object.entries(
    filteredProducts.reduce((groups, product) => {
      const category = product.category || "Uncategorized";

      if (!groups[category]) {
        groups[category] = [];
      }

      groups[category].push(product);
      return groups;
    }, {})
  ).sort(([categoryA], [categoryB]) => categoryA.localeCompare(categoryB));

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(249,115,22,0.2),_transparent_35%),linear-gradient(180deg,#08111f_0%,#020617_100%)] px-4 py-10 text-slate-100">
      <div className="mx-auto max-w-6xl">
        <section className="mb-8 rounded-3xl border border-white/10 bg-white/5 p-8 shadow-2xl shadow-black/30 backdrop-blur">
          <p className="mb-3 text-sm uppercase tracking-[0.3em] text-orange-300">
            RealTrack Inventory System
          </p>
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h1 className="text-4xl font-semibold tracking-tight text-white">
                Live stock visibility for small retail teams
              </h1>
              <p className="mt-3 max-w-2xl text-base text-slate-300">
                Backend stock changes stream straight into this dashboard with Socket.io,
                so connected users see updates immediately without refreshing.
              </p>
            </div>
            <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-200">
              {status}
            </div>
          </div>
        </section>

        <section className="mb-8 grid gap-4 md:grid-cols-3">
          <article className="rounded-3xl border border-white/10 bg-brand-panel/80 p-5">
            <p className="text-sm text-slate-400">Tracked products</p>
            <p className="mt-2 text-3xl font-semibold">{products.length}</p>
          </article>
          <article className="rounded-3xl border border-white/10 bg-brand-panel/80 p-5">
            <p className="text-sm text-slate-400">Units on hand</p>
            <p className="mt-2 text-3xl font-semibold">{totalUnits}</p>
          </article>
          <article className="rounded-3xl border border-white/10 bg-brand-panel/80 p-5">
            <p className="text-sm text-slate-400">Low stock alerts</p>
            <p className="mt-2 text-3xl font-semibold">{lowStockCount}</p>
          </article>
        </section>

        <section className="mb-8 rounded-3xl border border-white/10 bg-brand-panel/60 p-5 shadow-2xl shadow-black/20">
          <label htmlFor="product-search" className="mb-3 block text-sm font-medium text-slate-300">
            Search and filter products
          </label>
          <div className="flex flex-col gap-3 md:flex-row md:items-center">
            <input
              id="product-search"
              type="search"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search by product name or category"
              className="w-full rounded-2xl border border-white/10 bg-slate-950/50 px-4 py-3 text-white outline-none transition placeholder:text-slate-500 focus:border-orange-400"
            />
            <select
              value={selectedCategory}
              onChange={(event) => setSelectedCategory(event.target.value)}
              className="rounded-2xl border border-white/10 bg-slate-950/50 px-4 py-3 text-white outline-none transition focus:border-orange-400"
            >
              {availableCategories.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-300">
              {filteredProducts.length} result{filteredProducts.length === 1 ? "" : "s"}
            </div>
          </div>
        </section>

        <section className="overflow-hidden rounded-3xl border border-white/10 bg-brand-panel/60 shadow-2xl shadow-black/30">
          <div className="border-b border-white/10 px-6 py-5">
            <h2 className="text-xl font-semibold text-white">Current products</h2>
          </div>

          <div className="divide-y divide-white/10">
            {productsByCategory.map(([category, categoryProducts]) => (
              <section key={category} className="px-6 py-5">
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-white">{category}</h3>
                    <p className="text-sm text-slate-400">
                      {categoryProducts.length} products in this section
                    </p>
                  </div>
                  <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs uppercase tracking-[0.2em] text-orange-200">
                    {categoryProducts.reduce((sum, product) => sum + product.stockLevel, 0)} units
                  </span>
                </div>

                <div className="overflow-hidden rounded-2xl border border-white/10">
                  {categoryProducts.map((product) => (
                    <article
                      key={product.id}
                      className="flex flex-col gap-4 border-b border-white/10 bg-slate-950/20 px-5 py-4 last:border-b-0 md:flex-row md:items-center md:justify-between"
                    >
                      <div className="flex items-center gap-4">
                        <div className="h-16 w-16 overflow-hidden rounded-2xl border border-white/10 bg-slate-900/70 shadow-lg shadow-black/20">
                          {product.imageUrl ? (
                            <img
                              src={product.imageUrl}
                              alt={product.productName}
                              loading="lazy"
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                              No image
                            </div>
                          )}
                        </div>

                        <div>
                          <h4 className="text-lg font-medium text-white">{product.productName}</h4>
                          <p className="text-sm text-slate-400">{product.category}</p>
                          <p className="text-sm text-slate-500">
                            Last updated: {formatTimestamp(product.lastUpdated)}
                          </p>
                        </div>
                      </div>

                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                        <span
                          className={`rounded-full px-4 py-2 text-sm font-medium ${
                            product.stockLevel <= 5
                              ? "bg-rose-500/20 text-rose-200"
                              : "bg-emerald-500/20 text-emerald-200"
                          }`}
                        >
                          {product.stockLevel} units
                        </span>
                        <button
                          type="button"
                          onClick={() => deductStock(product.id, 1)}
                          disabled={pendingProductId === product.id}
                          className="rounded-full bg-orange-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-orange-400 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {pendingProductId === product.id ? "Updating..." : "Deduct 1"}
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            ))}

            {products.length > 0 && filteredProducts.length === 0 && (
              <div className="px-6 py-10 text-center text-slate-400">
                No products match your search. Try a different product name or category.
              </div>
            )}

            {products.length === 0 && (
              <div className="px-6 py-10 text-center text-slate-400">
                No products yet. Add documents to Firestore or use the POST endpoint to seed
                your inventory.
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
