"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

type Settings = {
  eventName: string;
  biddingEnabled: boolean;
  closedMessage: string | null;
};

export function SettingsManager() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch("/api/admin/settings")
      .then((r) => r.json())
      .then((json) => setSettings(json.settings));
  }, []);

  if (!settings) return <p className="text-sm text-navy-soft">Loading…</p>;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!settings) return;
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventName: settings.eventName,
          biddingEnabled: settings.biddingEnabled,
          closedMessage: settings.closedMessage || null,
        }),
      });
      if (!res.ok) {
        setError((await res.json()).error ?? "Could not save.");
        return;
      }
      setSaved(true);
    } catch {
      setError("Network error.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={save} className="flex max-w-xl flex-col gap-5">
      <h1 className="font-serif text-2xl text-navy">Settings</h1>

      <Input
        label="Event name"
        value={settings.eventName}
        onChange={(e) => setSettings({ ...settings, eventName: e.target.value })}
      />

      <label className="flex items-start gap-3 rounded-xl border border-hairline bg-white p-4">
        <input
          type="checkbox"
          checked={settings.biddingEnabled}
          onChange={(e) => setSettings({ ...settings, biddingEnabled: e.target.checked })}
          className="mt-1"
        />
        <span>
          <span className="block font-medium text-navy">Bidding enabled</span>
          <span className="block text-sm text-navy-soft">
            Master switch. When off, guests can see the items but cannot place
            bids, regardless of each item&apos;s status.
          </span>
        </span>
      </label>

      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-navy-soft" htmlFor="closedMessage">
          Message shown when bidding is off (optional)
        </label>
        <textarea
          id="closedMessage"
          rows={2}
          value={settings.closedMessage ?? ""}
          onChange={(e) => setSettings({ ...settings, closedMessage: e.target.value })}
          className="rounded-lg border border-hairline bg-bg-elevated px-4 py-2.5 text-navy focus-visible:border-gold-deep"
        />
      </div>

      {error && <p className="text-sm text-danger">{error}</p>}
      {saved && <p className="text-sm text-gold-deep">Saved.</p>}

      <div>
        <Button type="submit" disabled={busy}>
          {busy ? "Saving…" : "Save settings"}
        </Button>
      </div>
    </form>
  );
}
