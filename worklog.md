# PharmaKin — Worklog

Project: PharmaKin (mobile-first pharmacy management app for Kinshasa/RDC).
Stack: Next.js 16, TypeScript, Tailwind 4, shadcn/ui, Prisma (SQLite), Leaflet/OpenStreetMap, jsPDF.

## Vendor accounts and administration

- Pharmacy signup now requires a unique email and a password of at least 10 characters. Passwords are stored as salted scrypt hashes.
- Added signed, HttpOnly, SameSite=Strict vendor sessions and a login screen that remains available from the home page.
- Added email password reset using six-digit, ten-minute codes with attempt limits. Configure `RESEND_API_KEY` and `PHARMAKIN_EMAIL_FROM` to enable email delivery.
- Added an explicit vendor notifications panel with unread count and dismiss-as-read behavior.
- Admin pharmacy controls now support suspend/reactivate, cancel subscription, grant a seven-day renewal, one-time temporary password reset, and permanent deletion after confirmation.
- Added Prisma migration `0002_vendor_auth` for pharmacy credentials/suspension and password-reset codes.
- New Vercel variables: `PHARMAKIN_VENDOR_SESSION_SECRET`, `PHARMAKIN_PASSWORD_RESET_SECRET`, `RESEND_API_KEY`, and `PHARMAKIN_EMAIL_FROM`. Keep secrets out of source control.

---
Task ID: 1
Agent: main
Task: Setup database schema and push

Work Log:
- Designed full Prisma schema for PharmaKin covering all MVP features.
- Models: Pharmacy, Seller, Product, Sale, SaleItem, StockMovement, Activity, ServiceSession.
- Invoice numbering uses HK-XXXXXX format (stored as sequential integer + display string).
- StockMovement tracks old/new quantity, type (SALE/ENTRY/EXIT), reason, seller.
- Activity log is per-seller, immutable history.
- ServiceSession tracks start/end timestamps per seller per day.

Stage Summary:
- Schema written to prisma/schema.prisma.
- Will run `bun run db:push` next.

---
Task ID: 12
Agent: main
Task: Build all API routes for PharmaKin

Work Log:
- POST /api/pharmacy (onboarding: pharmacy + 1 or 2 sellers, location optional)
- GET/PUT /api/pharmacy/[id]
- GET/POST /api/products (POST also records initial ENTRY movement + activity)
- PUT/DELETE /api/products/[id]
- POST /api/stock/entry (increments qty, records ENTRY movement + activity)
- POST /api/stock/exit (decrements qty, validates stock, records EXIT movement + activity)
- GET/POST /api/sales (POST = checkout: validates stock, increments invoiceSeq,
  creates HK-XXXXXX invoice, decrements stock per item, creates SALE movements + activity)
- GET /api/sales/[id] (single sale with items, seller, pharmacy)
- POST /api/sessions (starts a new service session, closes any open one)
- POST /api/sessions/[id]/end (ends service, returns session summary)
- GET /api/activities (per seller per pharmacy)
- GET /api/dashboard (today's sales/revenue/items, open session, low stock count)
- GET /api/report?sessionId=... (full service report data for PDF)
- GET /api/public/pharmacies (public, only pharmacies with lat/lng set)
- Updated /api route to identify as PharmaKin by HenoBuild Entreprise.

Stage Summary:
- All backend API endpoints ready for the frontend.
- Invoice numbering: HK-000001, HK-000002... sequential per pharmacy.
- Every stock operation is logged with old/new qty + seller + reason.
- Activities are per-seller, immutable-style log.

---
Task ID: 5-11
Agent: main
Task: Build the full PharmaKin frontend

Work Log:
- Built the entire seller + client experience as mobile-first React components.
- Created a single-route app (page.tsx) with a view state machine:
  home -> onboarding -> seller -> client.
- Foundation:
  * src/lib/format.ts (formatFC, todayStr, timeStr, formatInvoiceNumber,
    haversineMeters, formatDistance, etc.)
  * src/lib/store.ts (Zustand + persist: pharmacy, sellers, activeSellerId,
    cart, clientName, activeSessionId)
  * src/lib/pdf.ts (jsPDF invoice + service report builders, download + share)
  * src/lib/types.ts (DTO types matching API responses)
  * Brand.tsx + StickyFooter.tsx (HenoBuild branding)
- Seller flow:
  * SellerOnboarding.tsx — 4-step wizard (pharmacy -> seller name ->
    alone/two -> recap) with geolocation capture.
  * SellerApp.tsx — top-level seller container with sticky header
    (PharmaKin wordmark + pharmacy + seller badge + Quit) and a fixed
    bottom navigation (Accueil/Vendre/Stock/Activité/Rapports) with an
    inline HenoBuild line. Includes the SellerPicker when no active seller.
  * SellerDashboard.tsx — gradient greeting card, today's metrics,
    6 big action cards, low-stock warning, "Terminer mon service" button.
  * StockView.tsx — search, list with low-stock highlight, add product
    dialog, entry/exit dialogs with product picker + new-stock preview,
    edit/delete dialogs.
  * SalesView.tsx — product search, +/- quantity, cart sheet with
    optional client name, floating cart bar, checkout -> invoice.
  * InvoiceView.tsx — paper-style invoice preview (HK-XXXXXX),
    Download / Share (Web Share API w/ fallback) / Print actions.
  * ActivityView.tsx — per-seller chronological activity timeline
    with date grouping + colored icons per operation type.
  * ReportView.tsx — end-of-service summary (ventes/revenu/entrées/
    sorties/produits), detail tables for sales + stock movements,
    Download / Share PDF (A4) via buildServiceReportPdf.
- Client space:
  * ClientView.tsx — dynamic Leaflet + OpenStreetMap import (no SSR
    issues), geolocation request with permission-denied error path,
    pharmacy list sorted by haversine distance, nearest pharmacy
    highlighted with star + "la plus proche" badge, pharmacy detail
    sheet with Itinéraire (OSM directions) + Appeler (tel:) +
    Voir sur OpenStreetMap external link, "Moi" relocate button.
- Layout:
  * Root layout uses flex min-h-screen flex-col with mt-auto footer.
  * StickyFooter hidden in seller view (avoids overlap with the
    fixed bottom nav); HenoBuild branding lives in the seller nav.
  * Medical color palette (deep teal-green primary, no indigo/blue).
  * Mobile-first: 44px+ tap targets, touch-action manipulation,
    overscroll-behavior contain, custom thin scrollbars, sticky
    bottom sheets on mobile, responsive sm: breakpoints.

Stage Summary:
- All UI for seller + client flows implemented and wired to the API.
- Verified end-to-end with Agent Browser:
  * Home -> onboarding -> 2 sellers configured -> seller picker ->
    dashboard -> add products -> search -> cart -> checkout ->
    invoice HK-XXXXXX generated + PDF download -> activity log
    shows sale -> end service -> service report auto-shown with
    PDF download/share.
  * Client view: Leaflet map renders, geolocation captured, 3
    pharmacies sorted by distance, nearest highlighted, pharmacy
    sheet with route/call/OSM link all functional.
- Lint: 0 errors, 0 warnings. Dev server: no runtime errors.

---
Task ID: SUB-1
Agent: main
Task: Add GeniusPay subscription payment system (5000 CDF / 7 days)

Work Log:
- Read GeniusPay API docs (POST /payments + GET /payments/{reference})
- Added env vars to .env:
  * GENIUSPAY_API_KEY / GENIUSPAY_API_SECRET (sandbox keys)
  * GENIUSPAY_API_URL
  * PHARMAKIN_SUBSCRIPTION_PRICE=5000
  * PHARMAKIN_SUBSCRIPTION_DURATION_DAYS=7
  * PHARMAKIN_CURRENCY=CDF
  * PHARMAKIN_RECHARGE_CODE=PHARMAKIN-2024 (user-editable)
  * APP_BASE_URL
- Added Subscription model to Prisma schema (pharmacyId, status, amount,
  currency, durationDays, startDate, endDate, paymentMethod, paymentRef,
  checkoutUrl, customerPhone) + indexes; pushed to DB.
- src/lib/geniuspay.ts: server-side client (server-only import)
  * initiatePayment({ amount, description, customer, successUrl, errorUrl,
    metadata }) -> POST /payments with currency fallback (CDF first, then
    default XOF). Returns checkout_url for hosted GeniusPay page.
  * getPaymentStatus(reference) -> GET /payments/{reference}
  * appBaseUrl(requestOrigin) -> derives absolute base URL for redirect URLs
- API routes:
  * POST /api/subscription/initiate — creates pending Subscription, calls
    GeniusPay, returns checkoutUrl. Auto-redirect if already active.
  * POST /api/subscription/verify — looks up Subscription by reference,
    calls GeniusPay to confirm, activates 7-day window on 'completed'.
  * POST /api/subscription/recharge — compares submitted code against
    PHARMAKIN_RECHARGE_CODE env var; on match, creates active 7-day
    Subscription with paymentMethod=recharge_code.
  * GET /api/subscription/status — marks expired rows, returns active
    subscription + daysRemaining for the pharmacy.
  * POST /api/subscription/webhook — GeniusPay server-to-server callback
    (always returns 200 to avoid retries).
- PaywallView component (mobile-first, big green pay button):
  * Hero card with 5 000 CDF / CDF / "par semaine · 7 jours d'accès"
  * Features list (5 items with checkmarks)
  * "Payer 5 000 CDF — Mobile Money" -> initiates GeniusPay payment ->
    redirects to checkout_url
  * "J'ai un code de réabonnement" expandable -> /api/subscription/recharge
  * Auto-verifies on GeniusPay redirect (?payment=success&reference=MTX-...)
  * Success screen "Abonnement activé !" + auto-redirect to seller picker
  * Ref-guard prevents duplicate verify calls; stable onActivated callback
- page.tsx wiring:
  * New 'paywall' view; onboarding completion now goes to paywall (no access
    before payment).
  * Detects GeniusPay redirect on mount, sets pendingRedirect, cleans URL.
  * goToSeller / goHome clear pendingRedirect (avoids bounce-back loop).
- SellerApp subscription gate:
  * On mount, GET /api/subscription/status. If expired -> onSubscriptionExpired
    -> bounces to paywall. While loading, shows "Vérification de
    l'abonnement…" loader.
  * Header shows colored days-remaining badge: green (>3j), amber (<=3j),
    red (<=1j).
- Verified end-to-end with Agent Browser:
  * Onboarding -> paywall shown (no active sub)
  * Recharge code PHARMAKIN-2024 -> "Abonnement activé" -> seller picker
  * Payer 5 000 CDF -> redirect to geniuspay.ci/checkout/SANDBOX_... ->
    simulate "Paiement Réussi" -> Terminer -> back to PharmaKin ->
    "Paiement confirmé ! Abonnement activé pour 7 jours." -> auto-redirect
    to seller picker -> dashboard with "7j" badge in header
  * Expiring subscription (DB endDate in past) -> reload -> bounce to
    paywall automatically.
- Currency: UI always displays "5 000 CDF" (Franc Congolais, never XOF/FCFA)
  as the user requested. GeniusPay's hosted checkout page may show "XOF"
  because their API only supports XOF/EUR/USD, but our UI is consistently CDF.

Stage Summary:
- Historical implementation only; this GeniusPay/recharge-code flow was
  replaced by the manual M-Pesa review flow documented below.

---
Task ID: SUB-2
Task: Replace hosted payments with manual M-Pesa review

Current subscription workflow (replaces the older SUB-1 payment flow):
- M-Pesa transfers are submitted with a JPG/PNG/WebP receipt image.
- Receipt submissions are stored with `pending_review` status; sellers retain
  access while the administration reviews the payment.
- At initial signup only, a configured validation code can activate seven days
  immediately; renewal requires an M-Pesa receipt and administrator decision.
- The administrator reviews receipts from the hidden three-star entry point,
  approves or rejects with a reason, and sees approved subscription revenue
  by pharmacy and in total.
- The seller app refreshes review status periodically and displays pending or
  rejected-payment notices. A rejected, expired account is redirected after a
  five-second notice; approval activates the seven-day subscription.
- The admin dashboard shows unpaid, pending, active, and soon-to-expire access,
  can grant free weeks to one or more pharmacies, and can send in-app messages
  to all pharmacies or a selected group.
- GeniusPay endpoints and the former recharge-code endpoint have been removed.
- The signup validation code and local administrator credentials are configured
  in the ignored `.env`; keep that file private. `.env.example` lists variable
  names and placeholders only.
- Lint: 0 errors. Dev server: no runtime errors.

---
Task ID: SUB-2
Task: Replace hosted checkout with manual M-Pesa subscription payments

Current implementation:
- Registration opens the subscription page with the M-Pesa payment instructions.
- Sellers can open Paramètres > Abonnement to see remaining access and renew.
- Payments are sent manually to the configured M-Pesa recipient; the app does
  not claim to verify transfers automatically. Pharmacies upload a receipt for
  administrator review; a rejection reason is shown to the pharmacy.
- The configured code is limited to initial signup; renewals use only the
  M-Pesa receipt review workflow.
- Admin sign-in uses PHARMAKIN_ADMIN_PASSWORD and
  PHARMAKIN_ADMIN_SESSION_SECRET from the ignored local `.env`.
