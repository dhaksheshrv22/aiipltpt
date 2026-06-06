# Implementation Plan — Advanced Parking Features

Building 8 features across 4 phases. **Skipped per your choice:** Feature 3 (Add Payment / ledger button stays removed — auto-payments only) and Feature 5 (SMS/WhatsApp).

---

## Phase 1 — Foundations (1–2 sessions)

### F1. Quick Re-entry from Vehicle History (already partly built)
**Status today:** Autocomplete + "Repeat Last" already work on the Entry page using `vehicle_history`. Visit count and last-visit subtitle already render.

**Gaps to close:**
- Min 3-char trigger (currently 2) — trivial change.
- Add aggregate columns (`visit_count`, `avg_stay_hours`, `last_entry_at`) to `vehicle_history` and populate via a DB trigger on `INSERT` so we don't compute client-side.
- Cache the last 500 history rows in IndexedDB for offline use (wires into F2).

### F4. UPI Dynamic QR Code on Receipt (already partly built)
**Status today:** `UpiQR.tsx`, `useUpiSettings` hook and Settings field already exist. ReceiptModal renders it.

**Gaps to close:**
- Confirm QR appears in: payment moments (TempExit + Exit modals), receipt, and active vehicle print. Add wherever missing.
- "Copy UPI Link" + "Share on WhatsApp" buttons next to the QR.
- Regenerate when amount changes (already reactive — verify).

---

## Phase 2 — Cash Control & Shift Accountability (2–3 sessions)

### F6. Daily Cash Reconciliation
- New table `cash_reconciliations` (date, shift_id, operator_id, expected_cash, counted_cash, variance, notes, locked_at).
- New page/modal `CashReconciliation`:
  - Auto-sums cash payments from `payments` table for the day/shift.
  - Operator enters counted cash → variance auto-calculated (red/green).
  - Submit locks the row.
- Settings: variance threshold (₹).
- Reports page gets a "Reconciliations" tab (filter by date/operator).
- Blocks shift handover PDF (F7) until submitted.

### F7. Operator Shift Report & Handover
- New table `shifts` (operator_id, start_at, end_at, status).
- "Start Shift" / "End Shift" buttons in app header / dashboard.
- On End Shift: aggregate entries, exits, payments-by-mode, temp exits, overstay alerts during the shift window → generate a PDF (jsPDF, already used in Reports).
- PDF includes: reconciliation result, pending vehicles, outstanding dues, signature line.
- Admin "Shift History" page with filters.

### F8 (main). Outstanding Dues Report
- New Reports tab "Outstanding Dues":
  - **Unpaid/Partial:** active sessions where `bill > paid`. Sortable, grand total at top, "Open Ledger" button (read-only — no Add Payment).
  - **Expiring Passes:** monthly_passes expiring in next 7 days; expired flagged red.
- PDF + Excel export.
- Credit-limit badge on dashboard (already partly done — verify).
- Daily 9 AM admin email skipped (no notifications phase). We'll just show an in-app banner with daily totals.

---

## Phase 3 — Offline Mode (3–4 sessions, largest piece)

### F2. Offline + IndexedDB queue + auto-sync
**Architecture:**
- Add `vite-plugin-pwa` with `generateSW` (per the PWA skill).
- Guarded SW registration wrapper (no register in Lovable preview/iframe/dev).
- IndexedDB via `idb` package — three stores:
  1. `mutation_queue` — pending writes (entry, exit, temp-exit, payment).
  2. `vehicle_history_cache` — for offline autosuggest (F1).
  3. `active_vehicles_cache` — read-only snapshot for offline browsing.
- Wrap all Supabase mutations through an `offlineWrite()` helper:
  - Online → write to Supabase, mirror into cache.
  - Offline → push to queue with a temp UUID (`local-…`), update cache optimistically.
- Background sync on `online` event: replay queue chronologically, swap temp IDs for server IDs, mark failures for retry.
- UI:
  - Persistent amber banner when offline.
  - Green/red dot in header.
  - "Syncing X pending…" + "All synced ✅" toast.
  - Duplicate-conflict modal when same vehicle exists online + offline.

**Risk:** This is the largest feature and touches every write path. We'll do it last so other features are stable first.

---

## Phase 4 — Photo / OCR / Refunds (1–2 sessions each)

### F8.1 Entry/Exit Photo Capture
- Create a Lovable Cloud storage bucket `vehicle-photos` (private).
- "Capture Photo" button on entry + exit modals using `getUserMedia` (works on mobile).
- Store `entry_photo_url` / `exit_photo_url` on `active_vehicles` / `vehicle_history`.
- View photo in vehicle detail.

### F8.2 ANPR (Number Plate OCR)
- Edge function `anpr-extract` → calls Lovable AI Gateway with `google/gemini-2.5-flash` (vision).
- Operator captures photo → function returns extracted plate → pre-fills Vehicle Number for confirmation.

### Refunds & Adjustments
- New payment type `'Refund'` (negative amount) in `payments`.
- "Issue Refund" action on completed sessions (admin only) with required reason; logged with operator id + timestamp.
- Ledger view shows refunds clearly.
- Cash reconciliation (F6) subtracts refunds from expected cash.

---

## Database Changes Summary

```text
NEW TABLES
  cash_reconciliations
  shifts
  notification_logs            (stub — for future SMS phase)

ALTERED TABLES
  vehicle_history    + visit_count, avg_stay_hours, last_entry_at
  active_vehicles    + entry_photo_url, exit_photo_url, shift_id
  vehicle_history    + entry_photo_url, exit_photo_url, shift_id
  payments           + operator_id, notes, shift_id  (allow negative amount for refunds)
  app_settings       + cash_variance_threshold

NEW EXTENSIONS  (Phase 4)
  storage bucket: vehicle-photos (private, RLS)
```

Every new table gets `GRANT`s + RLS scoped to `authenticated`, with admin-only writes where appropriate.

---

## Effort & Order of Work

| Phase | Features | Sessions | Risk |
|---|---|---|---|
| 1 | F1 polish, F4 polish | 1 | Low |
| 2 | F6, F7, F8 main | 2–3 | Medium |
| 3 | F2 offline | 3–4 | **High** — touches every write |
| 4 | F8.1 photo, F8.2 ANPR, Refunds | 2–3 | Medium |

**Deferred:** F3 (Add Payment), F5 (SMS/WhatsApp), F8 daily email summary.

Approve this and I'll start Phase 1.