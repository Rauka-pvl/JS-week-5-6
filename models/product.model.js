import mongoose from "mongoose";

export const CATEGORIES = ["computer", "phone", "other"];

const productSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "name обязателен"],
      trim: true,
      minlength: [2, "name должен содержать минимум 2 символа"],
      maxlength: [100, "name должен содержать не более 100 символов"],
    },
    price: {
      type: Number,
      required: [true, "price обязателен"],
      min: [0, "price не может быть меньше 0"],
    },
    category: {
      type: String,
      enum: {
        values: CATEGORIES,
        message: `category должна быть одной из: ${CATEGORIES.join(", ")}`,
      },
      default: "other",
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

const Product = mongoose.model("Product", productSchema);

export default Product;
