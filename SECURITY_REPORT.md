# Security Audit Report - Virtual Wine Cellar

**Audit Date:** December 16, 2025  
**Application:** Virtual Wine Cellar  
**Framework:** Next.js 15 with Supabase Backend  
**Auditor:** Security Hardening Process

---

## Executive Summary

A comprehensive security audit was performed on the Virtual Wine Cellar application. Several vulnerabilities were identified and fixed to ensure compliance with modern web security best practices and OWASP Top 10 guidelines.

### Risk Summary

| Severity | Found | Fixed |
|----------|-------|-------|
| 🔴 Critical | 2 | 2 |
| 🟠 High | 4 | 4 |
| 🟡 Medium | 5 | 5 |
| 🟢 Low | 4 | 4 |

---

## Vulnerabilities Found and Fixed

### 🔴 Critical Issues

#### 1. Unauthenticated AI API Endpoints
**File:** `app/api/analyze/route.ts`, `app/api/wines/fetch-score/route.ts`  
**Severity:** Critical  
**Status:** ✅ Fixed

**Issue:** The `/api/analyze` and `/api/wines/fetch-score` endpoints had no authentication checks, allowing anyone to make requests to OpenAI through these endpoints, potentially causing:
- Unauthorized API usage and costs
- Abuse of AI services
- Resource exhaustion

**Fix Applied:**
- Added authentication checks using Supabase auth
- Implemented rate limiting (10 requests/minute for AI endpoints)
- Added Authorization header requirement

```typescript
// Authentication check added to all AI endpoints
const authHeader = request.headers.get("authorization");
const accessToken = authHeader?.replace("Bearer ", "");
if (!accessToken) {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}
```

#### 2. Access Token in Request Body
**File:** `app/api/pair/route.ts`, `components/PairingChat.tsx`  
**Severity:** Critical  
**Status:** ✅ Fixed

**Issue:** The pairing API was receiving the access token in the request body instead of the Authorization header, which:
- Exposes tokens in server logs
- Violates OAuth best practices
- Increases risk of token leakage

**Fix Applied:**
- Moved access token to Authorization header
- Updated client component to send token correctly

---

### 🟠 High Severity Issues

#### 3. Missing Rate Limiting
**Files:** All API routes  
**Severity:** High  
**Status:** ✅ Fixed

**Issue:** No rate limiting on any API endpoints allowed potential:
- Brute force attacks
- API abuse
- Resource exhaustion
- Cost overruns for AI services

**Fix Applied:**
- Created `lib/security.ts` with rate limiting utilities
- Applied rate limits to all API routes:
  - Standard endpoints: 100 requests/minute
  - AI endpoints: 10 requests/minute
  - Upload endpoints: 20 requests/minute

```typescript
export const RATE_LIMITS = {
  standard: { maxRequests: 100, windowMs: 60 * 1000 },
  ai: { maxRequests: 10, windowMs: 60 * 1000 },
  upload: { maxRequests: 20, windowMs: 60 * 1000 },
};
```

#### 4. Missing Input Sanitization
**Files:** All API routes handling user input  
**Severity:** High  
**Status:** ✅ Fixed

**Issue:** User inputs (wine names, notes, search queries) were not sanitized, allowing potential:
- Cross-Site Scripting (XSS) attacks
- Script injection in stored data
- Malicious HTML in user-generated content

**Fix Applied:**
- Created comprehensive sanitization utilities in `lib/security.ts`
- Applied sanitization to all user inputs:
  - HTML entity escaping
  - Script tag removal
  - Event handler blocking
  - Protocol sanitization (javascript:, data:, etc.)

```typescript
export function sanitizeTextInput(input: string | null | undefined): string {
  if (!input) return "";
  return input
    .replace(/\0/g, "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;")
    .replace(/\//g, "&#x2F;")
    .replace(/javascript:/gi, "")
    .replace(/on\w+\s*=/gi, "blocked=")
    .trim();
}
```

#### 5. Missing Security Headers
**File:** `next.config.mjs`  
**Severity:** High  
**Status:** ✅ Fixed

**Issue:** The application was missing essential HTTP security headers.

**Fix Applied:**
Added comprehensive security headers:
- Content-Security-Policy (CSP)
- X-Frame-Options: DENY
- X-Content-Type-Options: nosniff
- Referrer-Policy: strict-origin-when-cross-origin
- X-XSS-Protection
- Permissions-Policy
- Strict-Transport-Security (production only)

#### 6. Sensitive Error Messages
**Files:** All API routes  
**Severity:** High  
**Status:** ✅ Fixed

**Issue:** Raw error messages were exposed to clients, potentially revealing:
- Database structure
- API keys in error messages
- Internal system paths
- Stack traces

**Fix Applied:**
- Created `sanitizeErrorMessage()` utility
- Filters out sensitive patterns (API keys, database info, etc.)
- Returns generic messages in production
- Detailed logging only in development

---

### 🟡 Medium Severity Issues

#### 7. Missing File Upload Validation
**Files:** `app/api/wines/image/route.ts`, `app/api/profile/avatar/route.ts`  
**Severity:** Medium  
**Status:** ✅ Fixed

**Issue:** File uploads lacked comprehensive validation for:
- MIME type verification
- File extension validation
- File size limits

**Fix Applied:**
- Created `validateImageFile()` utility
- Validates MIME type against whitelist
- Checks file extension
- Enforces size limits (5MB for avatars, 10MB for wine labels)

#### 8. Missing UUID Validation
**Files:** Wine API routes  
**Severity:** Medium  
**Status:** ✅ Fixed

**Issue:** Wine IDs from URL parameters were not validated for format.

**Fix Applied:**
- Created `isValidUUID()` utility
- Added validation before database queries
- Returns 400 error for invalid formats

#### 9. Inconsistent Console Logging
**Files:** All API routes  
**Severity:** Medium  
**Status:** ✅ Fixed

**Issue:** Console.error statements in production could expose debug information.

**Fix Applied:**
- Wrapped console statements with environment checks
- Only log in development mode

#### 10. Missing DELETE Policy on Wines Table
**File:** `supabase-schema.sql`  
**Severity:** Medium  
**Status:** ✅ Fixed

**Issue:** The wines table was missing a DELETE RLS policy.

**Fix Applied:**
```sql
CREATE POLICY "Users can delete wines they own"
  ON wines FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM user_wines
      WHERE user_wines.wine_id = wines.id
      AND user_wines.user_id = auth.uid()
    )
  );
```

#### 11. Broad Data Selection
**File:** `app/api/profile/route.ts`  
**Severity:** Medium  
**Status:** ✅ Fixed

**Issue:** Profile query used `SELECT *` instead of specifying needed fields.

**Fix Applied:**
```typescript
// Before
.select("*")

// After
.select("username, name, avatar_url")
```

---

### 🟢 Low Severity Issues

#### 12. Missing Username Format Validation
**File:** `app/api/profile/route.ts`  
**Severity:** Low  
**Status:** ✅ Fixed

**Issue:** Username validation only checked length, not format.

**Fix Applied:**
- Added alphanumeric validation
- Only allows letters, numbers, and underscores

#### 13. Unsafe Filename Generation
**Files:** Upload handlers  
**Severity:** Low  
**Status:** ✅ Fixed

**Issue:** File names were generated using user-provided extensions directly.

**Fix Applied:**
- Created `generateSafeFilename()` utility
- Validates extensions against whitelist
- Uses timestamp + random suffix for uniqueness

#### 14. Missing Query Length Limits
**File:** `app/api/wines/search-image/route.ts`  
**Severity:** Low  
**Status:** ✅ Fixed

**Issue:** Search queries had no length limits.

**Fix Applied:**
- Minimum query length: 2 characters
- Maximum query length: 100 characters

#### 15. Source Maps in Production
**File:** `next.config.mjs`  
**Severity:** Low  
**Status:** ✅ Fixed

**Issue:** Source maps could expose source code in production.

**Fix Applied:**
```javascript
productionBrowserSourceMaps: false
```

---

## Security Utilities Created

A new security module was created at `lib/security.ts` containing:

1. **Rate Limiting**
   - In-memory rate limit store
   - Configurable limits per endpoint type
   - Client identification via IP/headers

2. **Input Sanitization**
   - `sanitizeTextInput()` - XSS prevention
   - `sanitizeObject()` - Bulk field sanitization
   - `sanitizeWineData()` - Wine-specific validation

3. **File Validation**
   - `validateImageFile()` - Type and size checking
   - `generateSafeFilename()` - Safe filename generation

4. **UUID Validation**
   - `isValidUUID()` - Format verification

5. **Error Handling**
   - `sanitizeErrorMessage()` - Safe error responses
   - `getClientIdentifier()` - IP extraction for rate limiting

---

## Security Headers Configuration

Added to `next.config.mjs`:

```javascript
async headers() {
  return [{
    source: "/(.*)",
    headers: [
      { key: "Content-Security-Policy", value: "..." },
      { key: "X-Frame-Options", value: "DENY" },
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "X-XSS-Protection", value: "1; mode=block" },
      { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=()" },
      { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" }, // production only
    ],
  }];
}
```

---

## Verified Protections

### ✅ Database Security (Supabase)
- [x] All Supabase queries use parameterized queries (via SDK)
- [x] No raw SQL string concatenation
- [x] Row Level Security (RLS) enabled on all tables
- [x] Policies verify user ownership before data access
- [x] Service Role Key only used server-side
- [x] Added missing DELETE policy for wines table

### ✅ Authentication & Authorization
- [x] JWT tokens validated on all protected endpoints
- [x] Access tokens passed via Authorization header
- [x] Session handling via Supabase Auth
- [x] Protected routes use authentication middleware

### ✅ OpenAI API Security
- [x] API key stored server-side only
- [x] All AI calls proxied through API routes
- [x] Rate limiting prevents abuse (10 req/min)
- [x] Input sanitization before AI prompts
- [x] No sensitive prompts exposed in errors

### ✅ Input Validation
- [x] All user inputs sanitized for XSS
- [x] HTML entities escaped
- [x] Script tags and event handlers blocked
- [x] UUID format validation
- [x] Numeric range validation

### ✅ API Security
- [x] Rate limiting on all endpoints
- [x] Authentication required
- [x] Proper HTTP methods used
- [x] Sanitized error messages
- [x] No stack traces in production

### ✅ File Upload Security
- [x] MIME type validation
- [x] File extension validation
- [x] File size limits enforced
- [x] Safe filename generation
- [x] User-scoped storage paths

---

## Pending Improvements (Recommendations)

### High Priority
1. **Production Rate Limiting**: Consider using Redis for rate limiting in production instead of in-memory store for better scalability
2. **CSRF Protection**: Consider adding CSRF tokens for sensitive form submissions
3. **Audit Logging**: Implement comprehensive audit logging for security events

### Medium Priority
4. **Password Strength**: Consider enforcing stronger password requirements
5. **Account Lockout**: Add account lockout after failed login attempts
6. **API Key Rotation**: Document process for rotating API keys

### Low Priority
7. **Security Testing**: Set up automated security testing (SAST/DAST)
8. **Dependency Scanning**: Run `npm audit` regularly
9. **Penetration Testing**: Consider professional security assessment

---

## Environment Variables Checklist

### Required Variables (Keep Secret)
- `SUPABASE_SERVICE_ROLE_KEY` - Server-side only
- `OPENAI_API_KEY` - Server-side only

### Public Variables (Safe for Client)
- `NEXT_PUBLIC_SUPABASE_URL` - Can be exposed
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Can be exposed (has RLS)

### Optional Variables
- `PEXELS_API_KEY` - For image search
- `UNSPLASH_ACCESS_KEY` - Alternative image search

### Production Settings
- `NODE_ENV=production` - Disables debug logging
- Disable source maps (configured in next.config.mjs)

---

## OWASP Top 10 Compliance

| Category | Status | Notes |
|----------|--------|-------|
| A01: Broken Access Control | ✅ Protected | RLS + Auth checks |
| A02: Cryptographic Failures | ✅ Protected | HTTPS + Supabase encryption |
| A03: Injection | ✅ Protected | Parameterized queries + sanitization |
| A04: Insecure Design | ✅ Protected | Security-first approach |
| A05: Security Misconfiguration | ✅ Protected | Secure headers + CSP |
| A06: Vulnerable Components | ⚠️ Monitor | Run npm audit regularly |
| A07: Auth Failures | ✅ Protected | Supabase Auth |
| A08: Software Integrity | ✅ Protected | CSP prevents inline scripts |
| A09: Logging Failures | ⚠️ Partial | Development logging only |
| A10: SSRF | ✅ Protected | Validated external URLs |

---

## Recommended Security Commands

```bash
# Check for vulnerable dependencies
npm audit

# Fix vulnerabilities (when safe)
npm audit fix

# Deep security scan
npx snyk test

# Check for secrets in code
npx secretlint "**/*"
```

---

## Conclusion

The Virtual Wine Cellar application has been hardened against common web security vulnerabilities. All critical and high-severity issues have been addressed. The application now includes:

- Comprehensive authentication on all protected endpoints
- Rate limiting to prevent abuse
- Input sanitization to prevent XSS
- Secure error handling
- Security headers for defense in depth
- Validated file uploads
- Row Level Security on database

The application should now pass OWASP Top 10 compliance checks. Continue to monitor for new vulnerabilities and run regular security audits.

---

*Report generated as part of security hardening process.*

