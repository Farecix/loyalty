-- 0007: Supabase güvenlik uyarıları
alter function public.gen_code(int) set search_path = public;
alter function public.normalize_phone(text) set search_path = public;
alter function public.haversine_m(float8, float8, float8, float8) set search_path = public;
revoke execute on function public.is_staff(uuid), public.my_customer_ids() from public, anon;
revoke execute on function public.shop_cycle_length(uuid), public.gen_code(int), public.haversine_m(float8, float8, float8, float8)
  from public, anon, authenticated;
grant execute on function public.is_staff(uuid), public.my_customer_ids() to authenticated;
