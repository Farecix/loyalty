-- Yalnız Supabase'de uygulanır (test düzeneğinde storage şeması yok).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('logos', 'logos', true, 2097152, array['image/png','image/jpeg','image/webp','image/svg+xml'])
on conflict (id) do nothing;

-- Personel yalnız kendi dükkân klasörüne (<shop_id>/...) yükleyebilir.
create policy "staff upload logos" on storage.objects for insert to authenticated
  with check (bucket_id = 'logos' and public.is_staff(((storage.foldername(name))[1])::uuid));
create policy "staff update logos" on storage.objects for update to authenticated
  using (bucket_id = 'logos' and public.is_staff(((storage.foldername(name))[1])::uuid));
