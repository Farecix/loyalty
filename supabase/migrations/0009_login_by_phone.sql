-- 0009: ilk kayıttan sonra telefon numarasıyla giriş (her yerden; kullanıcı kararı). Puan yine yalnız dükkânda.
drop function if exists public.reclaim_card(text, text, float8, float8, float8);

create or replace function public.login_by_phone(p_shop_code text, p_phone text) returns text
language plpgsql security definer set search_path = public as $$
declare s shops; c customers;
begin
  if auth.uid() is null then raise exception 'NOT_AUTHENTICATED'; end if;
  s := shop_by_code(p_shop_code);
  select * into c from customers where shop_id = s.id and phone = normalize_phone(p_phone) for update;
  if not found then return 'not_found'; end if;
  update customers set auth_user_id = null where shop_id = s.id and auth_user_id = auth.uid() and id <> c.id;
  update customers set auth_user_id = auth.uid() where id = c.id;
  return 'ok';
end $$;
revoke execute on function public.login_by_phone(text, text) from public, anon;
grant execute on function public.login_by_phone(text, text) to authenticated;
