DROP POLICY "master seed insert" ON public.master_routing;
REVOKE INSERT ON public.master_routing FROM anon;