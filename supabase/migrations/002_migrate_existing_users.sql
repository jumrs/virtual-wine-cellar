-- Migration Script: Migrate Existing Users to Cellars
-- Run this AFTER running 001_shared_cellars.sql
-- This creates default cellars for users who already have wines

-- ============================================
-- MIGRATION FUNCTION: Create default cellars for existing users
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

-- Run the migration
SELECT migrate_user_wines_to_cellars();

