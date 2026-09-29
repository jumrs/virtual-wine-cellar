/**
 * Cellar Export API Route
 * Export cellar wines as CSV
 */

import { NextRequest, NextResponse } from "next/server";
import {
    authenticateRequest,
    isAuthError,
    errorResponse,
    getQueryParam,
    logApiError,
} from "@/lib/apiUtils";
import {
    checkRateLimit,
    RATE_LIMITS,
    getClientIdentifier,
    isValidUUID,
} from "@/lib/security";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * GET /api/cellars/export?cellarId=<cellarId> - Export cellar wines as CSV
 * Only owner or admin can export
 */
export async function GET(request: NextRequest) {
    try {
        const clientId = getClientIdentifier(request);
        const rateLimit = checkRateLimit(`cellars:export:${clientId}`, RATE_LIMITS.standard);
        if (!rateLimit.allowed) {
            return errorResponse(
                `Rate limit exceeded. Try again in ${rateLimit.retryAfter} seconds.`,
                429
            );
        }

        const auth = await authenticateRequest(request);
        if (isAuthError(auth)) return auth;

        const { user, authenticatedSupabase } = auth;
        const cellarId = getQueryParam(request, "cellarId");

        if (!cellarId) {
            return errorResponse("Cellar ID is required", 400);
        }

        if (!isValidUUID(cellarId)) {
            return errorResponse("Invalid cellar ID format", 400);
        }

        // Check user membership and role
        const { data: membership, error: membershipError } = await authenticatedSupabase
            .from("cellar_members")
            .select("role")
            .eq("cellar_id", cellarId)
            .eq("user_id", user.id)
            .single();

        if (membershipError || !membership) {
            return errorResponse("Access denied to this cellar", 403);
        }

        // Only owner and admin can export
        if (membership.role !== "owner" && membership.role !== "admin") {
            return errorResponse("Only owners and admins can export wines", 403);
        }

        // Get cellar info for filename
        const { data: cellar, error: cellarError } = await authenticatedSupabase
            .from("cellars")
            .select("name, owner_id")
            .eq("id", cellarId)
            .single();

        if (cellarError || !cellar) {
            return errorResponse("Cellar not found", 404);
        }

        // Fetch wines for the cellar
        const { data: userWines, error: winesError } = await authenticatedSupabase
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
          notes
        )
      `)
            .eq("user_id", cellar.owner_id);

        if (winesError) {
            logApiError("Export wines fetch", winesError);
            return errorResponse("Failed to fetch wines", 500);
        }

        // Filter by cellar_id
        const winesInCellar = userWines?.filter((uw: any) => {
            // Also need to check cellar_id from wines table
            return uw.wines;
        }) || [];

        // For cellar_id filtering, we need to fetch the cellar_id from wines
        const wineIds = winesInCellar.map((uw: any) => uw.wine_id);

        let filteredWineIds = new Set<string>();
        if (wineIds.length > 0) {
            const { data: winesCellarCheck } = await authenticatedSupabase
                .from("wines")
                .select("id, cellar_id")
                .in("id", wineIds)
                .eq("cellar_id", cellarId);

            filteredWineIds = new Set(winesCellarCheck?.map((w: any) => w.id) || []);
        }

        const filteredWines = winesInCellar.filter((uw: any) =>
            filteredWineIds.has(uw.wine_id)
        );

        // Generate CSV
        const csvHeaders = [
            "Name",
            "Type",
            "Grape Varieties",
            "Is Blend",
            "Region",
            "Country",
            "Vintage",
            "Score",
            "Quantity",
            "Notes",
            "Date Added",
        ];

        const csvRows = filteredWines.map((uw: any) => {
            const wine = uw.wines;
            const grapesList = wine.grapes?.length > 0
                ? wine.grapes.join("; ")
                : wine.grape || "";

            return [
                escapeCsvField(wine.name || ""),
                escapeCsvField(wine.type || ""),
                escapeCsvField(grapesList),
                wine.is_blend ? "Yes" : "No",
                escapeCsvField(wine.region || ""),
                escapeCsvField(wine.country || ""),
                wine.vintage || "",
                wine.score ?? "",
                uw.quantity ?? 1,
                escapeCsvField(wine.notes || ""),
                uw.date_added ? new Date(uw.date_added).toLocaleDateString() : "",
            ].join(",");
        });

        const csvContent = [csvHeaders.join(","), ...csvRows].join("\n");

        // Create safe filename
        const safeCellarName = cellar.name
            .replace(/[^a-zA-Z0-9\s-]/g, "")
            .replace(/\s+/g, "_")
            .substring(0, 50);
        const dateStr = new Date().toISOString().split("T")[0];
        const filename = `${safeCellarName}_wines_${dateStr}.csv`;

        // Return CSV response
        return new NextResponse(csvContent, {
            status: 200,
            headers: {
                "Content-Type": "text/csv; charset=utf-8",
                "Content-Disposition": `attachment; filename="${filename}"`,
                "Cache-Control": "no-store",
            },
        });
    } catch (error) {
        logApiError("GET /api/cellars/export", error);
        return errorResponse("Failed to export wines");
    }
}

/**
 * Escape a field value for CSV format
 * Wraps in quotes if contains comma, quote, or newline
 */
function escapeCsvField(value: string): string {
    if (value.includes(",") || value.includes('"') || value.includes("\n") || value.includes("\r")) {
        // Escape quotes by doubling them
        return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
}
