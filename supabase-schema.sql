-- Virtual Wine Cellar Database Schema
-- Run this in your Supabase SQL Editor

-- Create wines table
CREATE TABLE IF NOT EXISTS wines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  type TEXT,
  grape TEXT,
  region TEXT,
  country TEXT,
  vintage INTEGER,
  score NUMERIC(3, 2) CHECK (score >= 0 AND score <= 5),
  label_image_url TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add type column if table already exists (for existing installations)
ALTER TABLE wines ADD COLUMN IF NOT EXISTS type TEXT;

-- Add country column if table already exists (for existing installations)
ALTER TABLE wines ADD COLUMN IF NOT EXISTS country TEXT;

-- Add score column if table already exists (for existing installations)
ALTER TABLE wines ADD COLUMN IF NOT EXISTS score NUMERIC(3, 2) CHECK (score >= 0 AND score <= 5);

-- Create user_wines junction table
CREATE TABLE IF NOT EXISTS user_wines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  wine_id UUID NOT NULL REFERENCES wines(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL DEFAULT 1,
  date_added TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, wine_id)
);

-- Add quantity column if table already exists (for existing installations)
ALTER TABLE user_wines ADD COLUMN IF NOT EXISTS quantity INTEGER NOT NULL DEFAULT 1;

-- Enable Row Level Security
ALTER TABLE wines ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_wines ENABLE ROW LEVEL SECURITY;

-- Create policies for user_wines
CREATE POLICY "Users can view their own wines"
  ON user_wines FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own wines"
  ON user_wines FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own wines"
  ON user_wines FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own wines"
  ON user_wines FOR DELETE
  USING (auth.uid() = user_id);

-- Create policies for wines (users can view wines they own)
CREATE POLICY "Users can view wines they own"
  ON wines FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_wines
      WHERE user_wines.wine_id = wines.id
      AND user_wines.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert wines"
  ON wines FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Users can update wines they own"
  ON wines FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM user_wines
      WHERE user_wines.wine_id = wines.id
      AND user_wines.user_id = auth.uid()
    )
  );

-- Create storage bucket for wine labels
INSERT INTO storage.buckets (id, name, public) 
VALUES ('wine-labels', 'wine-labels', true)
ON CONFLICT (id) DO NOTHING;

-- Create storage policy for uploads
CREATE POLICY "Users can upload wine labels"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'wine-labels' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Anyone can view wine labels"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'wine-labels');

