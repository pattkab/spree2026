# SPREEBnB

A full-stack Airbnb-style **demo marketplace** for discovering, saving, booking, and hosting vacation rentals. Responsive React UI, Vinext server routes, Cloudflare D1 persistence, and ChatGPT sign-in.

## Included

- Destination, category, guest capacity, nightly budget, pool, date availability, and sort controls.
- Shareable property detail URLs with amenities, host details, price breakdown, and unavailable dates.
- Persistent wishlists tied to signed-in users.
- Demo checkout with server-calculated USD prices, cancellation, and trip history.
- Atomic booking locks: one database row per property/night, a composite unique key, and a transactional D1 batch prevent overlapping reservations.
- Host dashboard with listing creation, editing, publishing/pausing, and guest reservations.
- Reviews restricted to completed, uncancelled reservations; one review per booking.
- Server-side authentication and ownership checks, request validation, and same-origin writes.
- Accessible Radix dialogs, menus, tabs and form controls; responsive mobile and desktop layouts.
- A feature-detected WebMCP destination-search tool.

## Run locally

Requires Node 22.13+ (Node 24 recommended).

```sh
npm ci
npm run build
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_amazing_triathlon.sql
npm run dev
```

Apply the initial migration only once per local database. The development URL is printed in the terminal, normally http://localhost:5173. On Windows, a project path containing `&` can break npm lifecycle scripts. This checkout was installed with `npm install --ignore-scripts --prefer-offline --no-audit --no-fund`; the required platform binaries were supplied by optional dependency packages. If starting through npm has path issues, run `node scripts/run-framework.mjs dev` directly.

Local sign-in simulates a test user (`seedy@sites.test`) on loopback only. Hosted sign-in is handled by Sites; the development authentication mechanism is excluded from production. Hosted data and local preview data are separate. Do not expose the local mock-auth development server publicly.

The dev server and built preview use `.wrangler/state`. After a production build, restart the development server if Vinext's cached server renderer reports an error.

## Validation

```sh
node node_modules/typescript/bin/tsc --noEmit
node --test tests/booking.test.mjs
node tests/integration.mjs
npm run build
```

Integration tests require the local dev server and migrated database. They test authentication, CSRF rejection, wishlists, date validation, guest limits, server pricing, simultaneous booking conflicts and rollback, cancellation, review eligibility, and host ownership/create/edit/pause. They create a cancelled test reservation and a paused QA listing in the local test account. They refuse non-loopback targets.

## Project structure

- `app/explore.tsx`: catalog, navigation, filtering, account, sign-in, and wishlists.
- `app/ui/`: property details, checkout, trips, host dashboard, and shared UI.
- `app/api/market/route.ts`: authenticated marketplace API.
- `lib/booking.ts`: date validation and integer-cent price calculation.
- `db/schema.ts`, `drizzle/`: schema and generated migrations.
- `app/data.ts`: illustrative seeded listings.
- `.openai/hosting.json`: private Sites identity and logical D1 binding.

## Demo scope and production work

This is a working end-to-end demo, not a live travel agency or a complete reproduction of Airbnb. Checkout records reservations but never collects money, books real lodging, or sends emails. Seeded hosts, locations, ratings, and listing details are illustrative. Images come from Unsplash; source links are in `ASSETS.md`. Host photos are HTTPS image URLs; binary uploads are not implemented.

Before accepting real guests, integrate a payment provider and verified webhooks, refunds and payouts, real inventory and identity verification, email delivery, location/maps, image storage, rate limiting/abuse controls, and jurisdiction-appropriate terms and taxes. No card details or payment credentials are stored. All prices are USD; a stay is 1–90 nights, booked up to two years ahead; cancellation is permitted before the UTC check-in date. The sample price model is nightly rate plus a $25 cleaning fee and 12% service fee.

Sites owns deployment access control and runtime database provisioning. The first deployment is private to the owner. Database migrations are schema-only, and illustrative catalog data is inserted idempotently by the application. Do not rewrite an applied migration; generate a new one for schema changes.
