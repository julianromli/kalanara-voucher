-- ============================================================================
-- Migration 031: Fix ambiguous column reference in generate_voucher_code()
-- ============================================================================

-- Problem: the previously deployed function declared a plpgsql variable
-- named "code", which collides with the vouchers.code column inside the
-- uniqueness check (WHERE code = code). Postgres raises error 42702:
-- column reference "code" is ambiguous.
--
-- Fix: prefix local variables with "v_" and fully qualify the column
-- reference in the uniqueness loop. Behavior is otherwise unchanged:
-- KSP-YYYY-XXXXXXXX codes (8-char uppercase md5 suffix) that satisfy
-- chk_voucher_code_format, retried until unique.

CREATE OR REPLACE FUNCTION public.generate_voucher_code()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $$
DECLARE
    v_year_part TEXT;
    v_random_part TEXT;
    v_code TEXT;
BEGIN
    v_year_part := to_char(now(), 'YYYY');
    v_random_part := upper(substring(md5(random()::text) from 1 for 8));
    v_code := 'KSP-' || v_year_part || '-' || v_random_part;

    -- Ensure uniqueness (column reference is fully qualified to avoid
    -- plpgsql variable/column ambiguity)
    WHILE EXISTS (
        SELECT 1 FROM public.vouchers WHERE public.vouchers.code = v_code
    ) LOOP
        v_random_part := upper(substring(md5(random()::text) from 1 for 8));
        v_code := 'KSP-' || v_year_part || '-' || v_random_part;
    END LOOP;

    RETURN v_code;
END;
$$;