# Database Structure

This document describes the database schema for the Virtual Wine Cellar application, including the shared cellar feature.

## Tables Overview

### Core Tables

| Table | Purpose |
|-------|---------|
| `wines` | Wine data (name, type, region, etc.) |
| `user_wines` | Links users to wines (legacy, for backward compatibility) |
| `cellars` | Wine cellars that can be shared |
| `cellar_members` | Links users to cellars with roles |
| `cellar_invites` | Pending invitations for new users |
| `profiles` | User profile information |

---

## Table Schemas

### `wines`

Stores wine information.

```sql
CREATE TABLE wines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  type TEXT,                    -- Red, White, Rosé, Sparkling, etc.
  grape TEXT,                   -- Legacy: comma-separated grape varieties
  grapes TEXT[],               -- Array of grape varieties
  is_blend BOOLEAN,            -- True if wine is a blend
  region TEXT,
  country TEXT,
  vintage INTEGER,
  score NUMERIC,               -- Wine rating (0-100 or 0-5)
  label_image_url TEXT,        -- URL to wine label image
  notes TEXT,                  -- Tasting notes
  cellar_id UUID REFERENCES cellars(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_wines_cellar_id ON wines(cellar_id);
```

### `user_wines`

Junction table linking users to wines. Retained for backward compatibility and quantity tracking.

```sql
CREATE TABLE user_wines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  wine_id UUID NOT NULL REFERENCES wines(id) ON DELETE CASCADE,
  quantity INTEGER DEFAULT 1,
  date_added TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, wine_id)
);
```

### `cellars`

Represents wine cellars that can be owned and shared.

```sql
CREATE TABLE cellars (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_cellars_owner_id ON cellars(owner_id);
```

### `cellar_members`

Junction table managing cellar membership and roles.

```sql
CREATE TABLE cellar_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cellar_id UUID NOT NULL REFERENCES cellars(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('owner', 'member')) DEFAULT 'member',
  added_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(cellar_id, user_id)
);

-- Indexes
CREATE INDEX idx_cellar_members_cellar_id ON cellar_members(cellar_id);
CREATE INDEX idx_cellar_members_user_id ON cellar_members(user_id);
```

### `cellar_invites`

Stores pending invitations for users who don't have accounts yet.

```sql
CREATE TABLE cellar_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cellar_id UUID NOT NULL REFERENCES cellars(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  invited_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(cellar_id, email)
);

-- Indexes
CREATE INDEX idx_cellar_invites_email ON cellar_invites(email);
CREATE INDEX idx_cellar_invites_token ON cellar_invites(token);
```

### `profiles`

User profile information.

```sql
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  username TEXT UNIQUE,
  name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

---

## Entity Relationships

```
┌─────────────┐     ┌──────────────────┐     ┌─────────────┐
│  auth.users │────<│  cellar_members  │>────│   cellars   │
└─────────────┘     └──────────────────┘     └─────────────┘
       │                                            │
       │            ┌──────────────────┐           │
       └───────────<│    user_wines    │           │
                    └──────────────────┘           │
                            │                      │
                            v                      v
                    ┌──────────────────────────────┐
                    │           wines              │
                    └──────────────────────────────┘

Legend:
  ───< One-to-Many
  >─── Many-to-One
```

---

## Row Level Security (RLS) Policies

### Cellars

```sql
-- Users can view cellars they are members of
CREATE POLICY "Users can view their cellars"
  ON cellars FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM cellar_members
      WHERE cellar_members.cellar_id = cellars.id
      AND cellar_members.user_id = auth.uid()
    )
  );

-- Users can create cellars (they become owner)
CREATE POLICY "Users can create cellars"
  ON cellars FOR INSERT
  WITH CHECK (auth.uid() = owner_id);

-- Only owners can update/delete cellars
CREATE POLICY "Owners can update their cellars"
  ON cellars FOR UPDATE
  USING (auth.uid() = owner_id);

CREATE POLICY "Owners can delete their cellars"
  ON cellars FOR DELETE
  USING (auth.uid() = owner_id);
```

### Wines

```sql
-- Users can view wines in cellars they belong to
CREATE POLICY "Users can view wines in their cellars"
  ON wines FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM cellar_members
      WHERE cellar_members.cellar_id = wines.cellar_id
      AND cellar_members.user_id = auth.uid()
    )
    OR
    -- Backward compatibility with user_wines
    EXISTS (
      SELECT 1 FROM user_wines
      WHERE user_wines.wine_id = wines.id
      AND user_wines.user_id = auth.uid()
    )
  );

-- Users can insert wines to cellars they belong to
CREATE POLICY "Users can insert wines to their cellars"
  ON wines FOR INSERT
  WITH CHECK (
    cellar_id IS NULL
    OR EXISTS (
      SELECT 1 FROM cellar_members
      WHERE cellar_members.cellar_id = wines.cellar_id
      AND cellar_members.user_id = auth.uid()
    )
  );
```

---

## Membership Roles

| Role | Permissions |
|------|-------------|
| `owner` | Full access: view, add, edit, delete wines; manage members; rename/delete cellar |
| `member` | View, add, edit, delete wines in the cellar |

---

## Data Migration

When upgrading from user-based to cellar-based storage:

1. Run the migration script: `supabase/migrations/001_shared_cellars.sql`
2. Execute the migration function to create default cellars for existing users:
   ```sql
   SELECT migrate_user_wines_to_cellars();
   ```

This will:
- Create a default cellar for each user who has wines
- Name it "{User's Name}'s Cellar"
- Add the user as owner
- Link existing wines to the new cellar via `cellar_id`

---

## Real-time Subscriptions

The app uses Supabase real-time subscriptions for live updates:

```typescript
supabase
  .channel(`cellar:${cellarId}`)
  .on('postgres_changes', { 
    event: '*', 
    schema: 'public', 
    table: 'wines', 
    filter: `cellar_id=eq.${cellarId}` 
  }, handleUpdate)
  .subscribe();
```

This enables all members of a shared cellar to see changes (additions, edits, deletions) in real-time.

---

## API Endpoints

### Cellars API

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/cellars` | List user's cellars |
| POST | `/api/cellars` | Create new cellar |
| PUT | `/api/cellars?id=<id>` | Update cellar |
| DELETE | `/api/cellars?id=<id>` | Delete cellar |

### Members API

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/cellars/members?cellarId=<id>` | List cellar members |
| DELETE | `/api/cellars/members?cellarId=<id>&userId=<id>` | Remove member |

### Invite API

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/cellars/invite` | Create invite |
| GET | `/api/cellars/invite?token=<token>` | Get invite details |
| PUT | `/api/cellars/invite` | Accept invite |
| DELETE | `/api/cellars/invite?id=<id>` | Cancel invite |

### Wines API (Updated)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/wines?cellarId=<id>` | List wines in cellar |
| POST | `/api/wines` | Add wine (with `cellarId` in body) |
| PUT | `/api/wines?id=<id>` | Update wine |
| DELETE | `/api/wines?id=<id>` | Delete wine |

---

## Security Considerations

1. **Row Level Security (RLS)** is enabled on all tables
2. **Cellar access** is verified before any wine operations
3. **Owner-only operations** are enforced for:
   - Renaming cellars
   - Deleting cellars
   - Removing members
   - Creating/canceling invites
4. **Invite tokens** are:
   - Cryptographically random (32 bytes hex)
   - Time-limited (7 days)
   - Single-use (deleted after acceptance)
   - Email-bound (only the invited email can accept)

---

## Future Enhancements

- Transfer cellar ownership
- Granular member permissions (view-only, edit-only)
- Activity log per cellar
- Member avatars next to wine entries
- Push notifications for changes

