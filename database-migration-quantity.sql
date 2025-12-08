-- Migration script to add quantity column to existing user_wines table
-- Run this in your Supabase SQL Editor if you already have the database set up

-- Add quantity column if it doesn't exist
ALTER TABLE user_wines ADD COLUMN IF NOT EXISTS quantity INTEGER NOT NULL DEFAULT 1;

-- Update any existing records without quantity to have quantity = 1
UPDATE user_wines SET quantity = 1 WHERE quantity IS NULL;

