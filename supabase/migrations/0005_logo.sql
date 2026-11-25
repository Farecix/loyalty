-- 0005: dükkân logosu müşteri ekranlarında

create or replace function public.card_json(p_customer uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'customer', jsonb_build_object('id', c.id, 'name', c.name, 'invite_code', c.invite_code),
    'shop', jsonb_build_object('name', sh.name, 'logo_url', sh.logo_url),
    'progress', public.customer_progress(c.id),
    'cycle_length', public.shop_cycle_length(c.shop_id),
    'rules', coalesce((select jsonb_agg(jsonb_build_object('threshold', r.threshold, 'title_th', r.title_th, 'title_en', r.title_en) order by r.threshold)
                       from reward_rules r where r.shop_id = c.shop_id and r.active), '[]'::jsonb),
    'available', coalesce((select jsonb_agg(jsonb_build_object('id', g.id, 'title_th', g.title_th, 'title_en', g.title_en, 'created_at', g.created_at) order by g.created_at)
                           from reward_grants g where g.customer_id = c.id and g.redeemed_at is null and g.voided_at is null), '[]'::jsonb),
    'last_stamp_at', ls.created_at,
    'next_allowed_at', case when ls.created_at + make_interval(hours => sh.cooldown_hours) > now()
                            then ls.created_at + make_interval(hours => sh.cooldown_hours) end
  )
  from customers c
  join shops sh on sh.id = c.shop_id
  left join lateral (select created_at from stamps where customer_id = c.id and source = 'card' and cancelled_at is null
                     order by created_at desc limit 1) ls on true
  where c.id = p_customer
$$;

create or replace function public.shop_public(p_shop_code text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare s shops;
begin
  s := shop_by_code(p_shop_code);
  return jsonb_build_object('name', s.name, 'logo_url', s.logo_url);
end $$;
