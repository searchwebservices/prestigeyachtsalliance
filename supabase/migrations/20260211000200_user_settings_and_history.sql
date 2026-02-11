-- User settings fields on profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS phone_number TEXT,
  ADD COLUMN IF NOT EXISTS preferred_theme TEXT NOT NULL DEFAULT 'system',
  ADD COLUMN IF NOT EXISTS preferred_language TEXT NOT NULL DEFAULT 'en';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'profiles_preferred_theme_check'
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_preferred_theme_check
      CHECK (preferred_theme IN ('light', 'dark', 'system'));
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'profiles_preferred_language_check'
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_preferred_language_check
      CHECK (preferred_language IN ('en', 'es'));
  END IF;
END;
$$;

-- Allow users to view their own activity records (bookings + notes history).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'user_activity'
      AND policyname = 'Users can view their own activity'
  ) THEN
    CREATE POLICY "Users can view their own activity"
      ON public.user_activity
      FOR SELECT
      USING (auth.uid() = user_id);
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS idx_user_activity_event_type_created_at
  ON public.user_activity (event_type, created_at DESC);

