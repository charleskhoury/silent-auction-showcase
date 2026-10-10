"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/admin", label: "Items" },
  { href: "/admin/settings", label: "Settings" },
  { href: "/admin/audit", label: "Audit log" },
];

export function AdminNav({ email, signOut }: { email: string; signOut: () => Promise<void> }) {
  const pathname = usePathname();
  return (
    <header className="border-b border-hairline bg-white">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <div className="flex items-center gap-6">
          <span className="font-serif text-lg text-navy">Auction Admin</span>
          <nav className="flex gap-4 text-sm">
            {links.map((l) => {
              const active = l.href === "/admin" ? pathname === "/admin" : pathname.startsWith(l.href);
              return (
                <Link
                  key={l.href}
                  href={l.href}
                  className={
                    active
                      ? "font-semibold text-navy underline"
                      : "text-navy-soft hover:text-navy"
                  }
                >
                  {l.label}
                </Link>
              );
            })}
          </nav>
        </div>
        <div className="flex items-center gap-3 text-xs text-navy-soft">
          <span className="hidden sm:inline">{email}</span>
          <form action={signOut}>
            <button type="submit" className="underline hover:text-navy">
              Sign out
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
