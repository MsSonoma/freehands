-- Add portfolio_exports table to persist generated portfolios for revisit/delete
CREATE TABLE IF NOT EXISTS public.portfolio_exports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  facilitator_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  learner_id uuid NOT NULL REFERENCES public.learners(id) ON DELETE CASCADE,

  -- Matches the folder name used in Storage (portfolios/<facilitator>/<learner>/<portfolioId>/...)
  portfolio_id uuid NOT NULL,

  start_date date NOT NULL,
  end_date date NOT NULL,

  include_visual_aids boolean NOT NULL DEFAULT true,
  include_notes boolean NOT NULL DEFAULT true,
  include_images boolean NOT NULL DEFAULT true,

  index_path text NOT NULL,
  manifest_path text NOT NULL,

  created_at timestamptz NOT NULL DEFAULT now(),

  UNIQUE(facilitator_id, learner_id, portfolio_id)
);

CREATE INDEX IF NOT EXISTS idx_portfolio_exports_facilitator_learner
  ON public.portfolio_exports(facilitator_id, learner_id);

CREATE INDEX IF NOT EXISTS idx_portfolio_exports_created
  ON public.portfolio_exports(created_at);

ALTER TABLE public.portfolio_exports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Facilitators can view their own portfolio exports"
  ON public.portfolio_exports FOR SELECT
  USING (auth.uid() = facilitator_id);

CREATE POLICY "Facilitators can insert their own portfolio exports"
  ON public.portfolio_exports FOR INSERT
  WITH CHECK (auth.uid() = facilitator_id);

CREATE POLICY "Facilitators can delete their own portfolio exports"
  ON public.portfolio_exports FOR DELETE
  USING (auth.uid() = facilitator_id);
