-- Remove rows created while verifying the restricted delivery RPCs.
DELETE FROM public.voucher_delivery_outbox
WHERE last_error = 'cursor_migration_verification_20260915';
