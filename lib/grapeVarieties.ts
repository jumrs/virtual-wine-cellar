// Common grape varieties for wine selection
// Organized by color category for better UX

export const RED_GRAPES = [
  "Cabernet Sauvignon",
  "Merlot",
  "Pinot Noir",
  "Syrah",
  "Shiraz",
  "Malbec",
  "Grenache",
  "Tempranillo",
  "Sangiovese",
  "Nebbiolo",
  "Zinfandel",
  "Petit Verdot",
  "Cabernet Franc",
  "Carménère",
  "Mourvèdre",
  "Barbera",
  "Primitivo",
  "Petite Sirah",
  "Gamay",
  "Nero d'Avola",
  "Montepulciano",
  "Aglianico",
  "Touriga Nacional",
  "Pinotage",
  "Corvina",
  "Dolcetto",
  "Carignan",
  "Cinsault",
  "Tannat",
  "Blaufränkisch",
];

export const WHITE_GRAPES = [
  "Chardonnay",
  "Sauvignon Blanc",
  "Pinot Grigio",
  "Pinot Gris",
  "Riesling",
  "Gewürztraminer",
  "Viognier",
  "Chenin Blanc",
  "Sémillon",
  "Muscat",
  "Moscato",
  "Albariño",
  "Grüner Veltliner",
  "Verdejo",
  "Vermentino",
  "Torrontés",
  "Marsanne",
  "Roussanne",
  "Trebbiano",
  "Garganega",
  "Cortese",
  "Fiano",
  "Greco",
  "Assyrtiko",
  "Furmint",
  "Melon de Bourgogne",
  "Müller-Thurgau",
  "Silvaner",
  "Friulano",
  "Godello",
];

export const ROSE_GRAPES = [
  "Grenache",
  "Cinsault",
  "Mourvèdre",
  "Syrah",
  "Pinot Noir",
  "Sangiovese",
  "Tempranillo",
];

export const SPARKLING_GRAPES = [
  "Chardonnay",
  "Pinot Noir",
  "Pinot Meunier",
  "Glera",
  "Macabeo",
  "Parellada",
  "Xarel·lo",
];

// All grapes combined and deduplicated, sorted alphabetically
export const ALL_GRAPES = Array.from(
  new Set([
    ...RED_GRAPES,
    ...WHITE_GRAPES,
    ...ROSE_GRAPES,
    ...SPARKLING_GRAPES,
  ])
).sort((a, b) => a.localeCompare(b));

// Grape categories for organizing the dropdown
export const GRAPE_CATEGORIES = {
  red: { label: "Red Grapes", grapes: RED_GRAPES.sort() },
  white: { label: "White Grapes", grapes: WHITE_GRAPES.sort() },
  rose: { label: "Rosé Grapes", grapes: ROSE_GRAPES.sort() },
  sparkling: { label: "Sparkling Grapes", grapes: SPARKLING_GRAPES.sort() },
};

// Helper function to parse grape string into array
export function parseGrapeString(grapeString: string): string[] {
  if (!grapeString) return [];
  
  // Split by common delimiters: /, ,, +, and
  const grapes = grapeString
    .split(/[\/,+]|\s+and\s+/i)
    .map((g) => g.trim())
    .filter((g) => g.length > 0);
  
  return grapes;
}

// Helper function to determine if a wine is a blend based on grapes array
export function isBlend(grapes: string[] | null | undefined): boolean {
  return Array.isArray(grapes) && grapes.length > 1;
}

// Helper function to format grapes for display
export function formatGrapes(grapes: string[] | null | undefined): string {
  if (!grapes || grapes.length === 0) return "";
  if (grapes.length === 1) return grapes[0];
  return grapes.join(", ");
}

