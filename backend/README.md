# Vintage Dress : API

Windows local setup without Docker: follow the root [README](../README.md). `npm run db:up` from project root runs portable MariaDB and imports this API's schema automatically. Manual MySQL setup remains available below.

Student catalog: `npm run seed:catalog` from project root adds 36 sample dresses with local photos, without duplicating existing product names. Product create/update endpoints accept `multipart/form-data`: `name`, `price`, `category_id` and file field `image`. Creation requires a photo; update can omit it to retain current photo. Principal admin JWT required. Photos are served from `/uploads/`. Back up `backend/uploads/` with the database.

Product forms also accept integer `stock` (0–1,000,000); new API products default to 1, sample SQL products to 20. Checkout reserves stock transactionally. Cancelled orders restock once; delivered/cancelled states are final. Customer request recovery: `GET /api/orders/request/:key`. Account endpoints under `/api/account` require a customer session: addresses (GET/POST, DELETE by ID, PATCH `/:id/default`), favorites (GET, PUT/DELETE by product ID), preferences (GET/PATCH with three boolean keys `orders`, `offers`, `news`). Categories support principal-only PUT/DELETE by ID; used categories cannot be deleted. Run migrations before starting an existing database.

1. `npm install`
2. `cp .env.example .env` puis remplir (JWT_SECRET, mot de passe MySQL, ADMIN_PASSWORD)
3. `mysql -u root -p < schema.sql`
4. `npm run seed` (crée l'admin principal)
5. `npm run dev` → http://localhost:5000/api/health

## Routes

Checkout: `POST /api/orders` requires customer JWT, `items` (`product_id`, integer `quantity`, `size`, `color`), `delivery` (`name`, `phone`, `city`, `address`), `payment_method: "cash_on_delivery"`, numeric `expected_total`, and UUID-v4 `request_key`. Reusing the same key/payload returns the original order. Different payload with an existing key returns 409. Changed totals return 409 with `code: "PRICE_CHANGED"`. Customer history: `GET /api/orders/mine`; details: `GET /api/orders/:id` (own order or admin). Principal admins update status through `PATCH /api/orders/:id/status`.

Shared website login: `/login`. Both account types authenticate through `POST /api/auth/login`; response `type` selects customer account or admin dashboard. Public signup creates customers only. `GET /api/auth/me` validates a session; `PATCH /api/auth/profile` and `PATCH /api/auth/password` update customer account data. `/api/admin/login` remains as a compatibility API endpoint; the separate browser admin login page redirects to shared login.
| Méthode | Route | Accès |
|---|---|---|
| POST | /api/admin/login | public (limité à 10 essais / 15 min) |
| POST | /api/auth/register, /api/auth/login | public |
| GET | /api/products, /api/categories | public |
| POST | /api/messages | public |
| POST | /api/orders, GET /api/orders/mine | client connecté |
| GET | /api/orders, /api/admin/stats, /api/admin/messages | admin (principal ou secondaire) |
| POST/PUT/DELETE | /api/products, POST /api/categories | principal |
| PATCH | /api/orders/:id/status | principal |
| GET/PATCH | /api/admin/users, /api/admin/users/:id/block | principal |
| GET/POST/DELETE | /api/admin/admins | principal |
