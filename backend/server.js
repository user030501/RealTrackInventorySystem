import "dotenv/config";
import cors from "cors";
import express from "express";
import http from "http";
import { Server } from "socket.io";
import { productsCollection, salesCollection, timestamp } from "./firebase.js";

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_ORIGIN || "http://localhost:5173",
    methods: ["GET", "POST", "PATCH"]
  }
});

const PORT = process.env.PORT || 4000;

app.use(
  cors({
    origin: process.env.CLIENT_ORIGIN || "http://localhost:5173"
  })
);
app.use(express.json());

function mapProduct(doc) {
  const data = doc.data();

  return {
    id: doc.id,
    category: data.category || "Uncategorized",
    imageUrl: data.imageUrl || null,
    productName: data.productName,
    unitPrice: Number(data.unitPrice || 0),
    stockLevel: data.stockLevel,
    lastUpdated: data.lastUpdated?.toDate?.()?.toISOString() || null
  };
}

function mapSale(doc) {
  const data = doc.data();

  return {
    id: doc.id,
    category: data.category || "Uncategorized",
    productId: data.productId,
    productName: data.productName,
    quantity: data.quantity || 0,
    unitPrice: Number(data.unitPrice || 0),
    totalAmount: Number(data.totalAmount || 0),
    createdAt: data.createdAt?.toDate?.()?.toISOString() || null
  };
}

async function fetchProducts() {
  const snapshot = await productsCollection.orderBy("productName").get();
  return snapshot.docs.map(mapProduct);
}

async function fetchSales({ limit = 50, days = null } = {}) {
  let query = salesCollection.orderBy("createdAt", "desc");

  if (days != null) {
    const threshold = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    query = query.where("createdAt", ">=", threshold);
  }

  if (limit != null) {
    query = query.limit(limit);
  }

  const snapshot = await query.get();
  return snapshot.docs.map(mapSale);
}

function buildWeeklyDemandTrend(sales, days = 7) {
  const dailySalesMap = sales.reduce((accumulator, sale) => {
    const dateKey = (sale.createdAt || "").slice(0, 10);

    if (!dateKey) {
      return accumulator;
    }

    const existing = accumulator.get(dateKey) || {
      date: dateKey,
      quantity: 0,
      revenue: 0
    };

    existing.quantity += sale.quantity;
    existing.revenue += sale.totalAmount;
    accumulator.set(dateKey, existing);
    return accumulator;
  }, new Map());

  return Array.from(dailySalesMap.values())
    .sort((left, right) => left.date.localeCompare(right.date))
    .slice(-days);
}

function buildProductRecommendations(products, sales, lookbackDays = 30) {
  const salesByProduct = sales.reduce((accumulator, sale) => {
    const productId = sale.productId;
    const existing = accumulator.get(productId) || {
      productId,
      productName: sale.productName,
      totalQuantity: 0,
      dailyQuantity: new Map()
    };

    existing.totalQuantity += sale.quantity;

    const dayKey = (sale.createdAt || "").slice(0, 10);
    if (dayKey) {
      existing.dailyQuantity.set(dayKey, (existing.dailyQuantity.get(dayKey) || 0) + sale.quantity);
    }

    accumulator.set(productId, existing);
    return accumulator;
  }, new Map());

  const now = new Date();
  const todayKey = now.toISOString().slice(0, 10);
  const trendStart = new Date(Date.now() - lookbackDays * 24 * 60 * 60 * 1000);

  return products.map((product) => {
    const salesSummary = salesByProduct.get(product.id);
    const totalQuantity = salesSummary?.totalQuantity || 0;
    const dailyQuantity = salesSummary?.dailyQuantity || new Map();

    const dailyDates = Array.from(dailyQuantity.keys()).map((dateKey) => new Date(dateKey).getTime()).filter(Boolean);
    const earliestSaleTimestamp = dailyDates.length ? Math.min(...dailyDates) : null;
    const daysObserved = earliestSaleTimestamp
      ? Math.max(
          7,
          Math.min(
            lookbackDays,
            Math.floor((Date.now() - earliestSaleTimestamp) / (24 * 60 * 60 * 1000)) + 1
          )
        )
      : 7;

    const averageDailySales = totalQuantity > 0 ? totalQuantity / daysObserved : 0;
    const predictedDaysUntilStockout = averageDailySales > 0 ? Math.ceil(product.stockLevel / averageDailySales) : null;
    const last24hSales = dailyQuantity.get(todayKey) || 0;
    const spikeAlert = averageDailySales > 0 && last24hSales >= 3 && last24hSales > averageDailySales * 2;

    const reorderNeeded =
      product.stockLevel <= 5 ||
      (predictedDaysUntilStockout != null && predictedDaysUntilStockout <= 7);

    const riskLevel = product.stockLevel <= 0
      ? "critical"
      : predictedDaysUntilStockout != null && predictedDaysUntilStockout <= 2
      ? "critical"
      : predictedDaysUntilStockout != null && predictedDaysUntilStockout <= 7
      ? "soon"
      : "healthy";

    let recommendationText = "Stock levels are healthy for now.";
    if (product.stockLevel <= 0) {
      recommendationText = "Out of stock — reorder immediately.";
    } else if (predictedDaysUntilStockout != null) {
      recommendationText = `Forecast shows about ${predictedDaysUntilStockout} day${predictedDaysUntilStockout === 1 ? "" : "s"} until stockout.`;
    } else if (totalQuantity === 0) {
      recommendationText = "No recent sales data to forecast demand.";
    }

    return {
      productId: product.id,
      productName: product.productName,
      category: product.category,
      stockLevel: product.stockLevel,
      averageDailySales: Number(averageDailySales.toFixed(2)),
      predictedDaysUntilStockout,
      reorderNeeded,
      riskLevel,
      recommendationText,
      last24hSales,
      spikeAlert,
      isLowStock: product.stockLevel > 0 && product.stockLevel <= 5
    };
  });
}

async function broadcastProducts() {
  const products = await fetchProducts();
  io.emit("products:snapshot", products);
}

io.on("connection", async (socket) => {
  const products = await fetchProducts();
  socket.emit("products:snapshot", products);
});

productsCollection.onSnapshot((snapshot) => {
  const products = snapshot.docs
    .map(mapProduct)
    .sort((a, b) => a.productName.localeCompare(b.productName));

  io.emit("products:snapshot", products);
});

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, service: "RealTrack Inventory System API" });
});

app.get("/api/products", async (_req, res) => {
  try {
    const products = await fetchProducts();
    res.json(products);
  } catch (error) {
    res.status(500).json({
      message: "Failed to fetch products.",
      error: error.message
    });
  }
});

app.get("/api/sales", async (_req, res) => {
  try {
    const sales = await fetchSales();
    res.json(sales);
  } catch (error) {
    res.status(500).json({
      message: "Failed to fetch sales.",
      error: error.message
    });
  }
});

app.get("/api/reports/summary", async (_req, res) => {
  try {
    const [products, sales] = await Promise.all([fetchProducts(), fetchSales()]);
    const totalRevenue = sales.reduce((sum, sale) => sum + sale.totalAmount, 0);
    const totalUnitsSold = sales.reduce((sum, sale) => sum + sale.quantity, 0);
    const lowStockProducts = products.filter(
      (product) => product.stockLevel > 0 && product.stockLevel <= 5
    ).length;
    const outOfStockProducts = products.filter((product) => product.stockLevel <= 0).length;
    const salesByProduct = sales.reduce((accumulator, sale) => {
      const existing = accumulator.get(sale.productId) || {
        productId: sale.productId,
        productName: sale.productName,
        quantity: 0,
        revenue: 0
      };

      existing.quantity += sale.quantity;
      existing.revenue += sale.totalAmount;
      accumulator.set(sale.productId, existing);
      return accumulator;
    }, new Map());

    const topProducts = Array.from(salesByProduct.values())
      .sort((left, right) => right.quantity - left.quantity || right.revenue - left.revenue)
      .slice(0, 5);

    const dailySalesMap = sales.reduce((accumulator, sale) => {
      const dateKey = (sale.createdAt || "").slice(0, 10);

      if (!dateKey) {
        return accumulator;
      }

      const existing = accumulator.get(dateKey) || {
        date: dateKey,
        quantity: 0,
        revenue: 0
      };

      existing.quantity += sale.quantity;
      existing.revenue += sale.totalAmount;
      accumulator.set(dateKey, existing);
      return accumulator;
    }, new Map());

    const dailySales = Array.from(dailySalesMap.values())
      .sort((left, right) => left.date.localeCompare(right.date))
      .slice(-7);

    res.json({
      totalProducts: products.length,
      totalSales: sales.length,
      totalUnitsSold,
      totalRevenue,
      lowStockProducts,
      outOfStockProducts,
      topProducts,
      dailySales
    });
  } catch (error) {
    res.status(500).json({
      message: "Failed to build report summary.",
      error: error.message
    });
  }
});

app.get("/api/recommendations", async (_req, res) => {
  try {
    const [products, recentSales] = await Promise.all([
      fetchProducts(),
      fetchSales({ days: 30, limit: 500 })
    ]);

    const recommendations = buildProductRecommendations(products, recentSales, 30);
    const atRiskCount = recommendations.filter((recommendation) => recommendation.reorderNeeded).length;
    const anomalyAlerts = recommendations
      .filter((recommendation) => recommendation.spikeAlert)
      .map((recommendation) => ({
        productId: recommendation.productId,
        productName: recommendation.productName,
        last24hSales: recommendation.last24hSales,
        averageDailySales: recommendation.averageDailySales
      }));
    const weeklyDemandTrend = buildWeeklyDemandTrend(recentSales, 7);

    res.json({
      recommendations,
      atRiskCount,
      anomalyAlerts,
      weeklyDemandTrend
    });
  } catch (error) {
    res.status(500).json({
      message: "Failed to fetch recommendations.",
      error: error.message
    });
  }
});

app.post("/api/products", async (req, res) => {
  const { category, imageUrl, productName, stockLevel, unitPrice } = req.body;
  const parsedUnitPrice = Number(unitPrice ?? 0);

  if (!productName || typeof stockLevel !== "number") {
    return res.status(400).json({
      message: "productName and numeric stockLevel are required."
    });
  }

  if (!Number.isFinite(parsedUnitPrice) || parsedUnitPrice < 0) {
    return res.status(400).json({
      message: "unitPrice must be a non-negative number."
    });
  }

  try {
    const docRef = await productsCollection.add({
      category: category || "Uncategorized",
      imageUrl: imageUrl || null,
      productName,
      unitPrice: parsedUnitPrice,
      stockLevel,
      lastUpdated: timestamp()
    });

    const product = mapProduct(await docRef.get());
    await broadcastProducts();

    return res.status(201).json(product);
  } catch (error) {
    return res.status(500).json({
      message: "Failed to create product.",
      error: error.message
    });
  }
});

app.post("/api/sales", async (req, res) => {
  const { productId, quantity, unitPrice } = req.body;
  const parsedQuantity = Number(quantity);
  const requestedUnitPrice =
    unitPrice === undefined || unitPrice === null || unitPrice === ""
      ? null
      : Number(unitPrice);

  if (!productId || !Number.isFinite(parsedQuantity) || parsedQuantity <= 0) {
    return res.status(400).json({
      message: "productId and positive numeric quantity are required."
    });
  }

  if (
    requestedUnitPrice !== null &&
    (!Number.isFinite(requestedUnitPrice) || requestedUnitPrice < 0)
  ) {
    return res.status(400).json({
      message: "unitPrice must be a non-negative number."
    });
  }

  try {
    const productRef = productsCollection.doc(productId);
    const saleRef = salesCollection.doc();
    let createdSale = null;

    await productsCollection.firestore.runTransaction(async (transaction) => {
      const productDoc = await transaction.get(productRef);

      if (!productDoc.exists) {
        throw new Error("Product not found.");
      }

      const product = productDoc.data();
      const nextStockLevel = product.stockLevel - parsedQuantity;
      const appliedUnitPrice =
        requestedUnitPrice === null ? Number(product.unitPrice || 0) : requestedUnitPrice;

      if (nextStockLevel < 0) {
        throw new Error("Insufficient stock.");
      }

      const totalAmount = Number((parsedQuantity * appliedUnitPrice).toFixed(2));

      transaction.update(productRef, {
        stockLevel: nextStockLevel,
        lastUpdated: timestamp()
      });

      transaction.set(saleRef, {
        category: product.category || "Uncategorized",
        createdAt: timestamp(),
        productId: productDoc.id,
        productName: product.productName,
        quantity: parsedQuantity,
        totalAmount,
        unitPrice: appliedUnitPrice
      });

      createdSale = {
        id: saleRef.id,
        category: product.category || "Uncategorized",
        productId: productDoc.id,
        productName: product.productName,
        quantity: parsedQuantity,
        totalAmount,
        unitPrice: appliedUnitPrice
      };
    });

    const savedSale = mapSale(await saleRef.get());
    io.emit("sale:created", savedSale);
    io.emit("stock:deducted", {
      productId,
      quantity: parsedQuantity,
      productName: createdSale.productName
    });
    await broadcastProducts();

    return res.status(201).json(savedSale);
  } catch (error) {
    const statusCode =
      error.message === "Product not found."
        ? 404
        : error.message === "Insufficient stock."
          ? 409
          : 500;

    return res.status(statusCode).json({
      message: error.message || "Failed to record sale."
    });
  }
});

app.patch("/api/products/:id/deduct", async (req, res) => {
  const { id } = req.params;
  const amount = Number(req.body.amount ?? 1);

  if (!Number.isFinite(amount) || amount <= 0) {
    return res.status(400).json({
      message: "Deduction amount must be a positive number."
    });
  }

  try {
    const productRef = productsCollection.doc(id);
    let updatedProduct = null;

    await productsCollection.firestore.runTransaction(async (transaction) => {
      const productDoc = await transaction.get(productRef);

      if (!productDoc.exists) {
        throw new Error("Product not found.");
      }

      const product = productDoc.data();
      const nextStockLevel = product.stockLevel - amount;

      if (nextStockLevel < 0) {
        throw new Error("Insufficient stock.");
      }

      transaction.update(productRef, {
        stockLevel: nextStockLevel,
        lastUpdated: timestamp()
      });

      updatedProduct = {
        id: productDoc.id,
        category: product.category || "Uncategorized",
        imageUrl: product.imageUrl || null,
        productName: product.productName,
        stockLevel: nextStockLevel
      };
    });

    io.emit("stock:deducted", updatedProduct);
    await broadcastProducts();

    return res.json(updatedProduct);
  } catch (error) {
    const statusCode =
      error.message === "Product not found."
        ? 404
        : error.message === "Insufficient stock."
          ? 409
          : 500;

    return res.status(statusCode).json({
      message: error.message || "Failed to deduct stock."
    });
  }
});

server.listen(PORT, () => {
  console.log(`RealTrack backend listening on http://localhost:${PORT}`);
});
