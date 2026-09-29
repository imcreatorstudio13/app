# Studio Market 41 — Booking System PRD

## Original Problem Statement
A website flow & booking system for renting pop-up retail vendor stalls (A, B, C, D). Customers book one stall or two adjoining stalls (A+B or C+D), pick a rental type (hourly $10/hr with 4-hour min, daily, weekly Mon-Fri, weekly Mon-Sun), pick a date + available time on a live-availability calendar (Mon-Fri 7AM-9PM, Sat-Sun 7AM-10PM, no double bookings), fill a vendor/business info form, review a booking summary, accept required agreements + cancellation policy + terms, pay online (Stripe), and receive a confirmation page + email. Admin dashboard to edit rates, hours, block dates/slots, mark stalls unavailable, view/cancel reservations, and edit terms — without a developer.

## Architecture
- Frontend: React (react-router, framer-motion, shadcn/ui, sonner). Pages: Home, Booking (5-step wizard), Confirmation, PaymentSuccess, PaymentCancel, AdminLogin, AdminDashboard.
- Backend: FastAPI + MongoDB (motor). All routes /api prefixed.
- Auth: JWT bearer (admin only), token in localStorage. Admin seeded on startup.
- Payments: Stripe test mode via emergentintegrations Flow B (shared key `sk_test_emergent`; claimable sandbox unavailable for account country IN). Webhook at /api/webhook/stripe.
- Email: Emergent-managed Resend. Customer + owner emails sent on payment finalize.

## User Personas
- Vendor/Customer: books stalls, pays, receives confirmation.
- Owner/Admin (imcreatorstudio13@gmail.com): manages rates, hours, blockouts, stalls, reservations, terms.

## Core Requirements (static)
- 4 stalls as independent resources; combos only A+B / C+D; max 2 stalls/day.
- Hourly ≥ 4 consecutive hours; live availability; no double bookings.
- Operating hours weekday/weekend, admin-editable.
- Required agreements + cancellation + terms must all be accepted before payment.
- Secure online payment + confirmation page + confirmation email (customer & owner).

## Implemented (2026-09-29)
- Homepage: hero, about, includes, stalls & pricing, FAQ, footer.
- Booking wizard: stall/combo selection, rental type, date & live hourly slot grid (booked/blocked slots disabled), vendor form (logo upload, electrical, furniture), review summary, agreements/terms, Stripe checkout redirect.
- Backend: /settings, /quote, /availability, /bookings, /payments/checkout|status|webhook, admin CRUD (settings, block-date, block-slot, stall-unavailable, reservations, cancel), JWT auth.
- Double-booking prevention verified (409 on overlap; non-overlap + other stall succeed).
- Admin dashboard: Rates & Hours, Blockouts, Stalls, Reservations, Terms tabs.
- Confirmation page with QR + print receipt.
- Tested: backend 19/19 pytest green; frontend hourly + daily wizard reach Stripe; admin flows work.

## Backlog / Remaining
- P1: SMS confirmation (Twilio) — deferred (skipped per default).
- P1: Claim a real Stripe account to take live payments (test mode only now).
- P2: Email preview modal / downloadable PDF receipt.
- P2: Rescheduling flow; refund automation tied to cancellation policy tiers.
- P2: Per-business max-2-stalls-per-day enforcement across separate bookings.
