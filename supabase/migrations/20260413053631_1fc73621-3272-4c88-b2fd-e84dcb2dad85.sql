ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS receipt_company_name text DEFAULT 'AIIPL TRUCK PARKING TERMINAL',
  ADD COLUMN IF NOT EXISTS receipt_header_text text DEFAULT 'PARKING TOKEN',
  ADD COLUMN IF NOT EXISTS receipt_footer_text text DEFAULT 'Thank you for using our facility!',
  ADD COLUMN IF NOT EXISTS receipt_contact_info text DEFAULT '',
  ADD COLUMN IF NOT EXISTS receipt_prefix text DEFAULT 'AIIPL';