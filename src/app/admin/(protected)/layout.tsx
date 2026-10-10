import { redirect } from "next/navigation";
import { requireAdmin, signOut } from "@/lib/auth";
import { AdminNav } from "@/components/admin/AdminNav";

export const dynamic = "force-dynamic";

export default async function ProtectedAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Server-side re-check — middleware also gates this, but the layout never
  // trusts that alone (defense in depth).
  const { authorized, email } = await requireAdmin();
  if (!authorized || !email) {
    redirect("/admin/login");
  }

  async function doSignOut() {
    "use server";
    await signOut({ redirectTo: "/admin/login" });
  }

  return (
    <div className="min-h-dvh bg-bg">
      <AdminNav email={email} signOut={doSignOut} />
      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">{children}</main>
    </div>
  );
}
