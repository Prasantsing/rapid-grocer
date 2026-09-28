use this to clone in u r device :  git clone https://github.com/Prasantsing/rapid-grocer.git
# ZapBasket

ZapBasket is a quick-commerce grocery app: customers shop a dark-store catalog, admins run the desk, and delivery partners move orders from packed to delivered. The promise on the shelf is about 12 minutes.

## Stack

- Angular 20 storefront with Bootstrap 5
- Node.js and Express REST API
- MongoDB (Atlas, local, or Docker)
- JWT access tokens and rotating refresh tokens
- Role permissions for admin, customer, and delivery partner
- Razorpay checkout, with a demo mode when keys are absent
- Swagger UI and a Postman collection

## Run it locally

Use Node.js 20 or newer and a MongoDB instance.

```bash
cd backend
cp .env.example .env
npm install
npm run dev
```

```bash
cd frontend
npm install
npm start
```

The API listens on [http://127.0.0.1:43110](http://127.0.0.1:43110). Swagger is at [http://127.0.0.1:43110/api/docs](http://127.0.0.1:43110/api/docs). The store listens on [http://127.0.0.1:43121](http://127.0.0.1:43121) and proxies `/api` to the API, so the refresh-token cookie stays on the same origin.

An empty database is seeded on first boot outside production. Reset it any time:

```bash
npm run seed --prefix backend
```

### Demo desks

| Role | Email | Password |
| --- | --- | --- |
| Admin | admin@zapbasket.dev | Admin@12345 |
| Customer | aisha@zapbasket.dev | Customer@123 |
| Delivery | ravi@zapbasket.dev | Delivery@123 |

The login screen can open each desk directly.

### MongoDB Atlas

Set `MONGODB_URI` in `backend/.env` to your Atlas connection string. Leave `USE_MEMORY_MONGO` unset. In production also set `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `CLIENT_ORIGIN`, and `COOKIE_SECURE=true` behind HTTPS.

### Razorpay

Set `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET` for live orders. Without them, checkout returns `mode: "demo"` and the store shows a simulate-payment step. No charge is sent.

### Docker

```bash
docker compose up --build
```

The compose file starts MongoDB, the API on port 43110, and the store on port 43121. Change the JWT secrets before using that stack anywhere but a laptop.

## Tests

```bash
npm test --prefix backend
```

Domain tests cover coupons, delivery fees, status transitions, and permission overrides. The API test boots an in-memory MongoDB and walks register validation, coupon checkout, delivery, and demo Razorpay verification.

## Layout

```
backend/src
  config/        environment, database, permissions, Swagger
  domain/        pricing and order-state rules
  models/        Mongoose schemas
  repositories/  queries
  services/      business rules
  controllers/   HTTP adapters
  routes/        REST surface
  middleware/    auth, permissions, validation, errors
  validators/    Zod schemas
  seed/          catalog and demo accounts
frontend/src/app
  core/          auth, HTTP, guards
  layout/        store, admin, and rider shells
  pages/         customer, admin, and delivery screens
postman/ZapBasket.postman_collection.json
```

## API

All routes are under `/api/v1`. Responses look like `{ "success": true, "data": {} }`. Failures use `{ "success": false, "message": "", "errors": [] }`.

Access tokens expire in 15 minutes. Send `Authorization: Bearer <accessToken>`. Refresh tokens rotate: `POST /auth/refresh` accepts the httpOnly cookie or `{ "refreshToken": "..." }` and revokes the previous token.

Customers can browse without an account. Cart, wishlist, addresses, checkout, and notifications require a customer. Admin routes live under `/admin` and check permissions such as `products:write` and `orders:manage`. A delivery partner uses `GET /orders?scope=available|active|history`, `POST /orders/:id/accept`, and `PATCH /orders/:id/status`.

Free delivery starts at ₹299. Below that, delivery is ₹25. Stock is reserved when an order is placed and returned when the order is cancelled.

Import `postman/ZapBasket.postman_collection.json` and set `baseUrl` if the API is not on port 43110. Run a login request first so the collection stores the access token.
