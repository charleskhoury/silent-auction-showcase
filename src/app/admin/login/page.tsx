import { signIn } from "@/lib/auth";
import { EmblemMotif } from "@/components/public/EmblemMotif";
import { Button } from "@/components/ui/Button";

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-bg px-6 text-center">
      <EmblemMotif className="h-14 w-10 text-gold-deep" />
      <div>
        <p className="eyebrow">Riverside Community Gala · Silent Auction</p>
        <h1 className="mt-2 font-serif text-3xl text-navy">Committee Sign In</h1>
      </div>
      <hr className="gold-divider" />

      {error && (
        <p role="alert" className="max-w-xs text-sm text-danger">
          {error === "AccessDenied"
            ? "That Google account is not authorised for the admin area. Please contact the committee if you believe this is an error."
            : "Sign-in failed. Please try again."}
        </p>
      )}

      <form
        action={async () => {
          "use server";
          await signIn("google", { redirectTo: "/admin" });
        }}
      >
        <Button type="submit">Sign in with Google</Button>
      </form>
    </main>
  );
}
