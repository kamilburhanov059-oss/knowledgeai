create policy "Users manage own template files"
  on storage.objects for all
  using (bucket_id = 'templates' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'templates' and (storage.foldername(name))[1] = auth.uid()::text);
