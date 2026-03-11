-- AddUniqueConstraint
-- Safe: removes any duplicate medicine names before adding the constraint,
-- keeping the oldest record when duplicates exist.

DELETE FROM medicines
WHERE id IN (
  SELECT id FROM (
    SELECT id,
           ROW_NUMBER() OVER (PARTITION BY name ORDER BY created_at ASC) AS rn
    FROM medicines
  ) t
  WHERE rn > 1
);

-- AlterTable: add unique constraint on name
ALTER TABLE "medicines" ADD CONSTRAINT "medicines_name_key" UNIQUE ("name");
