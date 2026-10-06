// Неизвестный маршрут -> 404 JSON
export const notFound = (req, res) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.method} ${req.originalUrl} not found`,
  });
};

// Централизованный обработчик ошибок (Express определяет его по 4 аргументам)
export const errorHandler = (err, req, res, next) => {
  // Некорректный ObjectId: /products/abc123
  if (err.name === "CastError") {
    return res.status(400).json({
      success: false,
      message: "Invalid ID",
      details: `Значение "${err.value}" не является корректным ${err.kind}`,
    });
  }

  // Нарушены правила Schema: собираем сообщения по каждому полю
  if (err.name === "ValidationError") {
    const errors = Object.fromEntries(
      Object.entries(err.errors).map(([field, error]) => [field, error.message])
    );
    return res.status(400).json({ success: false, message: "Validation error", errors });
  }

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
};
