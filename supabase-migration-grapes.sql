-- Migration: Add grape blend support
-- Run this in your Supabase SQL Editor after the initial schema

-- Add is_blend boolean column (defaults to false)
ALTER TABLE wines ADD COLUMN IF NOT EXISTS is_blend BOOLEAN DEFAULT false;

-- Add grapes array column for storing multiple grape varieties
ALTER TABLE wines ADD COLUMN IF NOT EXISTS grapes TEXT[] DEFAULT '{}';

-- Migration function to convert existing grape strings to arrays
-- This handles common delimiters: /, ,, +, and
DO $$
DECLARE
    wine_record RECORD;
    grape_array TEXT[];
    trimmed_grape TEXT;
    grape_item TEXT;
BEGIN
    FOR wine_record IN 
        SELECT id, grape 
        FROM wines 
        WHERE grape IS NOT NULL 
        AND grape != ''
        AND (grapes IS NULL OR grapes = '{}')
    LOOP
        -- Split by common delimiters
        grape_array := ARRAY[]::TEXT[];
        
        -- Split the grape string by /, ,, +, or 'and'
        FOR grape_item IN 
            SELECT unnest(
                regexp_split_to_array(
                    wine_record.grape, 
                    '\s*[\/,+]\s*|\s+and\s+'
                )
            )
        LOOP
            trimmed_grape := btrim(grape_item);
            IF trimmed_grape != '' THEN
                grape_array := array_append(grape_array, trimmed_grape);
            END IF;
        END LOOP;
        
        -- Update the wine record
        IF array_length(grape_array, 1) > 0 THEN
            UPDATE wines 
            SET 
                grapes = grape_array,
                is_blend = (array_length(grape_array, 1) > 1)
            WHERE id = wine_record.id;
        END IF;
    END LOOP;
END $$;

-- Create an index on grapes array for efficient filtering
CREATE INDEX IF NOT EXISTS idx_wines_grapes ON wines USING GIN (grapes);

-- Create an index on is_blend for filtering blends
CREATE INDEX IF NOT EXISTS idx_wines_is_blend ON wines (is_blend);

-- Optional: Create a function to automatically set is_blend based on grapes array
CREATE OR REPLACE FUNCTION update_is_blend()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.grapes IS NOT NULL AND array_length(NEW.grapes, 1) > 1 THEN
        NEW.is_blend := true;
    ELSIF NEW.grapes IS NULL OR array_length(NEW.grapes, 1) <= 1 THEN
        NEW.is_blend := false;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-update is_blend when grapes changes
DROP TRIGGER IF EXISTS trg_update_is_blend ON wines;
CREATE TRIGGER trg_update_is_blend
    BEFORE INSERT OR UPDATE OF grapes ON wines
    FOR EACH ROW
    EXECUTE FUNCTION update_is_blend();

