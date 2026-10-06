// Заполняет shop.products начальными товарами (старые товары удаляются).
// Запуск: npm run seed

import "dotenv/config";
import mongoose from "mongoose";
import Product from "../models/product.model.js";
import { products } from "../data/products.js";

try {
  await mongoose.connect(process.env.MONGO_URI, {
    dbName: process.env.DB_NAME ?? "shop",
  });
  await Product.deleteMany({});
  const created = await Product.insertMany(products);
  console.log(`Добавлено товаров: ${created.length} в ${mongoose.connection.name}.products`);
} catch (error) {
  console.error(`Ошибка заполнения базы: ${error.message}`);
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}
