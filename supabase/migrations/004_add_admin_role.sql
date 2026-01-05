-- Add Admin Role to Cellar Members
-- This migration adds support for the 'admin' role in cellar membership

-- ============================================
-- 1. UPDATE ROLE CHECK CONSTRAINT
-- ============================================

-- Drop the existing constraint
ALTER TABLE cellar_members DROP CONSTRAINT IF EXISTS cellar_members_role_check;

-- Add new constraint with admin role
ALTER TABLE cellar_members ADD CONSTRAINT cellar_members_role_check 
  CHECK (role IN ('owner', 'admin', 'member'));

-- ============================================
-- 2. UPDATE RLS POLICIES FOR ADMIN PERMISSIONS
-- ============================================

-- Drop existing member management policies
DROP POLICY IF EXISTS "Owners can remove members" ON cellar_members;
DROP POLICY IF EXISTS "Owners or self can remove members" ON cellar_members;

-- Admins and owners can remove regular members (but admins can't remove other admins)
CREATE POLICY "Owners and admins can remove members"
  ON cellar_members FOR DELETE
  USING (
    -- Owner can remove anyone except themselves
    (
      EXISTS (
        SELECT 1 FROM cellars
        WHERE cellars.id = cellar_members.cellar_id
        AND cellars.owner_id = auth.uid()
      )
      AND cellar_members.user_id != auth.uid()
    )
    OR
    -- Admins can remove regular members only
    (
      EXISTS (
        SELECT 1 FROM cellar_members AS cm
        WHERE cm.cellar_id = cellar_members.cellar_id
        AND cm.user_id = auth.uid()
        AND cm.role = 'admin'
      )
      AND cellar_members.role = 'member'
    )
    OR
    -- Anyone can remove themselves (except owner)
    (
      cellar_members.user_id = auth.uid()
      AND cellar_members.role != 'owner'
    )
  );

-- ============================================
-- 3. UPDATE POLICIES FOR ROLE CHANGES
-- ============================================

-- Allow owners to update member roles
DROP POLICY IF EXISTS "Owners can update members" ON cellar_members;

CREATE POLICY "Owners can update member roles"
  ON cellar_members FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM cellars
      WHERE cellars.id = cellar_members.cellar_id
      AND cellars.owner_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM cellars
      WHERE cellars.id = cellar_members.cellar_id
      AND cellars.owner_id = auth.uid()
    )
    -- Can't change to owner role via update
    AND role != 'owner'
  );

-- ============================================
-- 4. ADMIN PERMISSIONS DOCUMENTATION
-- ============================================
-- Admin permissions:
--   ✓ View all wines in the cellar
--   ✓ Add wines to the cellar
--   ✓ Edit wines in the cellar
--   ✓ Delete wines from the cellar
--   ✓ Remove regular members (not admins or owner)
--   ✗ Cannot delete the cellar
--   ✗ Cannot change other members' roles
--   ✗ Cannot remove admins or the owner
--   ✗ Cannot rename the cellar

