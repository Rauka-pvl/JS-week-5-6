# Mongo Products API — Недели 5-6 (Практическая работа №3–4)

REST API интернет-магазина, который хранит товары в MongoDB. Один и тот же API
реализован в два этапа: сначала через официальный **MongoDB Node.js Driver**,
затем слой работы с БД переписан на **Mongoose** (Schema, Model, Validation,
обработка ошибок). Обе версии работают с одной коллекцией `shop.products`.

- **Студент:** Аделканов Рауат
- **Группа:** CS-302(с)
- **Дисциплина:** Веб-программирование на JavaScript

## Технологии

Node.js v24, Express 5, MongoDB 8, MongoDB Node.js Driver 7, Mongoose 9, dotenv,
nodemon, Postman, MongoDB Compass.

## Установка и запуск

1. Нужна запущенная MongoDB. Любой из вариантов:
   - локально: `brew tap mongodb/brew && brew install mongodb-community && brew services start mongodb-community`;
   - Docker: `docker run -d -p 27017:27017 --name mongo mongo`;
   - MongoDB Atlas: подставить строку подключения Atlas в `MONGO_URI`.
2. Установить зависимости и создать `.env` по образцу:

   ```bash
   npm install
   cp .env.example .env
   ```

   ```env
   MONGO_URI=mongodb://localhost:27017
   DB_NAME=shop
   PORT=3000
   ```

   `.env` добавлен в `.gitignore` и не публикуется в Git.

3. Заполнить базу 10 тестовыми товарами (старые товары удаляются):

   ```bash
   npm run seed
   ```

4. Запустить сервер:

   | Команда                | Версия                                |
   | ---------------------- | ------------------------------------- |
   | `npm start`            | Mongoose (финальная версия)           |
   | `npm run dev`          | Mongoose + nodemon                    |
   | `npm run start:driver` | MongoDB Node.js Driver (этапы 1–7)    |
   | `npm run dev:driver`   | Driver + nodemon                      |

   Сервер: `http://localhost:3000`.

## Структура проекта

```
datashare-week5-6/
├── controllers/
│   └── product.controller.js   # createProduct, getProducts, getProductById, updateProduct, deleteProduct
├── middleware/
│   └── error.middleware.js     # 404 + CastError / ValidationError / 500
├── models/
│   └── product.model.js        # Product Schema + Product Model
├── routes/
│   └── product.routes.js       # URL + HTTP-метод -> функция контроллера
├── utils/
│   └── queryBuilder.js         # filter / sort / pagination из req.query (общий для обеих версий)
├── driver/
│   └── server.driver.js        # этапы 1–7: тот же API через MongoClient, без Mongoose
├── data/
│   └── products.js             # 10 товаров для seed
├── scripts/
│   └── seed.js                 # заполнение коллекции shop.products
├── postman/
│   └── Mongo-Products-API.postman_collection.json
├── server.js                   # Mongoose-версия: подключение к БД и запуск
├── .env.example
├── .gitignore
└── package.json
```

## Endpoints

| Метод  | URL              | Назначение       | Driver              | Mongoose                  | Статусы         |
| ------ | ---------------- | ---------------- | ------------------- | ------------------------- | --------------- |
| GET    | `/`              | Проверка сервера | —                   | —                         | 200             |
| POST   | `/products`      | Создать товар    | `insertOne()`       | `Product.create()`        | 201 / 400       |
| GET    | `/products`      | Список товаров   | `find().toArray()`  | `Product.find()`          | 200 / 400       |
| GET    | `/products/:id`  | Один товар       | `findOne()`         | `Product.findById()`      | 200 / 400 / 404 |
| PATCH  | `/products/:id`  | Изменить товар   | `updateOne($set)`   | `findByIdAndUpdate()`     | 200 / 400 / 404 |
| DELETE | `/products/:id`  | Удалить товар    | `deleteOne()`       | `findByIdAndDelete()`     | 200 / 400 / 404 |

PATCH разрешает менять только `name`, `price` и `category`; остальные поля игнорируются.

### Query-параметры `GET /products`

| Параметр              | Пример                        | Как работает                                    |
| --------------------- | ----------------------------- | ----------------------------------------------- |
| `category`            | `?category=computer`          | `{ category: "computer" }`                      |
| `search`              | `?search=lap`                 | `{ name: { $regex: "lap", $options: "i" } }`    |
| `minPrice`/`maxPrice` | `?minPrice=100000`            | `{ price: { $gte: ..., $lte: ... } }`           |
| `sort`                | `?sort=price_asc`             | `price_asc`, `price_desc`, `name_asc`, `name_desc`, `newest`, `oldest` |
| `page` + `limit`      | `?page=2&limit=3`             | `skip = (page - 1) × limit`; по умолчанию `limit=10`, максимум 50 |

Фильтр собирается только из реально переданных параметров (`buildFilter` в
`utils/queryBuilder.js`), и `countDocuments(filter)` считает `total` для того же
фильтра. `page`/`limit` <= 0 и `limit` > 50 возвращают 400.

```
GET /products?category=computer&search=lap&page=1&limit=2
```

```json
{
  "success": true,
  "items": [
    { "_id": "6ac4763340f3e58af9ee3fe8", "name": "Lenovo ThinkPad Laptop", "price": 520000, "category": "computer", "createdAt": "...", "updatedAt": "..." },
    { "_id": "6ac4763340f3e58af9ee3fe9", "name": "ASUS ZenBook Laptop", "price": 450000, "category": "computer", "createdAt": "...", "updatedAt": "..." }
  ],
  "pagination": { "page": 1, "limit": 2, "total": 3, "pages": 2 }
}
```

## Этап 1: MongoDB Node.js Driver

`driver/server.driver.js` — вся первая часть работы в одном файле, Mongoose там не
используется:

- `MongoClient` подключается по `MONGO_URI`, затем `client.db("shop").collection("products")`;
- CRUD через `insertOne`, `find({}).toArray()`, `findOne`, `updateOne` с `$set`, `deleteOne`;
- `req.params.id` перед запросом превращается в `ObjectId`. Строка вроде `abc123`
  даёт 400 `Invalid ID`, а корректный, но несуществующий ID — 404;
- ручная проверка body: `name` обязателен, `price` — неотрицательное число,
  `category` — строка;
- `createdAt`/`updatedAt` проставляются вручную (в Mongoose это делает `timestamps`).

## Этап 2: Mongoose

**Product Schema** (`models/product.model.js`):

| Поле       | Правила                                                    |
| ---------- | ---------------------------------------------------------- |
| `name`     | String, required, trim, minlength 2, maxlength 100         |
| `price`    | Number, required, min 0                                    |
| `category` | String, enum `computer` / `phone` / `other`, default `other` |
| —          | `timestamps: true` → `createdAt`, `updatedAt`              |

При обновлении используются `runValidators: true` (без него Schema не проверяет
данные при update) и `returnDocument: "after"`, чтобы вернуть уже обновлённый
документ. `returnDocument: "after"` — это то же самое, что `new: true` из лекции:
в Mongoose 9 опция `new` объявлена устаревшей и выводит предупреждение.

### Обработка ошибок (`middleware/error.middleware.js`)

| Ошибка                              | Статус | Ответ                                         |
| ----------------------------------- | ------ | --------------------------------------------- |
| `CastError` (`/products/abc123`)    | 400    | `{ "message": "Invalid ID", "details": ... }` |
| `ValidationError`                   | 400    | `{ "message": "Validation error", "errors": { поле: сообщение } }` |
| Некорректные query-параметры        | 400    | список ошибок                                 |
| Некорректный JSON в теле            | 400    | `Invalid JSON`                                |
| Товар не найден                     | 404    | `Product not found`                           |
| Неизвестный маршрут                 | 404    | `Route ... not found`                         |
| Любая другая ошибка                 | 500    | `Internal server error` (stack trace только в консоли сервера) |

Пример ValidationError (`POST { "name": "A", "price": -5, "category": "food" }`):

```json
{
  "success": false,
  "message": "Validation error",
  "errors": {
    "name": "name должен содержать минимум 2 символа",
    "price": "price не может быть меньше 0",
    "category": "category должна быть одной из: computer, phone, other"
  }
}
```

Контроллеры — `async`-функции без `try/catch`: Express 5 сам передаёт ошибку
отклонённого промиса в error middleware.

## Postman

Коллекция `postman/Mongo-Products-API.postman_collection.json` (Postman → **Import**),
31 запрос с автотестами, три папки:

1. **Основные тесты** — 14 запросов строго в порядке из задания (POST, ValidationError,
   список, один товар, CastError, фильтр, поиск, сортировка, две страницы, PATCH,
   PATCH ValidationError, DELETE, проверка удаления). `productId` сохраняется
   автоматически из ответа на POST.
2. **Validation** — отрицательные тесты Schema: без `name`, `name` < 2 и > 100 символов,
   без `price`, `price` < 0, `category` вне enum, неправильные PATCH, значение по умолчанию
   `category = other`.
3. **Дополнительно** — `category` + `search`, `price_desc`, `minPrice`/`maxPrice`,
   `page=0`, `limit=100`, несуществующий ObjectId, неизвестный маршрут.

Перед запуском коллекции выполните `npm run seed`. Папки 1 и 3 проходят и на версии
с Driver (`npm run start:driver`), папка 2 — только на Mongoose, потому что enum и
длину `name` проверяет Schema.

## Проверка в MongoDB Compass

Подключиться к `mongodb://localhost:27017` → база `shop` → коллекция `products`.
Видны документы, поле `_id` типа ObjectId, а у документов, созданных через Mongoose, —
`createdAt` и `updatedAt`. После каждого POST/PATCH/DELETE обновите вид (Refresh),
чтобы увидеть изменения.

## Ответы на вопросы преподавателя

**1. Что такое database, collection, document и field?**

**Database** — база данных, контейнер для коллекций (у нас `shop`). **Collection** —
набор документов, аналог таблицы в SQL (`products`), но без жёсткой схемы.
**Document** — одна запись в формате BSON (двоичный JSON), аналог строки:
`{ _id, name, price, category }`. **Field** — пара «ключ — значение» внутри документа,
аналог столбца (`price: 500000`).

**2. Зачем нужен ObjectId?**

`ObjectId` — 12-байтовый уникальный идентификатор, который MongoDB по умолчанию
присваивает полю `_id` каждого документа. Он генерируется без обращения к базе,
уникален даже в распределённой системе и содержит метку времени создания.
По `_id` документ однозначно находится, изменяется и удаляется.

**3. Почему ID из URL нужно проверять?**

`req.params.id` — это строка от клиента, и в ней может быть что угодно (`abc123`).
`new ObjectId("abc123")` выбрасывает исключение, а в Mongoose `findById` даёт
`CastError`. Без проверки сервер вернёт 500 или вообще упадёт. Поэтому неправильный
формат обрабатывается отдельно и возвращает понятный 400 `Invalid ID`, а корректный,
но отсутствующий ID — 404.

**4. Что такое CRUD?**

Четыре базовые операции с данными: **C**reate — создание (`POST`, `insertOne` /
`Product.create`), **R**ead — чтение (`GET`, `find`, `findOne` / `findById`),
**U**pdate — изменение (`PATCH`, `updateOne` / `findByIdAndUpdate`), **D**elete —
удаление (`DELETE`, `deleteOne` / `findByIdAndDelete`).

**5. Как работает $regex?**

`$regex` — оператор поиска по регулярному выражению. `{ name: { $regex: "lap", $options: "i" } }`
находит все документы, у которых в `name` есть подстрока `lap` в любом регистре
(`i` — case-insensitive): `Lenovo ThinkPad Laptop`, `MSI Gaming Laptop`. Перед вставкой
в выражение спецсимволы из строки поиска экранируются, чтобы ввод пользователя
искался буквально.

**6. Зачем skip, limit и countDocuments?**

Это пагинация: не отдавать клиенту всю коллекцию сразу. `skip((page - 1) * limit)`
пропускает документы предыдущих страниц, `limit(limit)` ограничивает размер страницы,
а `countDocuments(filter)` считает общее число документов **для того же фильтра** —
из него вычисляются `total` и `pages = ceil(total / limit)`, чтобы клиент знал,
сколько всего страниц.

**7. Почему MONGO_URI хранится в .env?**

Строка подключения может содержать логин и пароль от базы (особенно в Atlas).
Если записать её в код, она попадёт в Git и станет доступна всем. В `.env` настройки
хранятся отдельно от кода, `.env` добавлен в `.gitignore`, а для разных окружений
(локально, на сервере) достаточно поменять файл, не трогая код. В репозитории лежит
только шаблон `.env.example` без секретов.

**8. Что такое Mongoose?**

Mongoose — ODM (Object Data Modeling) библиотека для MongoDB в Node.js. Поверх
драйвера она добавляет описание структуры документов через Schema, Model с удобными
методами CRUD, приведение типов, встроенную валидацию, значения по умолчанию,
`timestamps`, middleware (хуки) и связи между коллекциями.

**9. Чем Schema отличается от Model?**

**Schema** — описание (чертёж) документа: какие поля есть, их типы, ограничения
(`required`, `min`, `enum`), значения по умолчанию и опции (`timestamps`). Сама по
себе с базой не работает. **Model** создаётся из схемы
(`mongoose.model("Product", productSchema)`), связана с коллекцией `products` и
предоставляет методы работы с данными: `Product.find()`, `Product.create()` и т. д.

**10. Зачем server-side validation?**

Клиенту доверять нельзя: проверку в браузере легко обойти, а запрос можно отправить
напрямую через Postman или curl. Только проверка на сервере гарантирует, что
в базу не попадут товар без названия, отрицательная цена или несуществующая категория.
Клиентская валидация нужна лишь для удобства пользователя.

**11. Почему при update нужен runValidators: true?**

По умолчанию Mongoose запускает валидаторы Schema только при создании документа
(`create`/`save`). Методы `findByIdAndUpdate` и `updateOne` отправляют изменения
в базу напрямую и правила схемы **не проверяют**. Без `runValidators: true` через
PATCH можно записать `price: -100` или `category: "food"`.

**12. Чем CastError отличается от ValidationError?**

**CastError** — Mongoose не смог привести значение к нужному типу: чаще всего
некорректный ObjectId в `/products/abc123`. **ValidationError** — значение нужного
типа, но нарушает правила схемы: нет обязательного поля, `name` короче 2 символов,
`price < 0`, `category` вне enum. Он содержит `errors` с сообщением по каждому полю.
Обе ошибки возвращают 400, но с разными сообщениями.

**13. Зачем разделять Route, Controller, Model и Middleware?**

У каждого слоя одна ответственность. **Route** — какой URL и HTTP-метод обрабатываются.
**Controller** — сценарий запроса: прочитать данные, вызвать модель, сформировать ответ.
**Model** — структура данных и работа с MongoDB. **Middleware** — общая логика для многих
запросов (обработка ошибок, а дальше — авторизация). Такой код легче читать,
тестировать и расширять: например, при переходе с Driver на Mongoose поменялся
только слой работы с БД, а маршруты и формат ответов остались прежними.
