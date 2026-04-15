import "dotenv/config";
import cors from "cors";
import express from "express";
import http from "http";
import { Server } from "socket.io";
import { productsCollection, timestamp } from "./firebase.js";

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
    stockLevel: data.stockLevel,
    lastUpdated: data.lastUpdated?.toDate?.()?.toISOString() || null
  };
}

async function fetchProducts() {
  const snapshot = await productsCollection.orderBy("productName").get();
  return snapshot.docs.map(mapProduct);
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

app.post("/api/products", async (req, res) => {
  const { category, imageUrl, productName, stockLevel } = req.body;

  if (!productName || typeof stockLevel !== "number") {
    return res.status(400).json({
      message: "productName and numeric stockLevel are required."
    });
  }

  try {
    const docRef = await productsCollection.add({
      category: category || "Uncategorized",
      imageUrl: imageUrl || null,
      productName,
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
