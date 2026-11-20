CREATE TABLE public.uploaded_songs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  artist TEXT NOT NULL DEFAULT 'My upload',
  file_path TEXT NOT NULL UNIQUE,
  mime_type TEXT NOT NULL,
  size_bytes BIGINT NOT NULL CHECK (size_bytes > 0 AND size_bytes <= 52428800),
  favorite BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.uploaded_songs TO authenticated;
GRANT ALL ON public.uploaded_songs TO service_role;

ALTER TABLE public.uploaded_songs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own uploaded songs"
ON public.uploaded_songs FOR SELECT TO authenticated
USING ((select auth.uid()) = user_id);

CREATE POLICY "Users can upload their own songs"
ON public.uploaded_songs FOR INSERT TO authenticated
WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can update their own uploaded songs"
ON public.uploaded_songs FOR UPDATE TO authenticated
USING ((select auth.uid()) = user_id)
WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can delete their own uploaded songs"
ON public.uploaded_songs FOR DELETE TO authenticated
USING ((select auth.uid()) = user_id);

CREATE POLICY "Users can play their own music files"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'user-music' AND (storage.foldername(name))[1] = (select auth.uid())::text);

CREATE POLICY "Users can upload their own music files"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'user-music' AND (storage.foldername(name))[1] = (select auth.uid())::text);

CREATE POLICY "Users can delete their own music files"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'user-music' AND (storage.foldername(name))[1] = (select auth.uid())::text);