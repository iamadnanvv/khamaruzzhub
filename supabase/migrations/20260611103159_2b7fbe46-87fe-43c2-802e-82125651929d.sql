CREATE TABLE public.smoke_test_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  triggered_by text NOT NULL DEFAULT 'cron',
  pass integer NOT NULL DEFAULT 0,
  fail integer NOT NULL DEFAULT 0,
  warn integer NOT NULL DEFAULT 0,
  total integer NOT NULL DEFAULT 0,
  duration_ms integer NOT NULL DEFAULT 0,
  results jsonb NOT NULL DEFAULT '[]'::jsonb
);

GRANT SELECT ON public.smoke_test_runs TO authenticated;
GRANT ALL ON public.smoke_test_runs TO service_role;

ALTER TABLE public.smoke_test_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read smoke runs"
  ON public.smoke_test_runs FOR SELECT
  TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE INDEX smoke_test_runs_created_at_idx ON public.smoke_test_runs (created_at DESC);