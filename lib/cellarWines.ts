/**
 * Cellar wine queries shared by API routes
 */

import type { createAuthenticatedClient } from "@/lib/supabaseServer";
import type { Wine } from "@/types";

type ServerSupabase = ReturnType<typeof createAuthenticatedClient>;

/**
 * Fetch all wines in a cellar, with quantities.
 *
 * Quantity lives in the cellar OWNER's user_wines rows (shared by all members),
 * so we read the owner's user_wines joined to wines and filter by cellar_id in JS.
 * PostgREST nested filters (wines.cellar_id) have proven unreliable here.
 *
 * Callers must verify the requesting user is a member of the cellar first.
 * Returns wines sorted by date added (newest first).
 */
export async function fetchCellarWines(
  supabase: ServerSupabase,
  cellarId: string,
  ownerId: string
): Promise<Wine[]> {
  const { data: userWines, error } = await supabase
    .from("user_wines")
    .select(`
      wine_id,
      quantity,
      date_added,
      wines (
        id,
        name,
        type,
        grape,
        grapes,
        is_blend,
        region,
        country,
        vintage,
        score,
        label_image_url,
        user_uploaded_label_url,
        notes,
        cellar_id,
        created_at
      )
    `)
    .eq("user_id", ownerId);

  if (error) throw error;

  return (
    userWines
      ?.filter((uw: any) => uw.wines && uw.wines.cellar_id === cellarId)
      .map((uw: any) => ({
        id: uw.wines.id,
        name: uw.wines.name,
        type: uw.wines.type,
        grape: uw.wines.grape,
        grapes: uw.wines.grapes ?? [],
        is_blend: uw.wines.is_blend ?? (uw.wines.grapes?.length > 1 || false),
        region: uw.wines.region,
        country: uw.wines.country,
        vintage: uw.wines.vintage,
        score: uw.wines.score ?? null,
        label_image_url: uw.wines.label_image_url,
        user_uploaded_label_url: uw.wines.user_uploaded_label_url,
        notes: uw.wines.notes,
        cellar_id: uw.wines.cellar_id,
        date_added: uw.date_added,
        // Use nullish coalescing (??) to preserve 0 as a valid quantity
        quantity: uw.quantity ?? 1,
      }))
      .sort(
        (a: Wine, b: Wine) =>
          new Date(b.date_added!).getTime() - new Date(a.date_added!).getTime()
      ) || []
  );
}
