// Этап 1–7: тот же REST API через официальный MongoDB Node.js Driver (без Mongoose).
// Запуск: npm run start:driver

import "dotenv/config";
import express from "express";
import { MongoClient, ObjectId } from "mongodb";
import {
  HttpError,
  parseListQuery,
  buildPaginationInfo,
} from "../utils/queryBuilder.js";

const PORT = process.env.PORT ?? 3000;
const client = new MongoClient(process.env.MONGO_URI);
let products;

const app = express();
app.use(express.json());

const ALLOWED_FIELDS = ["name", "price", "category"];

// ObjectId.isValid() пропускает любую строку из 12 символов,
// поэтому дополнительно сверяем строковое представление.
const toObjectId = (id) => {
  if (!ObjectId.isValid(id) || String(new ObjectId(id)) !== id) {
    throw new HttpError(400, "Invalid ID");
  }
  return new ObjectId(id);
};

const validateProduct = (data, { partial = false } = {}) => {
  const errors = [];
  const { name, price, category } = data;

  if (!partial && (name === undefined || name === null || name === "")) {
    errors.push("name обязателен");
  } else if (name !== undefined && (typeof name !== "string" || name.trim() === "")) {
    errors.push("name должен быть непустой строкой");
  }

  if (!partial && price === undefined) {
    errors.push("price обязателен");
  } else if (price !== undefined && (typeof price !== "number" || Number.isNaN(price))) {
    errors.push("price должен быть числом");
  } else if (price < 0) {
    errors.push("price не может быть меньше 0");
  }

  if (category !== undefined && typeof category !== "string") {
    errors.push("category должна быть строкой");
  }

  if (partial && !ALLOWED_FIELDS.some((field) => field in data)) {
    errors.push(`Передайте хотя бы одно поле: ${ALLOWED_FIELDS.join(", ")}`);
  }

  if (errors.length > 0) throw new HttpError(400, "Validation error", errors);
};

const pickAllowed = (data) =>
  Object.fromEntries(
    Object.entries(data).filter(([key]) => ALLOWED_FIELDS.includes(key))
  );

app.get("/", (req, res) => {
  res.json({ success: true, message: "Mongo Products API is running (MongoDB Driver)" });
});

// GET /products?category=&search=&sort=&page=&limit=&minPrice=&maxPrice=
app.get("/products", async (req, res) => {
  const { filter, sort, page, limit, skip } = parseListQuery(req.query);

  const [items, total] = await Promise.all([
    products.find(filter).sort(sort).skip(skip).limit(limit).toArray(),
    products.countDocuments(filter),
  ]);

  res.json({ success: true, items, pagination: buildPaginationInfo(page, limit, total) });
});

app.get("/products/:id", async (req, res) => {
  const product = await products.findOne({ _id: toObjectId(req.params.id) });
  if (!product) throw new HttpError(404, "Product not found");
  res.json({ success: true, data: product });
});

app.post("/products", async (req, res) => {
  const body = req.body ?? {};
  validateProduct(body);

  const now = new Date();
  const doc = {
    category: "other",
    ...pickAllowed(body),
    name: body.name.trim(),
    createdAt: now,
    updatedAt: now,
  };
  const result = await products.insertOne(doc);

  res.status(201).json({ success: true, data: { _id: result.insertedId, ...doc } });
});

app.patch("/products/:id", async (req, res) => {
  const _id = toObjectId(req.params.id);
  const body = req.body ?? {};
  validateProduct(body, { partial: true });

  const result = await products.updateOne(
    { _id },
    { $set: { ...pickAllowed(body), updatedAt: new Date() } }
  );
  if (result.matchedCount === 0) throw new HttpError(404, "Product not found");

  res.json({ success: true, data: await products.findOne({ _id }) });
});

app.delete("/products/:id", async (req, res) => {
  const result = await products.deleteOne({ _id: toObjectId(req.params.id) });
  if (result.deletedCount === 0) throw new HttpError(404, "Product not found");
  res.json({ success: true, message: "Product deleted" });
});

app.use((req, res) => {
  res.status(404).json({ success: false, message: `Route ${req.method} ${req.originalUrl} not found` });
});

app.use((err, req, res, next) => {
  if (err.type === "entity.parse.failed") {
    return res.status(400).json({ success: false, message: "Invalid JSON" });
  }
  const status = err.status ?? 500;
  if (status >= 500) console.error(err);
  res.status(status).json({
    success: false,
    message: status >= 500 ? "Internal server error" : err.message,
    ...(err.errors && { errors: err.errors }),
  });
});

const start = async () => {
  try {
    await client.connect();
    const db = client.db(process.env.DB_NAME ?? "shop");
    products = db.collection("products");
    console.log(`MongoDB connected (driver): ${db.databaseName}.products`);
    app.listen(PORT, () => console.log(`Server (driver) running on http://localhost:${PORT}`));
  } catch (error) {
    console.error(`MongoDB connection error: ${error.message}`);
    process.exit(1);
  }
};

start();
