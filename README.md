# BookLeaf Author Support Portal

A full-stack author support and operations portal built with React (JavaScript), Vite, Node.js/Express (JavaScript), MongoDB Atlas, and Mongoose. It includes role-protected author/admin experiences, ticket workflows, policy-aware AI triage and response drafts, and local demo accounts.

## Stack choices

- **React + Vite (JavaScript):** lightweight client application with fast development feedback; no TypeScript.
- **Node.js + Express (JavaScript):** independent REST API, separated from the frontend so either can be deployed independently.
- **MongoDB Atlas + Mongoose:** hosted document database; ticket messages and private notes are embedded with their ticket, while users and books are separate collections.
- **Cookie sessions:** signed JWT in an HTTP-only, SameSite=Lax cookie; password hashes use bcrypt. The browser never receives an AI key.
- **AI:** Google Gemini `generateContent` using `gemini-2.0-flash` by default, chosen for low-latency, cost-conscious classification and drafting. The key is sent only in a server-side request header. Only the individual ticket subject and initial description are sent with compact policy context. If the key is absent or the API errors/rate-limits, deterministic rules provide triage and a usable draft; authors can still submit tickets and admins can edit/send a manual response.

## Requirements and setup

- Node.js 20 or newer and npm.
- MongoDB Atlas database, a database user, and a cluster network access rule that permits your development machine. Put the Atlas connection string in `.env`; do not commit it.

1. In PowerShell, create your local environment file with `Copy-Item .env.example .env`.
2. Set `MONGODB_URI` to your Atlas connection string, including the database name. Set a unique random `SESSION_SECRET` of at least 32 characters. Keep `GEMINI_API_KEY` blank for fallback mode, or set it to enable live AI triage and drafts. Set `GEMINI_MODEL` to your desired Gemini model; it defaults to `gemini-2.0-flash`.
3. Install the root, server, and client packages with `npm install`, `npm --prefix server install`, and `npm --prefix client install`.
4. Seed the supplied author/book records, demo accounts, and sample ticket with `npm run seed`.
5. Start the React development server and API together with `npm run dev`.
6. Open `http://localhost:5173`. Vite proxies `/api` requests to Express at `http://localhost:4000`.

PowerShell setup, with the Atlas connection string and strong secret edited into `.env` before seeding:

```powershell
Copy-Item .env.example .env
npm install
npm --prefix server install
npm --prefix client install
npm run seed
npm run dev
```

Stop the development servers with **Ctrl+C** in that terminal. To run the AI/data unit checks and the frontend production build, use `npm test` and `npm run build` in separate terminal commands.

The seed command imports all **10 authors and 18 books** from `data/sample-authors.json`, including each production-stage book, zero-royalty case, print partner, marketplace, and payout date. It is safe to rerun and updates sample records by their supplied `author_id`/`book_id`. Sample author accounts are seeded with the shared evaluation password **Bookleaf2026!**; for example:

- Sample author: `priya.sharma@email.com`

Demo credentials for both roles are **Bookleaf2026!**:

- Author: `author@bookleaf.demo`
- Admin: `admin@bookleaf.demo`

Only use these shared-password accounts with a non-production evaluation database. The sample data contains author contact details provided for this assignment.

## Environment variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `MONGODB_URI` | Yes | MongoDB Atlas connection string |
| `SESSION_SECRET` | Yes | Secret for signing session tokens; minimum 32 characters |
| `PORT` | No | API port; defaults to `4000` |
| `CLIENT_ORIGIN` | No | CORS origin; defaults to `http://localhost:5173` |
| `VITE_API_URL` | No | API origin for independently hosted client; blank uses Vite's local `/api` proxy |
| `GEMINI_API_KEY` | No | Server-side Gemini key; omit to use deterministic fallback triage/drafts |
| `GEMINI_MODEL` | No | Gemini model name; defaults to `gemini-2.0-flash` |

## REST API

All JSON errors use `{ "error": { "message": "..." } }`. Except login, logout, and health, routes require the HTTP-only session cookie. Author routes scope records to the authenticated author's ID; admin-only mutations enforce the admin role.

| Method | Route | Access | Purpose |
| --- | --- | --- | --- |
| `GET` | `/api/health` | Public | API health status |
| `POST` | `/api/auth/login` | Public, rate limited | Verify email/password and set session cookie |
| `POST` | `/api/auth/logout` | Public | Clear session cookie |
| `GET` | `/api/auth/me` | Signed-in user | Current user and role |
| `GET` | `/api/books` | Signed-in user | Author's books (admins can see all); includes pending royalties |
| `GET` | `/api/tickets?status=&category=&priority=` | Signed-in user | Author's own tickets, or admin queue with filters |
| `POST` | `/api/tickets` | Author | Create ticket with automated classification and priority |
| `GET` | `/api/tickets/:ticketId` | Signed-in user | View ticket, messages, and (admins only) internal notes |
| `PATCH` | `/api/tickets/:ticketId` | Admin | Set status/category/priority or assign to self |
| `POST` | `/api/tickets/:ticketId/reply` | Admin | Send a public author response; moves ticket to In Progress |
| `POST` | `/api/tickets/:ticketId/notes` | Admin | Add a private internal note |
| `POST` | `/api/tickets/:ticketId/draft` | Admin | Generate a policy-aware classification/priority/draft; falls back without AI |

Ticket list access is role-scoped. Admins can filter by status, category and priority; oldest tickets and highest priorities are brought to the top. The browser refreshes ticket data every 12 seconds for near-real-time updates. Attachment selection is a UI preview only; persistent file upload is not included.

## Evaluation / manual acceptance checklist

After connecting Atlas and seeding, verify both sample and demo accounts:

1. Sign in as `priya.sharma@email.com`; confirm only Priya's two books and royalties appear. Check the pending balance, per-copy royalty, print partner, marketplaces, and last payout details.
2. Sign in as `sneha.kulkarni@email.com`; confirm the production-stage “Midnight in Mysore” book has no publication date or MRP, and displays zero sales/royalties without a fake date.
3. Sign in as `kavita.deshmukh@email.com`; check the zero-royalty “Raising Roots” production book and the below-threshold ₹850 “The Nagpur Notebooks” royalty balance.
4. As an author, submit a ticket for a book and another for “General / Account level.” Confirm the new tickets appear in My tickets. Open the same account in another browser/session and check the 12-second refresh for a newly sent admin response.
5. As `admin@bookleaf.demo`, verify queue filters, urgent/old ordering, classification and priority overrides, self-assignment, status updates, private internal notes, and editable draft replies. Confirm authors never receive internal notes in the API response.
6. Disable/omit `GEMINI_API_KEY`; create sample royalty, ISBN, printing, and availability questions and confirm tickets still save with fallback triage/drafts. Then configure the key and confirm live AI output remains editable before sending.
7. Try invalid login, invalid ticket fields, author access to another author's ticket ID, and author access to admin mutations; expect clear 4xx responses and no cross-author data.

This is an evaluation-ready implementation, not a production launch sign-off: connect and test the actual Atlas cluster, verify production credentials/cookie/CORS settings, and run the manual acceptance checks before deployment. No integration test suite or actual attachment storage is included yet.

## BookLeaf support policy used by AI

The drafting prompt includes the supplied BookLeaf knowledge base: 80/20 author-to-BookLeaf net-profit royalties; quarterly calculations and payment within 45 days of quarter end; ₹1,000 minimum payout; ISBN imprint rules and high-priority ISBN errors; 5–7 business-day standard printing and verified free reprints; 7–10 business-day listing publication and 24–48-hour availability sync; production stages and empathetic, specific communication. The prompt explicitly forbids invented account details, payout dates, and unsupported promises.

## Build and run

- `npm run dev` — run Vite and Express concurrently.
- `npm run build` — create the production React bundle at `client/dist`.
- `npm start` — start the Express API.
- `npm run seed` — seed demo records in Atlas.

For production, configure the Atlas URI, a strong secret, `CLIENT_ORIGIN`, and AI key in the hosting environment. Build the client and deploy it with the API, or host the client separately and configure the API's CORS origin. Use HTTPS in production so the session cookie is Secure. Do not use the demo credentials outside local evaluation.
