"use client";

import { useEffect, useState } from "react";

function label(ms: number): string {
  if (ms <= 0) return "Closed";
  const totalSec = Math.floor(ms / 1000);
  const d = Math.floor(totalSec / 86400);
  const h = Math.floor((totalSec % 86400) / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (d > 0) return `${d}d ${h}h left`;
  if (h > 0) return `${h}h ${m}m left`;
  if (m > 0) return `${m}m ${s}s left`;
  return `${s}s left`;
}

/** Ticking "time left" for an item with a soft close deadline. */
export function Countdown({ closeAt }: { closeAt: string }) {
  const target = new Date(closeAt).getTime();
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const remaining = target - now;
  const urgent = remaining > 0 && remaining < 2 * 60_000;

  return (
    <span className={urgent ? "text-danger font-semibold" : "text-navy-soft"}>
      {label(remaining)}
    </span>
  );
}
