# Brightloop Subscription Management System

Brightloop is a subscription-management prototype developed for the Odoo x Make-A-Ton 9.0 Kochi Hackathon 2026. It models the recurring-revenue workflow from product and plan selection through subscription lifecycle, invoicing, discounts, payments, and finance reporting.

The project uses a React single-page frontend, Node.js/Express backend modules, and MongoDB models. Some modules currently use in-memory or example data. See [the schema contract](docs/schema.json) for the repository's shared entity examples.

## Team

All team members are from **Government Engineering College Thrissur**.

| Name | Role |
| --- | --- |
| Nayana Shaji Mekkunnel | Team leader |
| Jany Sabarinath | Team member |
| Joseph John Paul | Team member |
| Mridul Joy | Team member |

## Product capabilities represented in the repository

- **Accounts and roles:** customer registration and login flows, admin/staff roles, and admin staff-management UI/API modules.
- **Product catalog:** product and variant records, price modifiers, and price calculation.
- **Plans:** billing frequency, minimum quantity, availability dates, and subscription closing behavior.
- **Quotation templates:** validity periods, preview, duplication, and quote-generation modules.
- **Subscription lifecycle:** Draft → Quotation → Confirmed → Active → Closed, with transition validation.
- **Billing:** invoice totals, tax and due-date calculations, discount rules, invoice status, and payment records.
- **Customer and finance views:** customer portal UI and a finance dashboard with revenue, outstanding balance, and overdue invoice summaries.
- **Password recovery:** reset-token and mailer modules, with Ethereal intended for development and SMTP settings for external mail.

These capabilities are represented by code and screens, but the current default server does not connect all of them. See [Known integration status](#known-integration-status) before trying to demo or deploy the full workflow.

## Technology

- React 18, React Router, and Vite
- Node.js and Express
- MongoDB and Mongoose models
- JWT sessions and bcrypt password hashing
- Jest and Supertest for backend tests

## Repository map

```text
backend/
  server.js                   Current `npm start` entry point
  src/
    controllers/              Auth, finance, invoices, discounts, plans,
                               products, quotes, payments, subscriptions
    middleware/               Authentication and access checks
    models/                   MongoDB entity models
    routes/                   Express route modules
    services/                 Billing and email services
  tests/                      Jest suites and standalone verification scripts
  .env.example                Intended backend environment template
frontend/
  src/
    App.jsx                   React Router and role-based page wrappers
    components/               Shared application layout and tables
    pages/                    Auth, customer, finance, admin, sales views
docs/
  schema.json                 Shared entity examples
seed.js                       Sample product catalog seed utility
```

## Prerequisites

- Node.js 18 or newer and npm
- MongoDB Community Server or a MongoDB Atlas database for database-backed modules

## Install and run the current entry points

From the repository root, use two terminals.

### Backend

```powershell
cd backend
npm ci
npm start
```

The current `npm start` command launches `backend/server.js` on port `5000`. Its root endpoint is `http://localhost:5000/`.

### Frontend

```powershell
cd frontend
npm ci
npm run dev
```

Open the Vite URL printed in the terminal, usually `http://localhost:5173`.

The frontend uses `/api` modules and several pages currently default to `http://localhost:5000`. Some pages use `VITE_API_URL`; others have a hardcoded local API URL. The latter will need a configuration update for a deployed backend.

## Application routes

The current React Router defines these paths:

| Path | View |
| --- | --- |
| `/login` | Sign in |
| `/register` | Create a customer account |
| `/forgot-password` | Request a password reset |
| `/reset-password` | Set a new password using a reset token |
| `/portal` | Customer portal |
| `/finance` | Finance dashboard for staff/admin |
| `/subscriptions` | Subscription lifecycle management |
| `/products` | Product catalog |
| `/plans` | Plan management |
| `/quotes` and `/quotations` | Quotation templates |
| `/admin/users` | Staff management for admins |

The React role wrappers are for navigation and user experience. Backend endpoints must also enforce authorization before the system is exposed beyond a local demo.

## API routes available from the current default server

`backend/server.js` currently mounts these route modules on port 5000:

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/` | Backend status message |
| `GET` | `/api/invoices` | List invoices |
| `POST` | `/api/invoices/generate` | Generate an invoice |
| `GET` | `/api/invoices/:id` | Get an invoice |
| `PATCH` | `/api/invoices/:id/status` | Change invoice status |
| `GET`, `POST` | `/api/discounts` | List or add discounts |
| `GET`, `PUT`, `DELETE` | `/api/discounts/:id` | Read, edit, or remove a discount |
| `POST` | `/api/discounts/:id/apply` | Apply a discount |
| `GET`, `POST` | `/api/payments` | List or record payments |
| `GET` | `/api/payments/:id` | Get a payment |
| `GET` | `/api/payments/invoice/:invoiceId` | List payments for an invoice |

Product, plan, quote, subscription, auth, finance, and internal-catalog route modules also exist in `backend/src`, but they are **not mounted by the current `npm start` entry point**.

## Backend tests

From `backend/`:

```powershell
npm test
```

The Jest configuration currently runs the invoice-finance-math, subscription-state, and customer-invoice-access suites. Two older verification scripts are excluded from Jest and can be run directly:

```powershell
node tests/invoiceDiscountRules.test.js
node tests/subscriptionStateMachineAndQuoteTemplate.test.js
```

Build the frontend with:

```powershell
cd frontend
npm run build
```

## Data and persistence notes

The example contract includes `User`, `Product`, `Plan`, `Discount`, `Subscription`, `Invoice`, and `Payment`. Invoices use `due_date` and payments use `payment_date` for overdue and revenue-period calculations.

Persistence differs by module in the current repository: product/plan/auth models use Mongoose code, while invoice, discount, payment, and subscription workflows also use in-memory mock stores. The customer portal includes sample records. Do not assume all screens share a single persisted database state.

The seed utility can replace the product catalog with demo products. Use it only with a disposable development database; it does not seed invoices, payments, or subscriptions.

## License

MIT
