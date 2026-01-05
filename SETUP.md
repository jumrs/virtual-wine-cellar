# Quick Setup Guide

## Step 1: Install Dependencies

```bash
npm install
```

## Step 2: Set Up Supabase

1. Go to [supabase.com](https://supabase.com) and create a new project
2. In the SQL Editor, run the contents of `supabase-schema.sql`
3. Go to Settings > API and copy:
   - Project URL
   - Anon/public key
   - Service role key

## Step 3: Get OpenAI API Key

1. Go to [platform.openai.com](https://platform.openai.com)
2. Create an API key
3. Make sure you have credits/billing set up

## Step 4: Configure Environment Variables

Create `.env.local` in the root directory:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

OPENAI_API_KEY=sk-your-openai-key
```

## Step 5: Run the App

```bash
npm run dev
```

Visit http://localhost:3000

## Troubleshooting

### Image Upload Issues
- Make sure the `wine-labels` storage bucket exists in Supabase
- Check that storage policies are set correctly

### Authentication Issues
- Verify your Supabase URL and keys are correct
- Check that RLS policies are enabled and configured

### OpenAI API Issues
- Verify your API key is correct
- Check that you have sufficient credits
- Ensure GPT-4o model access is enabled









