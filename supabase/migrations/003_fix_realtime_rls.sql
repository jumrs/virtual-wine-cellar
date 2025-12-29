-- Fix Real-time Subscriptions and RLS for Shared Cellars
-- Run this to enable real-time updates for cellar members

-- ============================================
-- 1. ENABLE REALTIME FOR TABLES
-- ============================================
-- Note: These commands may fail if already set up, that's OK

-- Enable realtime for wines table
DO $$ 
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE wines;
EXCEPTION
  WHEN duplicate_object THEN
    NULL; -- Table already in publication
END $$;

-- Enable realtime for cellar_members table
DO $$ 
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE cellar_members;
EXCEPTION
  WHEN duplicate_object THEN
    NULL;
END $$;

-- Enable realtime for cellar_invites table
DO $$ 
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE cellar_invites;
EXCEPTION
  WHEN duplicate_object THEN
    NULL;
END $$;

-- ============================================
-- 2. FIX RLS POLICIES FOR CELLAR_INVITES
-- ============================================

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Owners can view cellar invites" ON cellar_invites;
DROP POLICY IF EXISTS "Owners can create invites" ON cellar_invites;
DROP POLICY IF EXISTS "Owners can delete invites" ON cellar_invites;
DROP POLICY IF EXISTS "Users can view their own invites" ON cellar_invites;
DROP POLICY IF EXISTS "Users can delete their own invites" ON cellar_invites;

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

-- Users can view invites sent to their email
CREATE POLICY "Users can view their own invites"
  ON cellar_invites FOR SELECT
  USING (
    email = (SELECT email FROM auth.users WHERE id = auth.uid())
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

-- Invited users can delete their own invites (decline)
CREATE POLICY "Users can delete their own invites"
  ON cellar_invites FOR DELETE
  USING (
    email = (SELECT email FROM auth.users WHERE id = auth.uid())
  );

-- ============================================
-- 3. FIX CELLAR_MEMBERS RLS POLICIES
-- ============================================

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view cellar members" ON cellar_members;
DROP POLICY IF EXISTS "Owners can add members" ON cellar_members;
DROP POLICY IF EXISTS "Owners can remove members" ON cellar_members;

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

-- Owners can add members
CREATE POLICY "Owners can add members"
  ON cellar_members FOR INSERT
  WITH CHECK (
    -- Allow if user is the owner of the cellar
    EXISTS (
      SELECT 1 FROM cellars
      WHERE cellars.id = cellar_members.cellar_id
      AND cellars.owner_id = auth.uid()
    )
    OR 
    -- Allow users to add themselves (when accepting an invite)
    (cellar_members.user_id = auth.uid())
  );

-- Owners can remove members, or users can remove themselves
CREATE POLICY "Owners or self can remove members"
  ON cellar_members FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM cellars
      WHERE cellars.id = cellar_members.cellar_id
      AND cellars.owner_id = auth.uid()
    )
    OR cellar_members.user_id = auth.uid()
  );

-- ============================================
-- 4. REPLICA IDENTITY FOR REALTIME
-- ============================================
-- This ensures DELETE events include the full row data

ALTER TABLE wines REPLICA IDENTITY FULL;
ALTER TABLE cellar_members REPLICA IDENTITY FULL;
ALTER TABLE cellar_invites REPLICA IDENTITY FULL;

-- ============================================
-- 5. VERIFY SETUP
-- ============================================
-- You can run these queries to verify:

-- Check tables in realtime publication:
-- SELECT * FROM pg_publication_tables WHERE pubname = 'supabase_realtime';

-- Check RLS is enabled:
-- SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public';

