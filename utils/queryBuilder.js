// Построение filter / sort / pagination из req.query.
// Используется и в версии на Driver, и в версии на Mongoose:
// синтаксис фильтров MongoDB у них общий.

export const MAX_LIMIT = 50;
const DEFAULT_LIMIT = 10;

export const SORT_OPTIONS = {
  price_asc: { price: 1, _id: 1 },
  price_desc: { price: -1, _id: 1 },
  name_asc: { name: 1, _id: 1 },
  name_desc: { name: -1, _id: 1 },
  newest: { createdAt: -1, _id: -1 },
  oldest: { createdAt: 1, _id: 1 },
};

export class HttpError extends Error {
  constructor(status, message, errors) {
    super(message);
    this.status = status;
    this.errors = errors;
  }
}

const escapeRegex = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const parsePrice = (value, name, errors) => {
  if (value === undefined) return undefined;
  const number = Number(value);
  if (value === "" || Number.isNaN(number) || number < 0) {
    errors.push(`${name} должен быть неотрицательным числом`);
    return undefined;
  }
  return number;
};

const parsePositiveInt = (value, name, fallback, errors) => {
  if (value === undefined) return fallback;
  const number = Number(value);
  if (!Number.isInteger(number) || number <= 0) {
    errors.push(`${name} должен быть целым числом больше 0`);
    return fallback;
  }
  return number;
};

// Фильтр собирается только из реально переданных параметров
export const buildFilter = ({ category, search, minPrice, maxPrice } = {}, errors = []) => {
  const filter = {};

  if (category) filter.category = category;
  if (search) filter.name = { $regex: escapeRegex(search.trim()), $options: "i" };

  const min = parsePrice(minPrice, "minPrice", errors);
  const max = parsePrice(maxPrice, "maxPrice", errors);
  if (min !== undefined || max !== undefined) {
    filter.price = {};
    if (min !== undefined) filter.price.$gte = min;
    if (max !== undefined) filter.price.$lte = max;
  }

  return filter;
};

export const buildSort = (sort, errors = []) => {
  if (sort === undefined) return { _id: 1 };
  if (!SORT_OPTIONS[sort]) {
    errors.push(`sort может быть одним из: ${Object.keys(SORT_OPTIONS).join(", ")}`);
    return { _id: 1 };
  }
  return SORT_OPTIONS[sort];
};

export const buildPagination = ({ page, limit } = {}, errors = []) => {
  const pageNum = parsePositiveInt(page, "page", 1, errors);
  const limitNum = parsePositiveInt(limit, "limit", DEFAULT_LIMIT, errors);
  if (limitNum > MAX_LIMIT) errors.push(`limit не может быть больше ${MAX_LIMIT}`);
  return { page: pageNum, limit: limitNum, skip: (pageNum - 1) * limitNum };
};

// Собирает всё вместе; при некорректных параметрах выбрасывает HttpError 400
export const parseListQuery = (query = {}) => {
  const errors = [];
  const filter = buildFilter(query, errors);
  const sort = buildSort(query.sort, errors);
  const pagination = buildPagination(query, errors);

  if (errors.length > 0) {
    throw new HttpError(400, "Некорректные параметры запроса", errors);
  }
  return { filter, sort, ...pagination };
};

export const buildPaginationInfo = (page, limit, total) => ({
  page,
  limit,
  total,
  pages: Math.ceil(total / limit),
});
