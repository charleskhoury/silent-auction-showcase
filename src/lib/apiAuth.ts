import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";

/**
 * Every api/admin/* route calls this independently — middleware.ts also
 * gates these paths, but no route trusts that alone (defense in depth).
 */
export async function requireAdminOrRespond(): Promise<
  { ok: true; email: string } | { ok: false; response: NextResponse }
> {
  const { authorized, email } = await requireAdmin();
  if (!authorized || !email) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }
  return { ok: true, email };
}

export function safeError(err: unknown, fallback = "Something went wrong."): string {
  if (err instanceof Error && process.env.NODE_ENV !== "production") return err.message;
  return fallback;
}
