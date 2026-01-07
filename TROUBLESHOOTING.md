# Troubleshooting Guide

## Common Errors When Adding Wines

### 1. "Bucket not found" or Storage Errors

**Problem**: The `wine-labels` storage bucket doesn't exist in Supabase.

**Solution**:
1. Go to your Supabase project → Storage
2. Click "New bucket"
3. Name it: `wine-labels`
4. Make it **Public**
5. Click "Create bucket"

Then run this SQL in the SQL Editor to set up policies:

```sql
-- Create storage policy for uploads
CREATE POLICY "Users can upload wine labels"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'wine-labels' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Anyone can view wine labels"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'wine-labels');
```

### 2. "Database error" or "Failed to save wine"

**Problem**: Database tables or RLS policies are not set up correctly.

**Solution**:
1. Go to Supabase → SQL Editor
2. Run the entire `supabase-schema.sql` file
3. Verify tables exist: Go to Table Editor and check for `wines` and `user_wines` tables

### 3. "Unauthorized" Error

**Problem**: Authentication token is invalid or expired.

**Solution**:
1. Sign out and sign back in
2. Check that you're logged in (you should see your email on the dashboard)
3. Try again

### 4. "OpenAI API key is invalid"

**Problem**: OpenAI API key is missing or incorrect.

**Solution**:
1. Check your `.env.local` file has `OPENAI_API_KEY=sk-...`
2. Verify the key is correct at https://platform.openai.com/api-keys
3. Make sure you have credits/billing set up
4. Restart the dev server after changing `.env.local`

### 5. "Failed to analyze wine label"

**Problem**: Image is too large, wrong format, or OpenAI API issue.

**Solution**:
- Try a smaller image (under 10MB)
- Use common formats: JPG, PNG, WEBP
- Check browser console (F12) for detailed error messages
- Verify OpenAI API key and credits

## How to Check Error Details

1. **Browser Console**: Press F12 → Console tab
2. **Server Logs**: Check the terminal where `npm run dev` is running
3. **Toast Messages**: Error messages now show more details

## Quick Checklist

- [ ] Supabase project is active
- [ ] Database tables created (`wines`, `user_wines`)
- [ ] Storage bucket `wine-labels` exists and is public
- [ ] RLS policies are set up
- [ ] Environment variables are correct in `.env.local`
- [ ] Dev server restarted after changing `.env.local`
- [ ] You're logged in to the app
- [ ] OpenAI API key is valid and has credits

## Still Having Issues?

Check the browser console (F12) and terminal logs for specific error messages. The improved error handling should now show you exactly what's wrong!











