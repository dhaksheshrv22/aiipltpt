
WITH numbered AS (
  SELECT id,
         EXTRACT(YEAR FROM created_at)::int AS yr,
         ROW_NUMBER() OVER (PARTITION BY EXTRACT(YEAR FROM created_at) ORDER BY created_at, id) AS seq
  FROM public.monthly_passes
)
UPDATE public.monthly_passes mp
SET pass_id = 'AIIPL-' || n.yr || '-MP-' || lpad(n.seq::text, 4, '0')
FROM numbered n
WHERE mp.id = n.id;
