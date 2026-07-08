# Security Best Practices Audit Report

**Project:** SISTEM_INVENTORY (Next.js 15.5.19, React 19, TypeScript, Prisma, Tailwind CSS)
**Date:** 2026-07-07
**Scope:** Backend (Next.js Route Handlers, Server Actions, Middleware) + Frontend (React Client Components)
**Audit Standard:** OWASP Cheat Sheets + Next.js Security Docs + React Security Best Practices (58 gates)

---

## Executive Summary

This report identifies **10 findings** across the codebase. No Critical severity issues were found. The three **High** severity findings involve:
1. A Content Security Policy weakened by `'unsafe-inline'` and `'unsafe-eval'` directives
2. URL query parameters reflected into href attributes without encoding (stored/reflected XSS surface)
3. Database values interpolated into navigation URLs without encoding

The CSP weakness is the broadest-impact finding — it significantly reduces the browser's ability to mitigate XSS attacks. The URL encoding issues are isolated to specific href constructions but warrant prompt attention. The remaining **Medium** and **Low** findings cover input validation gaps, cookie security configuration, and client-side storage practices.

---

## Severity Summary

| Severity | Count | Key Areas |
|----------|-------|-----------|
| **Critical** | 0 | — |
| **High** | 3 | CSP strength, URL param injection, DB-to-URL encoding |
| **Medium** | 5 | Input validation, CSRF protection, cookie security, localStorage |
| **Low** | 2 | Password policy, account lockout |
| **Info** | 2 | Dependencies, build configuration |

---

## HIGH Severity Findings

### FS-001: CSP Uses `'unsafe-inline'` and `'unsafe-eval'` (NEXT-CSP-001 / REACT-CSP-001)

| Field | Value |
|-------|-------|
| **Location** | `next.config.ts:30-33` |
| **Rule** | NEXT-CSP-001: MUST avoid `unsafe-inline`/`unsafe-eval` without strict justification |
| **Severity** | **High** |

**Evidence:**
```typescript
key: "Content-Security-Policy",
value:
  "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'",
```

**Impact:** `'unsafe-inline'` for scripts allows any injected inline `<script>` tag to execute. `'unsafe-eval'` allows `eval()` and similar dynamic code execution. Together, these directives nullify the XSS-mitigation benefit of CSP — a single XSS vulnerability is all that's needed to execute arbitrary code. CSP is intended as defense-in-depth, but these directives reduce it to a minimal safety net.

**Fix:** Replace with a nonce-based or hash-based CSP for scripts. Next.js supports `nonce` generation. Alternatively, tighten `script-src` to only what is strictly needed and audit whether `unsafe-eval` can be removed.

**Mitigation:** No `dangerouslySetInnerHTML` or `innerHTML` usage was found in the codebase, which reduces the practical XSS surface. However, reflected params in href (see FS-002) and DB values in href (see FS-003) remain exploitable.

---

### FS-002: URL Query Parameters Reflected into href Without Encoding (NEXT-XSS-001 / REACT-URL-001)

| Field | Value |
|-------|-------|
| **Location** | `src/app/(app)/page.tsx:312,322` |
| **Rule** | NEXT-XSS-001: MUST rely on React's default escaping; MUST NOT insert untrusted data into URL attributes without validation |
| **Severity** | **High** |

**Evidence:**
```typescript
// Line 312
href={`/?mode=operational${params.from ? `&from=${params.from}` : ""}${params.to ? `&to=${params.to}` : ""}`}
// Line 322
href={`/?mode=owner${params.from ? `&from=${params.from}` : ""}${params.to ? `&to=${params.to}` : ""}`}
```

**Impact:** The `from` and `to` query parameters from `searchParams` are interpolated directly into `<a href>` attributes without `encodeURIComponent()`. An attacker can craft a link like `/?from="><script>alert(1)</script>` — while React escapes the href attribute value in JSX, the URL is still served to other users via these links, enabling **reflected XSS** if a user clicks a crafted link (the payload string is echoed into the page as part of the href). Additionally, characters like `&`, `#`, or `=` in these params can break URL structure, potentially redirecting to attacker-controlled destinations or leaking data to unexpected endpoints.

**Fix:** Wrap with `encodeURIComponent()`:
```typescript
href={`/?mode=operational${params.from ? `&from=${encodeURIComponent(params.from)}` : ""}${params.to ? `&to=${encodeURIComponent(params.to)}` : ""}`}
```

**Also affected:** Line 338-349: `params.from` and `params.to` are also used in `defaultValue` and `value` props — these are safe (React escapes text content), but encoding for URL context is still needed.

---

### FS-003: Database Values Interpolated into href Without Encoding (NEXT-XSS-001 / REACT-URL-001)

| Field | Value |
|-------|-------|
| **Location** | Multiple files (see below) |
| **Rule** | NEXT-XSS-001: DB-stored user content must be encoded in URL contexts |
| **Severity** | **High** |

**Evidence:**

1. **`src/app/(app)/pengguna/PenggunaClient.tsx:165`**
   ```typescript
   href={`/log-aktivitas?q=${u.nama}`}
   ```
   `u.nama` comes from the database (user-supplied during account creation).

2. **`src/components/CommandPaletteActions.ts:77`**
   ```typescript
   link: '/invoice?client=${c.nama}'
   ```
   `c.nama` comes from the database (client name).

3. **`src/components/CommandPaletteActions.ts:94`**
   ```typescript
   link: '/invoice?project=${p.nama}'
   ```
   `p.nama` comes from the database (project name).

**Impact:** User-supplied values stored in the database are interpolated into URL `href` attributes without URL encoding. If a user's name contains characters like `&`, `#`, `"`, `<`, `>`, or `'`, the URL structure can be broken — potentially injecting additional query parameters, redirecting to unexpected pages, or contributing to XSS. While these are stored values (not directly attacker-controlled via URL), supply-chain or injection attacks that modify these DB values could propagate via navigation links.

**Fix:** Apply `encodeURIComponent()` to all DB-sourced string values used in URL query parameters:
```typescript
href={`/log-aktivitas?q=${encodeURIComponent(u.nama)}`}
```

---

## MEDIUM Severity Findings

### FS-004: Cookie `Secure` Flag Configured via Env Variable (NEXT-SESS-001)

| Field | Value |
|-------|-------|
| **Location** | `src/lib/auth.ts:56` |
| **Rule** | NEXT-SESS-001: Session cookies MUST use `Secure` in production |
| **Severity** | **Medium** |

**Evidence:**
```typescript
secure: process.env.NODE_ENV === "production" && process.env.COOKIE_SECURE === "true",
```

**Impact:** If `COOKIE_SECURE` is not set to `"true"` in the production environment (e.g., forgotten during deployment), session cookies will be sent over unencrypted HTTP connections, exposing the session token to network eavesdropping (man-in-the-middle). The comment in the code acknowledges this is conditional for Laragon (local HTTP), but without documentation or CI checks ensuring `COOKIE_SECURE=true` in production, the risk of misconfiguration is elevated.

**Fix:** Either:
- Default to `true` when `NODE_ENV === "production"` (i.e., `secure: process.env.NODE_ENV === "production"`), or
- Add a CI/deployment check that verifies `COOKIE_SECURE=true` is set in production environments.

---

### FS-005: Login Action Lacks Schema Validation Library (NEXT-INPUT-001)

| Field | Value |
|-------|-------|
| **Location** | `src/app/login/actions.ts:32-43` |
| **Rule** | NEXT-INPUT-001: MUST validate input with schema validation (Zod, Yup, Valibot) |
| **Severity** | **Medium** |

**Evidence:**
```typescript
const username = String(formData.get("username") ?? "").trim();
const password = String(formData.get("password") ?? "");

if (
  !username ||
  !password ||
  username.length > FIELD_LIMITS.username ||
  password.length > FIELD_LIMITS.passwordMax
) {
  return { error: "Username atau password salah." };
}
```

**Impact:** Input validation is done manually (length checks, non-empty) instead of using a schema validation library. While this works, it's fragile — type coercions (`String()`) can mask unexpected input shapes, and there's no structural validation of input types. Manual validation is more prone to oversight as the codebase evolves. No Zod/schema library is used anywhere in the login flow.

**Fix:** Migrate to Zod (which is already in `package.json` as a dependency). Define a schema:
```typescript
const loginSchema = z.object({
  username: z.string().min(1).max(30).trim(),
  password: z.string().min(1).max(100),
});
const parsed = loginSchema.safeParse({ username, password });
```

---

### FS-006: Logout Route Handler Lacks CSRF Protection (NEXT-CSRF-001)

| Field | Value |
|-------|-------|
| **Location** | `src/app/(app)/logout/route.ts:4-7` |
| **Rule** | NEXT-CSRF-001: Cookie-authenticated state-changing endpoints MUST be CSRF-protected |
| **Severity** | **Medium** |

**Evidence:**
```typescript
export async function POST(request: Request) {
  await destroySession();
  return NextResponse.redirect(new URL("/login", request.url));
}
```

**Impact:** The logout POST endpoint modifies session state (destroys it) and relies on cookie authentication but has no CSRF token validation and no Origin/Referer header check. Since the cookie is set with `SameSite=Lax`, this provides some protection — cross-site POST requests from external forms would not include the cookie in most modern browsers. However, `SameSite` alone is not a complete CSRF defense per OWASP guidance. A malicious site could still perform a logout CSRF attack under certain `SameSite` configurations (e.g., if the user's browser doesn't support `SameSite`, or via top-level navigation).

**Fix:** Add an Origin/Referer header check in the logout handler:
```typescript
const origin = request.headers.get("origin");
const host = request.headers.get("host");
if (!origin || !host || !origin.includes(host)) {
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}
```

**Note:** Impact is limited since logout CSRF is primarily a nuisance attack (denial of access). The same endpoint uses `destroySession()` which also calls `cookies().delete()` — a no-op if the session was already expired.

---

### FS-007: Cart Transaction Data Stored in localStorage (REACT-AUTH-001)

| Field | Value |
|-------|-------|
| **Location** | `src/app/(app)/kasir/KasirClient.tsx:95-108` |
| **Rule** | REACT-AUTH-001: Avoid storing sensitive data in Web Storage |
| **Severity** | **Medium** |

**Evidence:**
```typescript
// Load held transactions from localStorage
const stored = localStorage.getItem("si_held_carts");
...
// Sync held transactions to localStorage
localStorage.setItem("si_held_carts", JSON.stringify(newCarts));
```

**Impact:** Full cart data (items, prices, quantities) is persisted in `localStorage` as plain-text JSON. If an XSS vulnerability exists anywhere in the application, an attacker can:
1. Exfiltrate the cart data (price/quantity information, customer context).
2. Tamper with held cart data before it's restored (price manipulation, item substitution).

While transaction data is not as sensitive as session tokens, OWASP guidance recommends against storing business/transaction data in `localStorage` due to the lack of confidentiality and integrity guarantees.

**Fix:** Consider storing only cart IDs or references in localStorage, with the actual cart data stored server-side. Alternatively, if offline/holding feature is critical, sign the localStorage data with a server-provided HMAC to detect tampering.

---

### FS-008: Universal Search Lacks Schema Validation (NEXT-INPUT-001)

| Field | Value |
|-------|-------|
| **Location** | `src/components/CommandPaletteActions.ts:14-20` |
| **Rule** | NEXT-INPUT-001: Server Action inputs MUST be validated |
| **Severity** | **Medium** |

**Evidence:**
```typescript
export async function universalSearch(query: string): Promise<SearchResult[]> {
  const session = await getSession();
  if (!session) return [];

  const q = String(query ?? "").trim().toLowerCase().slice(0, 80);
  if (!q) return [];
```

**Impact:** The `universalSearch` Server Action accepts a raw `query: string` parameter without structural validation. While basic sanitization is present (`trim().toLowerCase().slice(0, 80)`), there's no type/schema validation. The Prisma queries downstream use `contains` (parameterized), so SQL injection is not a concern. However, without a Zod schema, a malformed or unexpected input type could cause unexpected behavior.

**Fix:** Add a Zod schema:
```typescript
const searchSchema = z.object({
  query: z.string().min(1).max(80).trim(),
});
```

---

## LOW Severity Findings

### FS-009: No Account Lockout Mechanism After Failed Login Attempts (NEXT-DOS-001)

| Field | Value |
|-------|-------|
| **Location** | `src/app/login/actions.ts:20-29` |
| **Rule** | NEXT-DOS-001: SHOULD implement rate limiting and account lockout |
| **Severity** | **Low** |

**Evidence:** Rate limiting is implemented (in-memory, 8 attempts per 5-minute window per IP), but there is no account-level lockout after repeated failed attempts for a specific username.

**Impact:** An attacker can perform unlimited password guesses against a specific username, limited only by the per-IP rate limit (which can be circumvented by rotating IPs).

**Fix:** Add account-level lockout: after N consecutive failed attempts for a username, delay further attempts for that username for M minutes. Track failed attempts per username in the database.

---

### FS-010: No Password Complexity Requirements (NEXT-AUTH-001)

| Field | Value |
|-------|-------|
| **Location** | `src/app/login/actions.ts` |
| **Rule** | General: password policies SHOULD exist |
| **Severity** | **Low** |

**Evidence:** Password validation only checks `password.length <= 100`. There is no minimum length, complexity requirement (uppercase, lowercase, digit, special character), or breach check.

**Impact:** Weak passwords (e.g., "123456") are accepted, making brute-force and credential-stuffing attacks more likely to succeed.

**Fix:** Implement password policies during registration. If registration is not self-service (admin creates users), password policies should be enforced when admin sets passwords.

---

## Informational Findings

### FS-011: Next.js Version Check (NEXT-SUPPLY-001)

| Field | Value |
|-------|-------|
| **Location** | `package.json` |
| **Rule** | NEXT-SUPPLY-001: MUST run a supported Next.js version |
| **Severity** | **Info** |

**Finding:** The project uses `next@15.5.19`. Per the skill reference, versions older than 15.5.7 (for the 15.5.x line) are vulnerable to the "react2shell" vulnerability (CVE-2025-66478). Version 15.5.19 is above the minimum patched version (15.5.7), so this project is NOT affected by that CVE.

**Status:** OK — no action needed.

---

### FS-012: Build Configuration (NEXT-DEPLOY-001)

| Field | Value |
|-------|-------|
| **Location** | `package.json` |
| **Rule** | NEXT-DEPLOY-001: production must use `next start`, not `next dev` |
| **Severity** | **Info** |

**Finding:** The `dev` script uses `next dev --turbo` (development mode, appropriate for local development). The `build` script uses `next build` and no `start` script was found. This is appropriate — production deployment would use `next build` + `next start` or a managed platform.

**Status:** OK — no action needed.

---

## Appendix: Scan Methodology

- **Static analysis** via grepping for DOM XSS sinks (`innerHTML`, `dangerouslySetInnerHTML`, `document.write`, etc.)
- **Input validation audit** for all Route Handlers, Server Actions, and login flows
- **CSP and security header** review in `next.config.ts`
- **Cookie security** review in `src/lib/auth.ts`
- **Authentication flows** reviewed: `login/actions.ts`, `logout/route.ts`
- **localStorage usage** audited across all files
- **DB-to-URL encoding** audit for all navigation/interpolation patterns
- **Dependency version** check against known Next.js CVEs

**Tools used:** grep, file glob, manual code review
**References:** OWASP Cheat Sheets, Next.js 15 Security Docs, React 19 Security Spec
