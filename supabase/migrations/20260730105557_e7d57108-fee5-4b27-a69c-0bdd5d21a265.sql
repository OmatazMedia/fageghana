REVOKE ALL ON FUNCTION public.revoke_user_session(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.revoke_my_other_sessions(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.revoke_user_session(uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.revoke_my_other_sessions(text) TO authenticated, service_role;