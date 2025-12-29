# Virtual Wine Cellar MVP

A modern web application for managing your wine collection with AI-powered label recognition and pairing suggestions.

## Features

- 🍷 **Wine Label Recognition**: Upload a photo of a wine label and automatically extract details using OpenAI Vision API
- 📚 **Inventory Management**: View and manage your personal wine collection
- 👨‍👩‍👧‍👦 **Shared Cellars**: Share your wine cellar with family or friends for collaborative management
- 🔄 **Real-time Sync**: See changes from other cellar members instantly
- 🤖 **AI Pairing Assistant**: Get wine pairing suggestions based on your meals using GPT-4o
- 🔐 **User Authentication**: Secure authentication with Supabase Auth
- 📱 **Responsive Design**: Beautiful, mobile-friendly interface built with TailwindCSS and ShadCN/UI

## Tech Stack

- **Frontend**: Next.js 15 (App Router) with TypeScript
- **Styling**: TailwindCSS + ShadCN/UI components
- **Database & Auth**: Supabase
- **AI**: OpenAI API (GPT-4o for vision and text)
- **Deployment**: Vercel-ready

## Prerequisites

- Node.js 18+ and npm
- Supabase account (free tier works)
- OpenAI API key

## Setup Instructions

### 1. Clone and Install

```bash
cd virtual-wine-cellar
npm install
```

### 2. Set Up Supabase

1. Create a new project at [supabase.com](https://supabase.com)
2. Go to SQL Editor and run the following SQL to create the database schema:

```sql
-- Create wines table
CREATE TABLE IF NOT EXISTS wines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  grape TEXT,
  grapes TEXT[],
  is_blend BOOLEAN,
  type TEXT,
  region TEXT,
  country TEXT,
  vintage INTEGER,
  score NUMERIC,
  label_image_url TEXT,
  notes TEXT,
  cellar_id UUID REFERENCES cellars(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create user_wines junction table (for quantity tracking)
CREATE TABLE IF NOT EXISTS user_wines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  wine_id UUID NOT NULL REFERENCES wines(id) ON DELETE CASCADE,
  quantity INTEGER DEFAULT 1,
  date_added TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, wine_id)
);

-- Create cellars table
CREATE TABLE IF NOT EXISTS cellars (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create cellar_members table
CREATE TABLE IF NOT EXISTS cellar_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cellar_id UUID NOT NULL REFERENCES cellars(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('owner', 'member')) DEFAULT 'member',
  added_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(cellar_id, user_id)
);

-- Enable Row Level Security
ALTER TABLE wines ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_wines ENABLE ROW LEVEL SECURITY;
ALTER TABLE cellars ENABLE ROW LEVEL SECURITY;
ALTER TABLE cellar_members ENABLE ROW LEVEL SECURITY;

-- See supabase/migrations/001_shared_cellars.sql for complete RLS policies

-- Create storage bucket for wine labels
INSERT INTO storage.buckets (id, name, public) 
VALUES ('wine-labels', 'wine-labels', true)
ON CONFLICT (id) DO NOTHING;

-- Create storage policy
CREATE POLICY "Users can upload wine labels"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'wine-labels' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Anyone can view wine labels"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'wine-labels');
```

> **Note**: Run `supabase/migrations/001_shared_cellars.sql` for complete schema including shared cellars feature and all RLS policies.

3. Go to Settings > API and copy your:
   - Project URL
   - Anon/public key
   - Service role key (keep this secret!)

### 3. Set Up Environment Variables

Create a `.env.local` file in the root directory:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

OPENAI_API_KEY=your_openai_api_key
```

### 4. Run the Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Project Structure

```
virtual-wine-cellar/
├── app/
│   ├── api/
│   │   ├── analyze/route.ts    # OpenAI Vision API for label recognition
│   │   ├── pair/route.ts        # GPT pairing suggestions
│   │   └── wines/route.ts       # Wine CRUD operations
│   ├── auth/
│   │   └── page.tsx              # Authentication page
│   ├── upload/
│   │   └── page.tsx              # Wine label upload page
│   ├── pairings/
│   │   └── page.tsx              # AI pairing assistant
│   ├── layout.tsx                # Root layout
│   ├── page.tsx                  # Dashboard/home page
│   └── globals.css               # Global styles
├── components/
│   ├── ui/                       # ShadCN UI components
│   ├── AuthProvider.tsx          # Auth context provider
│   ├── WineCard.tsx              # Wine display card
│   ├── UploadForm.tsx            # Wine upload form
│   └── PairingChat.tsx           # Pairing chat interface
└── lib/
    ├── supabaseClient.ts         # Supabase client
    ├── supabaseServer.ts         # Server-side Supabase helpers
    ├── openaiClient.ts           # OpenAI client
    └── utils.ts                  # Utility functions
```

## Usage

1. **Sign Up/In**: Create an account or sign in with your email
2. **Add Wines**: Go to "Add Wine" and upload a photo of a wine label
3. **View Collection**: See all your wines on the dashboard
4. **Get Pairings**: Visit the Pairings page and describe your meal to get AI suggestions

## Deployment

### Deploy to Vercel

1. Push your code to GitHub
2. Import your repository in Vercel
3. Add your environment variables in Vercel dashboard
4. Deploy!

The app will automatically build and deploy.

## Database Schema

- **users**: Managed by Supabase Auth
- **profiles**: User profile information (name, username, avatar)
- **cellars**: Wine cellars that can be shared
- **cellar_members**: Links users to cellars with roles (owner/member)
- **wines**: Stores wine information (linked to cellars)
- **user_wines**: Junction table for quantity tracking
- **cellar_invites**: Pending invitations for new users

> See [DATABASE_STRUCTURE.md](./DATABASE_STRUCTURE.md) for complete schema documentation.

## API Routes

### Wine Management
- `GET /api/wines?cellarId=<id>` - Fetch wines for a cellar
- `POST /api/wines` - Add a new wine (with cellarId in body)
- `PUT /api/wines?id=<id>` - Update wine details
- `DELETE /api/wines?id=<id>` - Remove a wine from collection

### Cellar Management
- `GET /api/cellars` - List user's cellars
- `POST /api/cellars` - Create new cellar
- `PUT /api/cellars?id=<id>` - Update cellar
- `DELETE /api/cellars?id=<id>` - Delete cellar

### Cellar Sharing
- `GET /api/cellars/members?cellarId=<id>` - List cellar members
- `DELETE /api/cellars/members?cellarId=<id>&userId=<id>` - Remove member
- `POST /api/cellars/invite` - Send invite
- `PUT /api/cellars/invite` - Accept invite

### AI Features
- `POST /api/analyze` - Analyze wine label image with OpenAI Vision
- `POST /api/pair` - Get wine pairing suggestions

## Future Enhancements

- Stripe integration for premium features
- Wine.com/Vivino API integration for richer metadata
- ~~Shared cellars~~ ✅ Implemented!
- Offline caching for PWA experience
- Activity log per cellar
- Push notifications for cellar changes
- Transfer cellar ownership

## License

MIT






