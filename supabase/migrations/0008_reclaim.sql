-- 0008: aynı müşteri yeni tarayıcıda — dükkândaysa numarasıyla kendi kartına geçer.
create or replace function public.reclaim_card(p_shop_code text, p_phone text, p_lat float8, p_lng float8, p_accuracy float8)
returns text
language plpgsql security definer set search_path = public as $$
declare s shops; c customers;
begin
  if auth.uid() is null then raise exception 'NOT_AUTHENTICATED'; end if;
  s := shop_by_code(p_shop_code);
  if s.lat is null or s.lng is null then return 'location_not_set'; end if;
  if p_lat is null or p_lng is null
     or haversine_m(s.lat, s.lng, p_lat, p_lng) - least(greatest(coalesce(p_accuracy, 0), 0), 1000) > s.radius_m then
    return 'too_far';
  end if;
  select * into c from customers where shop_id = s.id and phone = normalize_phone(p_phone) for update;
  if not found then return 'not_found'; end if;
  update customers set auth_user_id = null where shop_id = s.id and auth_user_id = auth.uid() and id <> c.id;
  update customers set auth_user_id = auth.uid() where id = c.id;
  return 'ok';
end $$;
revoke execute on function public.reclaim_card(text, text, float8, float8, float8) from public, anon;
grant execute on function public.reclaim_card(text, text, float8, float8, float8) to authenticated;
