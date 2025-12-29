-- Migration: Shared Cellars Feature
-- This migration adds support for multiple users sharing the same wine cellar

-- ============================================
-- 1. CREATE CELLARS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS cellars (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for faster lookups by owner
CREATE INDEX IF NOT EXISTS idx_cellars_owner_id ON cellars(owner_id);

-- ============================================
-- 2. CREATE CELLAR_MEMBERS JOIN TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS cellar_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cellar_id UUID NOT NULL REFERENCES cellars(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('owner', 'member')) DEFAULT 'member',
  added_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  -- Prevent duplicate memberships
  UNIQUE(cellar_id, user_id)
);

-- Indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_cellar_members_cellar_id ON cellar_members(cellar_id);
CREATE INDEX IF NOT EXISTS idx_cellar_members_user_id ON cellar_members(user_id);

-- ============================================
-- 3. ADD CELLAR_ID TO WINES TABLE (keep user_wines for backward compatibility during migration)
-- ============================================
ALTER TABLE wines ADD COLUMN IF NOT EXISTS cellar_id UUID REFERENCES cellars(id) ON DELETE CASCADE;

-- Index for faster lookups by cellar
CREATE INDEX IF NOT EXISTS idx_wines_cellar_id ON wines(cellar_id);

-- ============================================
-- 4. PENDING INVITES TABLE (for inviting non-existing users)
-- ============================================
CREATE TABLE IF NOT EXISTS cellar_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cellar_id UUID NOT NULL REFERENCES cellars(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  invited_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  -- One active invite per email per cellar
  UNIQUE(cellar_id, email)
);

CREATE INDEX IF NOT EXISTS idx_cellar_invites_email ON cellar_invites(email);
CREATE INDEX IF NOT EXISTS idx_cellar_invites_token ON cellar_invites(token);

-- ============================================
-- 5. ENABLE ROW LEVEL SECURITY
-- ============================================
ALTER TABLE cellars ENABLE ROW LEVEL SECURITY;
ALTER TABLE cellar_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE cellar_invites ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 6. RLS POLICIES FOR CELLARS
-- ============================================

-- Users can view cellars they are members of
CREATE POLICY "Users can view their cellars"
  ON cellars FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM cellar_members
      WHERE cellar_members.cellar_id = cellars.id
      AND cellar_members.user_id = auth.uid()
    )
  );

-- Users can create cellars
CREATE POLICY "Users can create cellars"
  ON cellars FOR INSERT
  WITH CHECK (auth.uid() = owner_id);

-- Only owners can update cellars
CREATE POLICY "Owners can update their cellars"
  ON cellars FOR UPDATE
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

-- Only owners can delete cellars
CREATE POLICY "Owners can delete their cellars"
  ON cellars FOR DELETE
  USING (auth.uid() = owner_id);

-- ============================================
-- 7. RLS POLICIES FOR CELLAR_MEMBERS
-- ============================================

-- Users can view members of cellars they belong to
CREATE POLICY "Users can view cellar members"
  ON cellar_members FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM cellar_members AS cm
      WHERE cm.cellar_id = cellar_members.cellar_id
      AND cm.user_id = auth.uid()
    )
  );

-- Owners can add members (checked via cellar ownership)
CREATE POLICY "Owners can add members"
  ON cellar_members FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM cellars
      WHERE cellars.id = cellar_members.cellar_id
      AND cellars.owner_id = auth.uid()
    )
    OR (cellar_members.user_id = auth.uid() AND cellar_members.role = 'owner')
  );

-- Owners can remove members
CREATE POLICY "Owners can remove members"
  ON cellar_members FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM cellars
      WHERE cellars.id = cellar_members.cellar_id
      AND cellars.owner_id = auth.uid()
    )
    OR cellar_members.user_id = auth.uid() -- Users can leave cellars
  );

-- ============================================
-- 8. RLS POLICIES FOR CELLAR_INVITES
-- ============================================

-- Owners can view invites for their cellars
CREATE POLICY "Owners can view cellar invites"
  ON cellar_invites FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM cellars
      WHERE cellars.id = cellar_invites.cellar_id
      AND cellars.owner_id = auth.uid()
    )
  );

-- Owners can create invites
CREATE POLICY "Owners can create invites"
  ON cellar_invites FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM cellars
      WHERE cellars.id = cellar_invites.cellar_id
      AND cellars.owner_id = auth.uid()
    )
  );

-- Owners can delete invites
CREATE POLICY "Owners can delete invites"
  ON cellar_invites FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM cellars
      WHERE cellars.id = cellar_invites.cellar_id
      AND cellars.owner_id = auth.uid()
    )
  );

-- ============================================
-- 9. UPDATE WINES RLS POLICIES
-- ============================================

-- Drop old wine policies to recreate with cellar support
DROP POLICY IF EXISTS "Users can view wines they own" ON wines;
DROP POLICY IF EXISTS "Users can insert wines" ON wines;

-- Users can view wines in cellars they belong to (or their personal wines via user_wines for backward compatibility)
CREATE POLICY "Users can view wines in their cellars"
  ON wines FOR SELECT
  USING (
    -- New cellar-based access
    EXISTS (
      SELECT 1 FROM cellar_members
      WHERE cellar_members.cellar_id = wines.cellar_id
      AND cellar_members.user_id = auth.uid()
    )
    OR
    -- Backward compatibility with user_wines
    EXISTS (
      SELECT 1 FROM user_wines
      WHERE user_wines.wine_id = wines.id
      AND user_wines.user_id = auth.uid()
    )
  );

-- Users can insert wines to cellars they belong to
CREATE POLICY "Users can insert wines to their cellars"
  ON wines FOR INSERT
  WITH CHECK (
    -- Allow if cellar_id is null (backward compat) or user is member
    cellar_id IS NULL
    OR EXISTS (
      SELECT 1 FROM cellar_members
      WHERE cellar_members.cellar_id = wines.cellar_id
      AND cellar_members.user_id = auth.uid()
    )
  );

-- Users can update wines in their cellars
CREATE POLICY "Users can update wines in their cellars"
  ON wines FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM cellar_members
      WHERE cellar_members.cellar_id = wines.cellar_id
      AND cellar_members.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM user_wines
      WHERE user_wines.wine_id = wines.id
      AND user_wines.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM cellar_members
      WHERE cellar_members.cellar_id = wines.cellar_id
      AND cellar_members.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM user_wines
      WHERE user_wines.wine_id = wines.id
      AND user_wines.user_id = auth.uid()
    )
  );

-- Users can delete wines from their cellars
CREATE POLICY "Users can delete wines from their cellars"
  ON wines FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM cellar_members
      WHERE cellar_members.cellar_id = wines.cellar_id
      AND cellar_members.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM user_wines
      WHERE user_wines.wine_id = wines.id
      AND user_wines.user_id = auth.uid()
    )
  );

-- ============================================
-- 10. MIGRATION FUNCTION: Create default cellars for existing users
-- ============================================
-- This function creates a default cellar for users who don't have one
-- and migrates their existing wines to that cellar

CREATE OR REPLACE FUNCTION migrate_user_wines_to_cellars()
RETURNS void AS $$
DECLARE
  user_record RECORD;
  new_cellar_id UUID;
  profile_name TEXT;
  profile_username TEXT;
  cellar_name TEXT;
  user_email TEXT;
  profile_found BOOLEAN := false;
BEGIN
  -- Get all users who have wines but no cellar
  FOR user_record IN 
    SELECT DISTINCT uw.user_id 
    FROM user_wines uw
    WHERE NOT EXISTS (
      SELECT 1 FROM cellar_members cm WHERE cm.user_id = uw.user_id
    )
  LOOP
    -- Initialize variables
    profile_name := NULL;
    profile_username := NULL;
    user_email := NULL;
    profile_found := false;
    
    -- Try to get user's name from profiles table (if it exists)
    BEGIN
      SELECT name, username INTO profile_name, profile_username
      FROM profiles
      WHERE id = user_record.user_id;
      
      -- Check if we found a profile
      IF FOUND THEN
        profile_found := true;
      END IF;
    EXCEPTION
      WHEN OTHERS THEN
        -- Profiles table might not exist or have different structure
        profile_found := false;
    END;
    
    -- Try to get email from auth.users as fallback
    BEGIN
      SELECT email INTO user_email
      FROM auth.users
      WHERE id = user_record.user_id;
    EXCEPTION
      WHEN OTHERS THEN
        user_email := NULL;
    END;
    
    -- Create cellar name with fallbacks
    IF profile_found AND profile_name IS NOT NULL AND profile_name != '' THEN
      cellar_name := profile_name || '''s Cellar';
    ELSIF profile_found AND profile_username IS NOT NULL AND profile_username != '' THEN
      cellar_name := profile_username || '''s Cellar';
    ELSIF user_email IS NOT NULL THEN
      cellar_name := split_part(user_email, '@', 1) || '''s Cellar';
    ELSE
      cellar_name := 'My Cellar';
    END IF;
    
    -- Create a default cellar for the user
    INSERT INTO cellars (name, owner_id)
    VALUES (cellar_name, user_record.user_id)
    RETURNING id INTO new_cellar_id;
    
    -- Add user as owner member
    INSERT INTO cellar_members (cellar_id, user_id, role)
    VALUES (new_cellar_id, user_record.user_id, 'owner');
    
    -- Update all wines owned by this user to the new cellar
    UPDATE wines SET cellar_id = new_cellar_id
    WHERE id IN (
      SELECT wine_id FROM user_wines WHERE user_id = user_record.user_id
    );
    
    RAISE NOTICE 'Migrated wines for user % to cellar %', user_record.user_id, new_cellar_id;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 11. AUTO-CREATE CELLAR FUNCTION (for new users)
-- ============================================
CREATE OR REPLACE FUNCTION create_default_cellar_for_user()
RETURNS TRIGGER AS $$
DECLARE
  new_cellar_id UUID;
  user_name TEXT;
BEGIN
  -- Get user's name/email for cellar naming
  SELECT COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)) INTO user_name;
  
  -- Create default cellar
  INSERT INTO cellars (name, owner_id)
  VALUES (user_name || '''s Cellar', NEW.id)
  RETURNING id INTO new_cellar_id;
  
  -- Add user as owner
  INSERT INTO cellar_members (cellar_id, user_id, role)
  VALUES (new_cellar_id, NEW.id, 'owner');
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Note: To activate auto-creation for new users, run:
-- CREATE TRIGGER on_auth_user_created
--   AFTER INSERT ON auth.users
--   FOR EACH ROW EXECUTE FUNCTION create_default_cellar_for_user();

-- ============================================
-- 12. HELPER FUNCTION: Accept invite
-- ============================================
CREATE OR REPLACE FUNCTION accept_cellar_invite(invite_token TEXT)
RETURNS JSON AS $$
DECLARE
  invite_record RECORD;
  result JSON;
BEGIN
  -- Find the invite
  SELECT * INTO invite_record
  FROM cellar_invites
  WHERE token = invite_token
  AND expires_at > NOW();
  
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Invalid or expired invite');
  END IF;
  
  -- Check if the current user's email matches
  IF (SELECT email FROM auth.users WHERE id = auth.uid()) != invite_record.email THEN
    RETURN json_build_object('success', false, 'error', 'This invite is for a different email address');
  END IF;
  
  -- Check if already a member
  IF EXISTS (
    SELECT 1 FROM cellar_members 
    WHERE cellar_id = invite_record.cellar_id 
    AND user_id = auth.uid()
  ) THEN
    -- Delete the invite since they're already a member
    DELETE FROM cellar_invites WHERE id = invite_record.id;
    RETURN json_build_object('success', true, 'message', 'Already a member of this cellar');
  END IF;
  
  -- Add user as member
  INSERT INTO cellar_members (cellar_id, user_id, role)
  VALUES (invite_record.cellar_id, auth.uid(), 'member');
  
  -- Delete the used invite
  DELETE FROM cellar_invites WHERE id = invite_record.id;
  
  RETURN json_build_object(
    'success', true, 
    'cellar_id', invite_record.cellar_id,
    'message', 'Successfully joined cellar'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 13. REALTIME SUBSCRIPTIONS SETUP
-- ============================================
-- Enable realtime for the wines table (cellar-based)
ALTER PUBLICATION supabase_realtime ADD TABLE wines;
ALTER PUBLICATION supabase_realtime ADD TABLE cellar_members;

-- ============================================
-- Run the migration for existing users
-- ============================================
-- SELECT migrate_user_wines_to_cellars();
-- Note: Uncomment the above line to run the migration, or run it manually

