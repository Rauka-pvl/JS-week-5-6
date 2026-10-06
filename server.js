// Этап 8–15: REST API на Mongoose (Schema, Model, Validation, error middleware).
// Запуск: npm start

import "dotenv/config";
import express from "express";
import mongoose from "mongoose";
import productRoutes from "./routes/product.routes.js";
import { notFound, errorHandler } from "./middleware/error.middleware.js";

const PORT = process.env.PORT ?? 3000;

const app = express();
app.use(express.json());

app.get("/", (req, res) => {
  res.json({ success: true, message: "Mongo Products API is running (Mongoose)" });
});

app.use("/products", productRoutes);

app.use(notFound);
app.use(errorHandler);

const start = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI, {
      dbName: process.env.DB_NAME ?? "shop",
    });
    console.log(`MongoDB connected (mongoose): ${mongoose.connection.name}`);
    app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
  } catch (error) {
    console.error(`MongoDB connection error: ${error.message}`);
    process.exit(1);
  }
};

start();
