# User Manual — AIIPL Truck Parking Terminal

A full step-by-step operator manual covering every screen from vehicle entry to exit, delivered as both a downloadable PDF and an in-app Help page. Bilingual: English first, Hindi (Devanagari) immediately below each step.

## Deliverables

1. **Printable PDF** — `/mnt/documents/AIIPL_Operator_Manual.pdf`, generated with ReportLab (Noto Sans Devanagari font for Hindi). A4, ~12–16 pages, table of contents, page numbers, section headers.
2. **In-app Help page** — new `/help` route, linked in the sidebar (`AppLayout.tsx`) with a `BookOpen` icon. Same content as the PDF, rendered as styled sections with a "Download PDF" button (links to the PDF stored in Supabase Storage `manuals` bucket, public read).

## Manual contents (every screen, in order)

1. **Getting started / शुरुआत** — login, dashboard overview, sidebar map
2. **Vehicle Entry / गाड़ी एंट्री** — typing vehicle number, quick re-entry dropdown (auto-fills mobile + wheels), pricing category, advance payment toggle, generate & print entry token (Browser / Bluetooth)
3. **Active Vehicles / सक्रिय गाड़ियाँ** — search, filters (All / Temp Out / Overstay / Advance / Due), card colour legend, live bill estimate, outstanding balance, OVER LIMIT flag
4. **Add Payment & Ledger / भुगतान और बही** — partial payments, UPI QR, cash/UPI/card mode, viewing full ledger per vehicle
5. **Edit entry / एडिट** — correcting wrong data
6. **Delete entry / डिलीट** — when to use (wrong data only — NOT a check-out), warning
7. **Temporary Exit & Return / अस्थायी निकास और वापसी** — rest-hours window, overstay alert
8. **Barcode Scan / बारकोड स्कैन** — scanning to auto-open exit
9. **Final Exit / अंतिम निकास** — balance collection (always saved as Paid), print final receipt, edit-then-print
10. **Vehicle History / गाड़ी इतिहास** — filters, status meaning (always Paid after exit)
11. **Monthly Passes / मासिक पास** — create, print, expiry
12. **Vehicle Stock / स्टॉक** — current count by wheels
13. **Reports / रिपोर्ट** — daily, date-range, revenue, CSV/print
14. **Settings / सेटिंग्स** — receipt header/footer, prefix, UPI ID, credit limit, rest hours
15. **Troubleshooting / समस्या समाधान** — printer not detected, vehicle not in dropdown, status showing wrong, etc.
16. **Daily checklist / दैनिक चेकलिस्ट** — open shift → entries → payments → exits → end-of-day report

## Technical implementation

**PDF generation** (one-off `code--exec` script, output to `/mnt/documents/`):
- ReportLab Platypus with `SimpleDocTemplate`, `Paragraph`, `Table`, `PageBreak`
- Register `NotoSansDevanagari-Regular.ttf` + `NotoSans-Regular.ttf` (downloaded via curl from Google Fonts) for Hindi rendering — Helvetica cannot render Devanagari
- Custom styles: `H1` (brand navy), `H2`, `BodyEN`, `BodyHI` (Devanagari font, slightly muted)
- Auto-generated TOC, footer with page numbers + "AIIPL Truck Parking Terminal — Operator Manual v1"
- Visual QA: convert to JPG with `pdftoppm -r 150`, inspect every page for clipped Devanagari, overflow, alignment

**Storage upload**:
- Create `manuals` storage bucket (public read) via migration
- Upload generated PDF to `manuals/AIIPL_Operator_Manual.pdf` via `supabase--storage_upload`
- In-app Help page links to the public URL for download

**In-app Help page** (`src/pages/Help.tsx`):
- Same bilingual content, sectioned with anchored sub-headings and a sticky in-page nav
- Each step rendered as a card: English line on top, Hindi line below in muted foreground
- "Download printable PDF" button at top (opens public storage URL in new tab)
- "Print this page" button using `window.print()` with print-specific CSS
- Add route in `App.tsx`, add nav entry in `AppLayout.tsx` sidebar

**No business logic touched** — purely additive: 1 new page, 1 sidebar link, 1 route, 1 storage bucket migration, 1 uploaded PDF.

## Files to add / edit

- new: `supabase/migrations/<ts>_create_manuals_bucket.sql` — public `manuals` bucket + read policy
- one-off script (not committed): generate + upload the PDF
- new: `src/pages/Help.tsx`
- edit: `src/App.tsx` — add `/help` route
- edit: `src/components/AppLayout.tsx` — add "Help / सहायता" sidebar link
- artifact: `/mnt/documents/AIIPL_Operator_Manual.pdf` (also previewable via `<presentation-artifact>`)
