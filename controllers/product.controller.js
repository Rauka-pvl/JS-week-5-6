// Express 5 сам передаёт ошибки (rejected promise) из async-обработчиков
// в error middleware, поэтому try/catch + next(error) здесь не нужен.

import Product from "../models/product.model.js";
import {
  HttpError,
  parseListQuery,
  buildPaginationInfo,
} from "../utils/queryBuilder.js";

const ALLOWED_FIELDS = ["name", "price", "category"];

const pickAllowed = (data = {}) =>
  Object.fromEntries(
    Object.entries(data).filter(([key]) => ALLOWED_FIELDS.includes(key))
  );

// POST /products
export const createProduct = async (req, res) => {
  const product = await Product.create(pickAllowed(req.body));
  res.status(201).json({ success: true, data: product });
};

// GET /products?category=&search=&sort=&page=&limit=&minPrice=&maxPrice=
export const getProducts = async (req, res) => {
  const { filter, sort, page, limit, skip } = parseListQuery(req.query);

  const [items, total] = await Promise.all([
    Product.find(filter).sort(sort).skip(skip).limit(limit),
    Product.countDocuments(filter),
  ]);

  res.json({ success: true, items, pagination: buildPaginationInfo(page, limit, total) });
};

// GET /products/:id — некорректный id вызывает CastError (обрабатывается в middleware)
export const getProductById = async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (!product) throw new HttpError(404, "Product not found");
  res.json({ success: true, data: product });
};

// PATCH /products/:id
export const updateProduct = async (req, res) => {
  const updates = pickAllowed(req.body);
  if (Object.keys(updates).length === 0) {
    throw new HttpError(400, `Передайте хотя бы одно поле: ${ALLOWED_FIELDS.join(", ")}`);
  }

  // returnDocument: "after" — современная замена устаревшего в Mongoose 9 `new: true`
  const product = await Product.findByIdAndUpdate(req.params.id, updates, {
    returnDocument: "after",
    runValidators: true,
  });
  if (!product) throw new HttpError(404, "Product not found");

  res.json({ success: true, data: product });
};

// DELETE /products/:id
export const deleteProduct = async (req, res) => {
  const product = await Product.findByIdAndDelete(req.params.id);
  if (!product) throw new HttpError(404, "Product not found");
  res.json({ success: true, message: "Product deleted", data: product });
};
