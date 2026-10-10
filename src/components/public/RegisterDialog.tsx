"use client";

import { useState } from "react";
import { Dialog } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

export type Bidder = { id: string; name: string; mobile: string; anonymous: boolean };

export function RegisterDialog({
  open,
  onClose,
  onRegistered,
}: {
  open: boolean;
  onClose: () => void;
  onRegistered: (bidder: Bidder, returning: boolean) => void;
}) {
  const [name, setName] = useState("");
  const [mobile, setMobile] = useState("");
  const [pin, setPin] = useState("");
  const [anonymous, setAnonymous] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/bidder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, mobile, pin, anonymous }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Something went wrong.");
        return;
      }
      onRegistered(json.bidder, json.returning);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title="Register to bid">
      <form onSubmit={submit} className="flex flex-col gap-4">
        <p className="text-sm text-navy-soft">
          Enter your details once to start bidding. Pick a 4-digit PIN you&apos;ll
          remember — you&apos;ll only need it again if you switch to another phone.
        </p>
        <Input
          label="Your name"
          name="name"
          autoComplete="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
        <Input
          label="Mobile number"
          name="mobile"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          placeholder="04xx xxx xxx"
          value={mobile}
          onChange={(e) => setMobile(e.target.value)}
          required
        />
        <Input
          label="Choose a 4-digit PIN"
          name="pin"
          type="text"
          inputMode="numeric"
          autoComplete="off"
          maxLength={4}
          placeholder="••••"
          value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
          required
        />
        <label className="flex items-start gap-3 rounded-lg border border-hairline bg-bg p-3">
          <input
            type="checkbox"
            checked={anonymous}
            onChange={(e) => setAnonymous(e.target.checked)}
            className="mt-0.5"
          />
          <span className="text-sm text-navy-soft">
            Keep me anonymous on the public board. The committee still sees your
            name so they can reach you if you win.
          </span>
        </label>
        {error && (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        )}
        <div className="mt-1 flex justify-end gap-3">
          <Button type="button" variant="secondary" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button type="submit" disabled={busy}>
            {busy ? "Please wait…" : "Continue"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
