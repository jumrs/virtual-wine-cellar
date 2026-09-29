-- Migration: Decode HTML entities that were written into text columns
-- Previously, sanitizeTextInput() HTML-escaped user/AI text before saving it,
-- so values like "Château d'Yquem" were stored as "Château d&#x27;Yquem".
-- The app now stores raw text, so this reverses the old encoding.
--
-- decode_legacy_html() is the exact inverse of the old encoder: "&amp;" is
-- replaced LAST, so text a user literally typed as "&lt;" (stored as
-- "&amp;lt;") correctly decodes back to "&lt;".
--
-- Not reversible: the old encoder also deleted "javascript:"/"vbscript:" and
-- rewrote "onXxx=" to "blocked=". Those edits cannot be undone reliably, and
-- they are practically nonexistent in wine data.
--
-- Safe to re-run: text without these entities is left unchanged.

CREATE OR REPLACE FUNCTION decode_legacy_html(input TEXT)
RETURNS TEXT AS $$
DECLARE
  result TEXT := input;
BEGIN
  IF result IS NULL THEN
    RETURN NULL;
  END IF;
  result := replace(result, 'data-blocked:', 'data:');
  result := replace(result, '&#x2F;', '/');
  result := replace(result, '&#x27;', '''');
  result := replace(result, '&quot;', '"');
  result := replace(result, '&gt;', '>');
  result := replace(result, '&lt;', '<');
  result := replace(result, '&amp;', '&');  -- must be last
  RETURN result;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ============================================
-- 1. WINES
-- ============================================
UPDATE wines SET
  name    = decode_legacy_html(name),
  type    = decode_legacy_html(type),
  grape   = decode_legacy_html(grape),
  region  = decode_legacy_html(region),
  country = decode_legacy_html(country),
  notes   = decode_legacy_html(notes),
  grapes  = CASE WHEN grapes IS NULL THEN NULL ELSE ARRAY(
              SELECT decode_legacy_html(g)
              FROM unnest(grapes) WITH ORDINALITY AS t(g, ord)
              ORDER BY ord
            ) END
WHERE name  ~ '&(amp|lt|gt|quot|#x27|#x2F);|data-blocked:'
   OR type  ~ '&(amp|lt|gt|quot|#x27|#x2F);'
   OR grape ~ '&(amp|lt|gt|quot|#x27|#x2F);'
   OR region  ~ '&(amp|lt|gt|quot|#x27|#x2F);'
   OR country ~ '&(amp|lt|gt|quot|#x27|#x2F);'
   OR notes   ~ '&(amp|lt|gt|quot|#x27|#x2F);|data-blocked:'
   OR array_to_string(grapes, '|') ~ '&(amp|lt|gt|quot|#x27|#x2F);';

-- ============================================
-- 2. PROFILES (the app uses user_profiles; some installs have profiles)
-- ============================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_profiles') THEN
    UPDATE user_profiles SET
      name     = decode_legacy_html(name),
      username = decode_legacy_html(username)
    WHERE name ~ '&(amp|lt|gt|quot|#x27|#x2F);'
       OR username ~ '&(amp|lt|gt|quot|#x27|#x2F);';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'profiles') THEN
    UPDATE profiles SET
      name     = decode_legacy_html(name),
      username = decode_legacy_html(username)
    WHERE name ~ '&(amp|lt|gt|quot|#x27|#x2F);'
       OR username ~ '&(amp|lt|gt|quot|#x27|#x2F);';
  END IF;
END $$;

DROP FUNCTION decode_legacy_html(TEXT);
