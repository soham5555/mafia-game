"use client";

import { useEffect, useState } from "react";

interface LaunchEvent {
  key: string;
  label: string;
  emoji: string;
  image: string | null;
  kind: "item" | "avatar";
  status: "active" | "upcoming";
  percent: number;
  saleName: string | null;
  startsAt: string | null;
  endsAt: string | null;
  surprise: boolean;
}

function fmt(ms: number): string {
  if (ms <= 0) return "0s";
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m ${sec}s`;
  if (m > 0) return `${m}m ${sec}s`;
  return `${sec}s`;
}

export function LaunchTicker({ onOpenShop }: { onOpenShop: () => void }) {
  const [events, setEvents] = useState<LaunchEvent[]>([]);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const load = () =>
      fetch("/api/events/launch")
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => d?.events && setEvents(d.events))
        .catch(() => {});
    load();
    const poll = setInterval(load, 15000);
    const tick = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      clearInterval(poll);
      clearInterval(tick);
    };
  }, []);

  if (events.length === 0) return null;

  return (
    <div className="mt-4 space-y-2">
      {events.map((e) => {
        const target =
          e.status === "upcoming" ? new Date(e.startsAt ?? 0).getTime() : new Date(e.endsAt ?? 0).getTime();
        const remaining = e.endsAt || e.startsAt ? target - now : 0;
        const hasTimer = e.status === "upcoming" ? !!e.startsAt : !!e.endsAt;
        return (
          <button
            key={e.key + e.status}
            onClick={onOpenShop}
            className={`flex w-full items-center gap-3 rounded-2xl border p-3 text-left ${
              e.status === "active"
                ? "border-emerald-500/50 bg-emerald-900/20"
                : "border-sky-500/50 bg-sky-900/20"
            }`}
          >
            <span className="grid h-11 w-11 flex-shrink-0 place-items-center overflow-hidden rounded-xl bg-slate-800 text-2xl">
              {e.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={e.image} alt="" className="h-full w-full object-cover" />
              ) : (
                e.emoji
              )}
            </span>
            <span className="flex-1">
              <span className="block text-sm font-black">
                {e.status === "active" ? "🔥 SALE LIVE" : "⏳ LAUNCH EVENT"}
                {e.surprise && " · 🎁 Surprise!"}
              </span>
              <span className="block text-xs text-slate-300">
                {e.surprise ? (
                  <>Something special {e.status === "active" ? "is live now" : "is coming"}…</>
                ) : (
                  <>
                    {e.label} — {e.saleName ? `${e.saleName} ` : ""}−{e.percent}%
                  </>
                )}
              </span>
              {hasTimer && (
                <span className="mt-0.5 block font-mono text-xs font-bold text-amber-300">
                  {e.status === "upcoming" ? "Starts in " : "Ends in "}
                  {fmt(remaining)}
                </span>
              )}
            </span>
          </button>
        );
      })}
    </div>
  );
}
