/**
 * Security Utilities
 * Input validation, sanitization, and rate limiting helpers
 */

// Rate limiting store (in-memory for development, use Redis in production)
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

/**
 * Rate limiting configuration
 */
export interface RateLimitConfig {
  /** Maximum number of requests */
  maxRequests: number;
  /** Time window in milliseconds */
  windowMs: number;
}

/**
 * Default rate limit configurations for different endpoints
 */
export const RATE_LIMITS = {
  /** Standard API calls */
  standard: { maxRequests: 100, windowMs: 60 * 1000 }, // 100 per minute
  /** AI/OpenAI calls (more expensive) */
  ai: { maxRequests: 10, windowMs: 60 * 1000 }, // 10 per minute
  /** Authentication attempts */
  auth: { maxRequests: 5, windowMs: 15 * 60 * 1000 }, // 5 per 15 minutes
  /** File uploads */
  upload: { maxRequests: 20, windowMs: 60 * 1000 }, // 20 per minute
} as const;

/**
 * Check if a request is rate limited
 * @param identifier - Unique identifier (IP, user ID, etc.)
 * @param config - Rate limit configuration
 * @returns Object with allowed status and retry-after time
 */
export function checkRateLimit(
  identifier: string,
  config: RateLimitConfig
): { allowed: boolean; retryAfter?: number; remaining: number } {
  const now = Date.now();
  const record = rateLimitStore.get(identifier);

  // Clean up expired entries periodically
  if (Math.random() < 0.01) {
    cleanupRateLimitStore();
  }

  if (!record || now > record.resetTime) {
    // First request or window expired
    rateLimitStore.set(identifier, {
      count: 1,
      resetTime: now + config.windowMs,
    });
    return { allowed: true, remaining: config.maxRequests - 1 };
  }

  if (record.count >= config.maxRequests) {
    // Rate limited
    const retryAfter = Math.ceil((record.resetTime - now) / 1000);
    return { allowed: false, retryAfter, remaining: 0 };
  }

  // Increment counter
  record.count++;
  return { allowed: true, remaining: config.maxRequests - record.count };
}

/**
 * Clean up expired rate limit entries
 */
function cleanupRateLimitStore(): void {
  const now = Date.now();
  for (const [key, record] of rateLimitStore.entries()) {
    if (now > record.resetTime) {
      rateLimitStore.delete(key);
    }
  }
}

/**
 * Sanitize text input to prevent XSS attacks
 * Escapes HTML special characters and removes dangerous patterns
 */
export function sanitizeTextInput(input: string | null | undefined): string {
  if (!input) return "";

  return input
    // Remove null bytes
    .replace(/\0/g, "")
    // Escape HTML special characters
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;")
    .replace(/\//g, "&#x2F;")
    // Remove potential script injections
    .replace(/javascript:/gi, "")
    .replace(/data:/gi, "data-blocked:")
    .replace(/vbscript:/gi, "")
    // Remove event handlers
    .replace(/on\w+\s*=/gi, "blocked=")
    // Trim and normalize whitespace
    .trim();
}

/**
 * Sanitize object with string values
 */
export function sanitizeObject<T extends Record<string, unknown>>(
  obj: T,
  fieldsToSanitize: (keyof T)[]
): T {
  const result = { ...obj };
  for (const field of fieldsToSanitize) {
    if (typeof result[field] === "string") {
      (result[field] as unknown) = sanitizeTextInput(result[field] as string);
    }
  }
  return result;
}

/**
 * Validate and sanitize wine data input
 */
export function sanitizeWineData(data: Record<string, unknown>): Record<string, unknown> {
  const sanitized: Record<string, unknown> = {};

  // Sanitize string fields
  const stringFields = ["name", "type", "grape", "region", "country", "notes"];
  for (const field of stringFields) {
    if (data[field] !== undefined && data[field] !== null) {
      sanitized[field] = sanitizeTextInput(String(data[field]));
    }
  }

  // Sanitize grapes array
  if (Array.isArray(data.grapes)) {
    sanitized.grapes = data.grapes
      .filter((g): g is string => typeof g === "string")
      .map((g) => sanitizeTextInput(g))
      .filter((g) => g.length > 0);
  }

  // Validate numeric fields
  if (data.vintage !== undefined && data.vintage !== null) {
    const vintage = parseInt(String(data.vintage), 10);
    if (!isNaN(vintage) && vintage >= 1800 && vintage <= new Date().getFullYear() + 1) {
      sanitized.vintage = vintage;
    }
  }

  if (data.score !== undefined && data.score !== null) {
    const score = parseFloat(String(data.score));
    if (!isNaN(score) && score >= 0 && score <= 5) {
      sanitized.score = Math.round(score * 100) / 100; // 2 decimal places
    }
  }

  if (data.quantity !== undefined && data.quantity !== null) {
    const quantity = parseInt(String(data.quantity), 10);
    if (!isNaN(quantity) && quantity >= 0 && quantity <= 10000) {
      sanitized.quantity = quantity;
    }
  }

  // Boolean field
  if (typeof data.is_blend === "boolean") {
    sanitized.is_blend = data.is_blend;
  }

  return sanitized;
}

/**
 * Validate file upload (type and size)
 */
export interface FileValidationResult {
  valid: boolean;
  error?: string;
}

export function validateImageFile(
  file: File,
  maxSizeMB: number = 10
): FileValidationResult {
  // Allowed MIME types
  const allowedTypes = [
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/gif",
    "image/webp",
  ];

  // Check MIME type
  if (!allowedTypes.includes(file.type)) {
    return {
      valid: false,
      error: `Invalid file type: ${file.type}. Allowed types: JPEG, PNG, GIF, WebP`,
    };
  }

  // Check file extension
  const allowedExtensions = [".jpg", ".jpeg", ".png", ".gif", ".webp"];
  const extension = "." + (file.name.split(".").pop()?.toLowerCase() || "");
  if (!allowedExtensions.includes(extension)) {
    return {
      valid: false,
      error: `Invalid file extension: ${extension}`,
    };
  }

  // Check file size
  const maxBytes = maxSizeMB * 1024 * 1024;
  if (file.size > maxBytes) {
    return {
      valid: false,
      error: `File too large. Maximum size: ${maxSizeMB}MB`,
    };
  }

  return { valid: true };
}

/**
 * Generate a safe filename for uploads
 */
export function generateSafeFilename(userId: string, originalName: string): string {
  // Extract and validate extension
  const extension = originalName.split(".").pop()?.toLowerCase() || "jpg";
  const safeExtension = ["jpg", "jpeg", "png", "gif", "webp"].includes(extension)
    ? extension
    : "jpg";

  // Generate unique filename with timestamp and random suffix
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);

  return `${userId}/${timestamp}-${random}.${safeExtension}`;
}

/**
 * Validate UUID format
 */
export function isValidUUID(uuid: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}

/**
 * Sanitize error message for client response
 * Removes sensitive information and stack traces
 */
export function sanitizeErrorMessage(error: unknown): string {
  // Default generic message
  const genericMessage = "An unexpected error occurred";

  if (!error) return genericMessage;

  // If it's an Error object
  if (error instanceof Error) {
    const message = error.message.toLowerCase();

    // Check for sensitive information patterns
    const sensitivePatterns = [
      /api[_-]?key/i,
      /password/i,
      /secret/i,
      /token/i,
      /credential/i,
      /auth/i,
      /database/i,
      /connection/i,
      /postgres/i,
      /supabase/i,
      /openai/i,
      /internal server/i,
    ];

    for (const pattern of sensitivePatterns) {
      if (pattern.test(message)) {
        return genericMessage;
      }
    }

    // Return the message if it seems safe (no stack trace, limited length)
    if (!error.stack && error.message.length < 200) {
      return error.message;
    }
  }

  // For string errors
  if (typeof error === "string" && error.length < 200) {
    return error;
  }

  return genericMessage;
}

/**
 * Extract client IP from request for rate limiting
 */
export function getClientIdentifier(request: Request): string {
  // Try to get the real IP from common headers
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    // Take the first IP in the chain
    return forwardedFor.split(",")[0].trim();
  }

  const realIp = request.headers.get("x-real-ip");
  if (realIp) {
    return realIp;
  }

  // Fallback to a hash of user agent + some headers
  const userAgent = request.headers.get("user-agent") || "";
  const acceptLanguage = request.headers.get("accept-language") || "";
  return `anonymous-${hashString(userAgent + acceptLanguage)}`;
}

/**
 * Simple string hash for anonymous identification
 */
function hashString(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36);
}

/**
 * Validate that required environment variables are set
 */
export function validateEnvVars(required: string[]): { valid: boolean; missing: string[] } {
  const missing = required.filter((key) => !process.env[key]);
  return {
    valid: missing.length === 0,
    missing,
  };
}

