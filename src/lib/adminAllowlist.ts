/**
 * Pure, dependency-free allowlist check — kept separate from lib/auth.ts so
 * it can be imported by middleware.ts, which runs on the Edge runtime and
 * cannot load Prisma/pino.
 */
function parseAllowedEmails(): Set<string> {
  const raw = process.env.ALLOWED_ADMIN_EMAILS ?? "";
  return new Set(
    raw
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean),
  );
}

function allowedDomain(): string | null {
  const raw = process.env.ALLOWED_GOOGLE_DOMAIN?.trim().toLowerCase();
  return raw ? raw : null;
}

export function isAuthorizedEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const normalized = email.trim().toLowerCase();
  if (parseAllowedEmails().has(normalized)) return true;
  const domain = allowedDomain();
  if (domain && normalized.endsWith(`@${domain}`)) return true;
  return false;
}
