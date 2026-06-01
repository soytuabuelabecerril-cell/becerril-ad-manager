-- Migration Script to support multiple ads per page

-- 1. Create the new ad_reservations table
CREATE TABLE public.ad_reservations (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  page_number bigint NOT NULL REFERENCES public.magazine_pages(page_number) ON DELETE CASCADE,
  customer_id text NOT NULL,
  ad_type text NOT NULL,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Migrate existing data from magazine_pages
-- This assumes magazine_pages currently has customer_id and ad_type columns
INSERT INTO public.ad_reservations (page_number, customer_id, ad_type)
SELECT page_number, customer_id, ad_type
FROM public.magazine_pages
WHERE ad_type IS NOT NULL AND customer_id IS NOT NULL;

-- 3. (Optional) Remove the old columns from magazine_pages
-- Uncomment these if you want to clean up the old schema
-- ALTER TABLE public.magazine_pages DROP COLUMN customer_id;
-- ALTER TABLE public.magazine_pages DROP COLUMN ad_type;

-- 4. Set up Row Level Security (RLS) for the new table
ALTER TABLE public.ad_reservations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable read access for all users"
ON public.ad_reservations
AS PERMISSIVE FOR SELECT
TO public
USING (true);

CREATE POLICY "Enable insert access for all users"
ON public.ad_reservations
AS PERMISSIVE FOR INSERT
TO public
WITH CHECK (true);

CREATE POLICY "Enable update access for all users"
ON public.ad_reservations
AS PERMISSIVE FOR UPDATE
TO public
USING (true)
WITH CHECK (true);
