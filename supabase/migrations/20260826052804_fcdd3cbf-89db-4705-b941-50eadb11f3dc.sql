ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS media_urls text[] NOT NULL DEFAULT '{}'::text[];

ALTER TABLE public.post_targets
  ADD COLUMN IF NOT EXISTS channel_account_id uuid REFERENCES public.channel_accounts(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS post_targets_channel_account_idx ON public.post_targets(channel_account_id);