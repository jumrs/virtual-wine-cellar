/**
 * Wine Types and Interfaces
 * Centralized type definitions for the wine cellar application
 */

/** Base wine data from the database */
export interface Wine {
  id: string;
  name: string;
  type?: string;
  region?: string;
  country?: string;
  /** @deprecated Use grapes array instead */
  grape?: string;
  /** Array of grape varieties */
  grapes?: string[];
  /** True when grapes.length > 1 */
  is_blend?: boolean;
  vintage?: number;
  score?: number | null;
  label_image_url?: string;
  notes?: string;
  date_added?: string;
  quantity?: number;
  /** The cellar this wine belongs to */
  cellar_id?: string;
}

// ============================================
// CELLAR TYPES
// ============================================

/** Wine cellar that can be shared among users */
export interface Cellar {
  id: string;
  name: string;
  owner_id: string;
  created_at: string;
  updated_at?: string;
  /** Number of members (computed) */
  member_count?: number;
  /** Whether the cellar is shared with others */
  is_shared?: boolean;
}

/** Membership role in a cellar */
export type CellarRole = "owner" | "admin" | "member";

/** A user's membership in a cellar */
export interface CellarMember {
  id: string;
  cellar_id: string;
  user_id: string;
  role: CellarRole;
  added_at: string;
  /** Populated from profiles join */
  user?: {
    id: string;
    email?: string;
    name?: string;
    username?: string;
    avatar_url?: string;
  };
}

/** Cellar with members populated */
export interface CellarWithMembers extends Cellar {
  members: CellarMember[];
}

/** Pending invite to join a cellar */
export interface CellarInvite {
  id: string;
  cellar_id: string;
  email: string;
  invited_by: string;
  token: string;
  expires_at: string;
  created_at: string;
}

/** Context state for cellar management */
export interface CellarContextState {
  /** All cellars the user has access to */
  cellars: Cellar[];
  /** Currently active cellar */
  activeCellar: Cellar | null;
  /** User's role in the active cellar */
  userRole: CellarRole | null;
  /** ID of the main cellar (displays on login) */
  mainCellarId: string | null;
  /** Whether user can edit (owner or admin) */
  canEdit: boolean;
  /** Whether user can delete wines (owner only) */
  canDelete: boolean;
  /** Loading state */
  loading: boolean;
  /** Error message */
  error: string | null;
  /** Switch to a different cellar */
  setActiveCellar: (cellar: Cellar) => void;
  /** Refresh cellars from server */
  refreshCellars: () => Promise<void>;
  /** Create a new cellar */
  createCellar: (name: string) => Promise<Cellar | null>;
  /** Delete a cellar (owner only) */
  deleteCellar: (cellarId: string) => Promise<boolean>;
  /** Rename a cellar (owner only) */
  renameCellar: (cellarId: string, newName: string) => Promise<boolean>;
  /** Invite user to cellar */
  inviteUser: (cellarId: string, email: string) => Promise<boolean>;
  /** Remove member from cellar */
  removeMember: (cellarId: string, userId: string) => Promise<boolean>;
  /** Leave a cellar (for non-owners) */
  leaveCellar: (cellarId: string) => Promise<boolean>;
  /** Set the main cellar (the one that displays on login) */
  setMainCellar: (cellarId: string | null) => Promise<boolean>;
}

/** Wine with file for upload form */
export interface WineWithFile {
  file: File;
  preview: string;
  extractedData: ExtractedWineData | null;
  quantity: number;
  analyzing: boolean;
  saving: boolean;
  saved: boolean;
  error?: string;
}

/** Data extracted from wine label analysis */
export interface ExtractedWineData {
  name: string;
  type?: string;
  /** @deprecated Use grapes array instead */
  grape?: string;
  grapes?: string[];
  is_blend?: boolean;
  region?: string;
  country?: string;
  vintage?: number;
  notes?: string;
}

/** User profile data */
export interface UserProfile {
  id: string;
  email: string;
  username: string | null;
  name: string | null;
  avatar_url: string | null;
  main_cellar_id?: string | null;
}

/** Pairing chat message */
export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

/** Filter state for wine list */
export interface WineFilters {
  searchQuery: string;
  selectedCountry: string;
  selectedGrape: string;
  selectedType: string;
  selectedVintage: string;
  scoreSort: string;
}

/** Sort options for wine list */
export type SortOption = "default" | "last-added" | "high-to-low" | "low-to-high";

/** Wine type badge variants */
export type WineTypeBadge =
  | "red"
  | "white"
  | "rose"
  | "sparkling"
  | "dessert"
  | "fortified"
  | "orange"
  | "default";

