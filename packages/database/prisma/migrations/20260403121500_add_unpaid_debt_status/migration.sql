-- Add explicit UNPAID status and use it as the default for new debts.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'DebtStatus' AND e.enumlabel = 'UNPAID'
  ) THEN
    ALTER TYPE "DebtStatus" ADD VALUE 'UNPAID' AFTER 'IMPORTED';
  END IF;
END $$;
