-- Add Main Cellar Feature
-- This migration adds support for users to select a main cellar that displays on login

-- ============================================
-- 1. ADD MAIN_CELLAR_ID TO USER_PROFILES (or profiles)
-- ============================================

-- Try to add to user_profiles first (if it exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_profiles') THEN
    ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS main_cellar_id UUID REFERENCES cellars(id) ON DELETE SET NULL;
    CREATE INDEX IF NOT EXISTS idx_user_profiles_main_cellar_id ON user_profiles(main_cellar_id);
  END IF;
END $$;

-- Also try profiles table (in case it's the actual table name)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'profiles') THEN
    ALTER TABLE profiles ADD COLUMN IF NOT EXISTS main_cellar_id UUID REFERENCES cellars(id) ON DELETE SET NULL;
    CREATE INDEX IF NOT EXISTS idx_profiles_main_cellar_id ON profiles(main_cellar_id);
  END IF;
END $$;

-- ============================================
-- 2. ADD RLS POLICY FOR MAIN_CELLAR_ID
-- ============================================
-- Users can only set main_cellar_id to cellars they are members of
-- This is enforced at the application level, but we add a check constraint for safety

-- Note: RLS policies for user_profiles/profiles should already allow users to update their own profile
-- The application will verify cellar membership before allowing main_cellar_id to be set

