DROP POLICY IF EXISTS "vouchers_select" ON public.vouchers;

CREATE POLICY "vouchers_select" ON public.vouchers
  FOR SELECT
  TO authenticated
  USING ((SELECT public.is_admin()));
