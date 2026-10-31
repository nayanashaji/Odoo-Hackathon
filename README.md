# Brightloop Subscription Management System

Brightloop is a web application prototype for managing the recurring-revenue workflow of a subscription business. The project is being developed for the Odoo x Make-A-Ton 9.0 Kochi Hackathon 2026. Its domain covers customers and staff, products and variants, plans, discounts, subscriptions, invoices, payments, and finance reporting.

The repository combines a React single-page frontend with a Node.js/Express API and MongoDB. The shared data contract is documented in [`docs/schema.json`](docs/schema.json).

## Team

All team members are from **Government Engineering College Thrissur**.

| Name | Team role |
| --- | --- |
| Nayana Shaji Mekkunnel | Team leader |
| Jany Sabarinath | Team member |
| Joseph John Paul | Team member |
| Mridul Joy | Team member |

## Features in the current application

- Customer registration and sign-in, with hashed credentials and signed JWT sessions.
- Password-reset request and confirmation flow. In development, reset messages use an Ethereal test inbox; SMTP can be configured for a real mail service.
- Admin-only creation and listing of staff accounts.
- Role-protected finance summary for admin and staff users, including active subscriptions, collected revenue, outstanding invoices, overdue invoice count/list, and recent monthly collections.
- Product catalog API with CRUD operations, product variants, and variant-price calculation.
- React Router navigation for authentication, the finance dashboard, staff management, and product catalog.
- Sample product data seeding through `seed.js`.

## Technology

- **Frontend:** React 18, React Router, Vite
- **Backend:** Node.js, Express, Mongoose, JWT, bcryptjs, Nodemailer
- **Database:** MongoDB

## Repository layout

```text
backend/
  src/
    controllers/   Authentication, finance, products, quote templates
    middleware/    Authentication and role checks
    models/        User, credentials, products, quote templates
    routes/        Product and quote-template route definitions
    services/      Password-reset email delivery
    index.js       Main Express API server
  .env.example     Backend configuration template
frontend/
  src/
    App.jsx        Application routes and protected views
    pages/         Auth, finance, product, admin, sales and plan UI code
docs/
  schema.json      Shared example data contract
seed.js            Sample product catalog data
```

## Requirements

Install the following before running the application:

- Node.js 18 or newer, with npm
- MongoDB Community Server, running locally, or a reachable MongoDB connection string

## Run locally

Open two PowerShell terminals from the repository directory.

### 1. Configure the backend

```powershell
cd backend
npm install
Copy-Item .env.example .env
```

Edit `backend/.env` and set at least:

```dotenv
PORT=5000
MONGODB_URI=mongodb://127.0.0.1:27017/brightloop_odoo
JWT_SECRET=replace-with-a-long-random-secret
APP_URL=http://localhost:5173
BOOTSTRAP_ADMIN_EMAIL=admin@example.com
BOOTSTRAP_ADMIN_PASSWORD=Choose-A-Strong-Password!
```

Use a private password of 9–72 bytes containing uppercase, lowercase, and a special character. Keep `.env` local; it is ignored by Git. When the API connects to MongoDB, it creates the bootstrap admin only if that email does not already exist. The password is stored as a hash.

Start the API:

```powershell
npm run dev
```

The API listens on `http://localhost:5000`. Check `http://localhost:5000/api/health` for a health response.

### 2. Start the frontend

In a second terminal, from the repository directory:

```powershell
cd frontend
npm install
npm run dev
```

Open the Vite URL shown in the terminal, usually `http://localhost:5173`.

The frontend defaults to `http://localhost:5000/api` for API requests. To use a different API URL, create `frontend/.env.local` with:

```dotenv
VITE_API_URL=http://localhost:5000/api
```

Restart Vite after changing frontend environment variables.

### 3. Sign in and explore

- `/login` — sign in
- `/register` — create a customer account
- `/forgot-password` — request a password reset
- `/finance` — finance workspace for admin/staff accounts
- `/admin/users` — admin-only staff management
- `/products` — product catalog

Use the admin email and password configured in `backend/.env`. Registration creates a customer account; customers cannot access the finance workspace. An admin can create staff accounts from **User Management**.

### Optional: seed sample products

With MongoDB running, from `backend/` run:

```powershell
npm run seed
```

This replaces the product catalog with the five sample products (and also writes the offline JSON snapshot). It does not provision invoice, payment, subscription, or finance sample records.

## API overview

All routes below are served by the main Node server on port 5000.

| Method | Endpoint | Access | Purpose |
| --- | --- | --- | --- |
| `GET` | `/api/health` | Public | API health check |
| `POST` | `/api/auth/register` | Public | Register a customer |
| `POST` | `/api/auth/login` | Public | Sign in and receive a JWT |
| `GET` | `/api/auth/me` | Signed in | Get the current account |
| `POST` | `/api/auth/staff` | Admin | Create a staff account |
| `GET` | `/api/auth/staff` | Admin | List staff accounts |
| `POST` | `/api/auth/password-reset/request` | Public | Request a reset link |
| `POST` | `/api/auth/password-reset/confirm` | Public, reset token required | Set a new password |
| `GET` | `/api/finance/summary?period=month` | Admin or staff | Finance metrics; `period` accepts `month`, `year`, or `all` |
| `GET` | `/api/products` | Public | List products |
| `POST` | `/api/products` | Public in current API | Create a product |
| `GET` | `/api/products/:id` | Public | Read a product |
| `PUT` | `/api/products/:id` | Public in current API | Update a product |
| `DELETE` | `/api/products/:id` | Public in current API | Delete a product |
| `POST` | `/api/products/:id/variants` | Public in current API | Add a product variant |
| `DELETE` | `/api/products/:id/variants/:variantId` | Public in current API | Remove a product variant |
| `GET` | `/api/products/:id/calculate-price?variantId=var_1` | Public | Calculate base plus variant price |

For protected API calls, pass the token in `Authorization: Bearer <token>`. Product endpoints currently do not enforce authentication or roles.

## Data model notes

The shared schema includes `User`, `Product` (with `variants`), `Plan`, `Discount`, `Subscription` (with `lines`), `Invoice`, and `Payment`. Finance reporting reads invoice, payment, and subscription data from MongoDB collections. Invoices use `due_date` for overdue calculations, and payments use `payment_date` for revenue-by-period calculations. See [`docs/schema.json`](docs/schema.json) for the repository’s current example contract.

## Current implementation boundaries

Some plan-management and quote-template UI/API work is present in the repository, but the main frontend router and `backend/src/index.js` currently expose only the routes listed above. The main server does not currently mount the quote-template route module, and the plan and quote pages are not reachable through the default React Router. Finance summaries also require subscription, invoice, and payment documents to have been inserted into MongoDB; the included seed script only seeds products.

## Security and deployment notes

- Never commit `.env`, real SMTP credentials, JWT secrets, or production passwords.
- Configure an SMTP provider before using password-reset email outside development. The Ethereal fallback is a test inbox and does not deliver to a user's real mailbox.
- The current product API is open; add authentication and authorization before exposing it outside a local/demo environment.
- Set `NODE_ENV=production` and provide production-grade secrets, database access controls, and SMTP settings for deployment.

## Project status

This is a hackathon prototype. Use the feature branches and pull requests in the repository for team review and integration; the main branch is the shared integration target.
