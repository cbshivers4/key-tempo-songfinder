CREATE TABLE public.library_songs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  song jsonb NOT NULL,
  favorite boolean NOT NULL DEFAULT false,
  identified_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.library_songs TO authenticated;
GRANT ALL ON public.library_songs TO service_role;
ALTER TABLE public.library_songs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own select" ON public.library_songs FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own insert" ON public.library_songs FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own update" ON public.library_songs FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own delete" ON public.library_songs FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE INDEX ON public.library_songs (user_id, identified_at DESC);