DROP POLICY IF EXISTS brands_select_member ON public.brands;
CREATE POLICY brands_select_member
ON public.brands
FOR SELECT
TO authenticated
USING (
  created_by = auth.uid()
  OR app_private.is_brand_member(id, auth.uid())
);