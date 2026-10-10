import NextAuth from "next-auth";
import { authConfig } from "@/lib/auth.config";
import { prisma } from "@/lib/db";
import { writeAuditLog } from "@/lib/audit";
import { logger } from "@/lib/logger";
import { isAuthorizedEmail } from "@/lib/adminAllowlist";

export { isAuthorizedEmail };

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  callbacks: {
    ...authConfig.callbacks,
    async signIn({ user }) {
      const authorized = isAuthorizedEmail(user.email);
      if (!authorized) {
        logger.warn({ msg: "admin.signIn.rejected" });
        await writeAuditLog({
          administratorEmail: user.email ?? "unknown",
          action: "auth.rejected",
          entityType: "Administrator",
          changeSummary: "Sign-in rejected: email not on admin allowlist.",
        }).catch(() => undefined);
        return false;
      }

      await prisma.administrator
        .upsert({
          where: { email: user.email!.toLowerCase() },
          update: { lastLoginAt: new Date(), displayName: user.name ?? undefined },
          create: {
            email: user.email!.toLowerCase(),
            displayName: user.name ?? undefined,
            lastLoginAt: new Date(),
          },
        })
        .catch((err) => logger.error({ err }, "administrator.upsert.failed"));

      await writeAuditLog({
        administratorEmail: user.email!.toLowerCase(),
        action: "auth.login",
        entityType: "Administrator",
        changeSummary: "Administrator signed in via Google.",
      }).catch(() => undefined);

      return true;
    },
  },
});

export async function requireAdmin() {
  const session = await auth();
  const email = session?.user?.email ?? null;
  if (!isAuthorizedEmail(email)) {
    return { authorized: false as const, email: null };
  }
  return { authorized: true as const, email: email!.toLowerCase() };
}
