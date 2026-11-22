-- Keep the event trigger active while preventing direct RPC execution
-- of its SECURITY DEFINER function by API roles.
REVOKE ALL PRIVILEGES ON FUNCTION public.rls_auto_enable() FROM PUBLIC, anon, authenticated;
