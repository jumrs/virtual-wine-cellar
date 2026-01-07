-- Migration: Add user_uploaded_label_url column to wines table
-- This allows storing the user's scanned label separately from the standardized bottle image

-- Add the new column for user-uploaded label photos
ALTER TABLE wines ADD COLUMN IF NOT EXISTS user_uploaded_label_url TEXT;

-- Add comment explaining the field usage
COMMENT ON COLUMN wines.user_uploaded_label_url IS 'URL to the user-uploaded label photo (from scan)';
COMMENT ON COLUMN wines.label_image_url IS 'URL to the standardized bottle/product image (from AI enrichment or manual selection)';

-- Create index for potential future queries on wines with user uploads
CREATE INDEX IF NOT EXISTS idx_wines_has_user_label ON wines((user_uploaded_label_url IS NOT NULL));


