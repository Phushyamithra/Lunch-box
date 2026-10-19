-- Nutrition, stage 4: barcodes for packaged foods (your product library).
--  * foods.barcode: digits only (UPC-A stored as EAN-13 with a leading 0).
--  * One live product per barcode per person; archived ones don't count.
-- Additive only.

alter table public.foods
  add column if not exists barcode text check (barcode is null or barcode ~ '^[0-9]{8,14}$');

create unique index if not exists foods_user_barcode on public.foods (user_id, barcode)
  where barcode is not null and user_id is not null and archived_at is null;
