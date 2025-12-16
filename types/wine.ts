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

