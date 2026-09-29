# Studio Market 41 — Booking System PRD

## Original Problem Statement
A website flow & booking system for renting pop-up retail vendor stalls (A, B, C, D). Customers book one stall or two adjoining stalls (A+B or C+D), pick a rental type (hourly $10/hr with 4-hour min, daily, weekly Mon-Fri, weekly Mon-Sun), pick a date + available time on a live-availability calendar (Mon-Fri 7AM-9PM, Sat-Sun 7AM-10PM, no double bookings), fill a vendor/business info form, review a booking summary, accept required agreements + cancellation policy + terms, pay online (Stripe), receive a confirmation page + email. Admin dashboard to edit rates, hours, block dates/slots, mark stalls unavailable, view/cancel reservations, and edit terms.

## Architecture
- Frontend: React (react-router, framer-motion, shadcn/ui, sonner). Pages: Home, Booking wizard, Confirmation, PaymentSuccess/Cancel, UserLogin/Register, ForgotPassword, ResetPassword, MyBookings, AdminLogin/Register, AdminDashboard.
- Backend: FastAPI + MongoDB (motor). All routes /api prefixed.
- Auth: JWT bearer (localStorage `sm41_token`). Two roles: user + admin, with separate login/register endpoints & URLs. Password reset via emailed single-use token (1h TTL).
- Payments: Stripe TEST mode via emergentintegrations Flow B (shared key; claimable sandbox unavailable for account country IN). Webhook /api/webhook/stripe.
- Email: Emergent-managed Resend — booking confirmations (customer + owner) + password reset links.

## User Personas
- Vendor/Customer (role user): books stalls, pays, manages/reschedules bookings, resets password. Business profile auto-saved for faster rebooking.
- Owner/Admin (imcreatorstudio13@gmail.com): manages rates, hours, blockouts, stalls, reservations, terms; can reset password.

## Core Requirements (static)
- 4 stalls as independent resources; combos only A+B / C+D; max 2 stalls/day.
- Hourly ≥ 4 consecutive hours; live availability; no double bookings.
- Operating hours weekday/weekend, admin-editable.
- Required agreements + cancellation + terms accepted before payment.
- Secure online payment + confirmation page + confirmation email.

## Implemented
- 2026-09-29: Full booking wizard, live availability, Stripe checkout, confirmation + emails, admin dashboard (rates/hours/blockouts/stalls/reservations/terms). Backend 19/19 tests.
- 2026-09-29: Split user/admin auth (separate URLs; admin register gated by ADMIN_REGISTER_CODE). Guest booking stays open; logged-in users get My Bookings. 38/38 tests.
- 2026-09-29: (1) Password reset via emailed link (users + admins); (2) Reschedule upcoming booking from My Bookings (duration-locked for hourly, conflict-checked); (3) Admin logout/account controls in public header; (4) Vendor profile auto-save + booking prefill. 13 new + 38 regression tests all green.

## Backlog / Remaining
- P1: SMS confirmation (Twilio) — deferred (needs user credentials).
- P1: Claim/connect a real Stripe account to accept live payments (currently test mode).
- P2: Refund automation tied to 48h cancellation tiers; reschedule that changes price/duration with payment adjustment.
- P2: Downloadable PDF receipt; per-business max-2-stalls/day across separate bookings.
- P2 (polish): split server.py into routers; allow admins to view /my-bookings.

## Key Config / Credentials (see /app/memory/test_credentials.md)
- Admin: imcreatorstudio13@gmail.com / Studio41Admin! (/admin/login)
- Admin registration code: ADMIN_REGISTER_CODE=STUDIO41-OWNER (backend/.env)
- Sample user: jane_vendor@example.com / vendor123 (/login)
