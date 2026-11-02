-- EMS • Separate payer login for advances portal
-- Run once in Supabase SQL Editor.

BEGIN;

CREATE TABLE IF NOT EXISTS public.payment_users (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  payer_code text NOT NULL UNIQUE CHECK (payer_code IN ('nur','gnaim','fadi')),
  display_name text NOT NULL,
  pin_hash text NOT NULL,
  salt text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Optional real-world audit date. Existing monthly accounting still uses payment_date.
ALTER TABLE public.employee_payments
  ADD COLUMN IF NOT EXISTS given_date date;

CREATE INDEX IF NOT EXISTS idx_employee_payments_employee_date
  ON public.employee_payments(employee_id, payment_date);

CREATE INDEX IF NOT EXISTS idx_employee_payments_date
  ON public.employee_payments(payment_date);

CREATE INDEX IF NOT EXISTS idx_shift_employees_employee_shift
  ON public.shift_employees(employee_id, shift_id);

CREATE INDEX IF NOT EXISTS idx_shifts_event_date
  ON public.shifts(event_date);

COMMIT;

-- Do NOT insert plain PINs here.
-- Create/update the three users through the seed endpoint supplied with this package.
