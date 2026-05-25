-- Migration: Add view tracking to activities table
-- Run this SQL in your Supabase SQL editor

-- Step 1: Add view_count column to activities table
ALTER TABLE activities 
ADD COLUMN IF NOT EXISTS view_count INTEGER DEFAULT 0;

-- Step 2: Create RPC function to increment view count
CREATE OR REPLACE FUNCTION increment_activity_views(activity_id UUID)
RETURNS INTEGER AS $$
DECLARE
  new_count INTEGER;
BEGIN
  UPDATE activities 
  SET view_count = COALESCE(view_count, 0) + 1 
  WHERE id = activity_id;
  
  SELECT view_count INTO new_count 
  FROM activities 
  WHERE id = activity_id;
  
  RETURN new_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 3: Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION increment_activity_views(UUID) TO authenticated;