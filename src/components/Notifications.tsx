"use client";

import { useEffect, useState, useCallback, useRef } from "react";

interface Notif {
  id: number;
  type: string;
  text: string;
  meta: Record<string, unknown>;
  read: boolean;
  createdAt: string;
}

const ICONS: Record<string, string> = {
  coins: "🪙",
  purchase: "🎉",
  sale: "💰",
  friend: "👋",
  invite: "🎮",
  info: "🔔",
  win: "🏆",
  lose: "😔",
};

export function Notifications({ authToken }: { authToken: string }) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Notif[]>([]);
  const [unread, setUnread] = useState(0);
  const [toasts, setToasts] = useState<Notif[]>([]);
  const [pushState, setPushState] = useState<NotificationPermission | "unsupported">("default");
  const seen = useRef<Set<number>>(new Set());
  const firstLoad = useRef(true);

  useEffect(() => {
    if (typeof window === "undefined" || !("Notification" in window)) {
      setPushState("unsupported");
    } else {
      setPushState(Notification.permission);
    }
  }, []);

  function pushNotify(n: Notif) {
    try {
      if (typeof window === "undefined" || !("Notification" in window)) return;
      if (Notification.permission !== "granted") return;
      if (document.visibilityState === "visible") return; // don't double up with in-app toast
      const icons: Record<string, string> = {
        win: "🏆", lose: "😔", coins: "🪙", purchase: "🎉", sale: "💰",
        friend: "👋", invite: "🎮", info: "🔔",
      };
      new Notification("Mafia: The City", { body: `${icons[n.type] ?? "🔔"} ${n.text}` });
    } catch {
      /* ignore */
    }
  }

  async function enablePush() {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    const perm = await Notification.requestPermission();
    setPushState(perm);
    if (perm === "granted") {
      new Notification("Mafia: The City", { body: "🔔 Push notifications enabled!" });
    }
  }

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/notifications?token=${authToken}`);
      if (!res.ok) return;
      const data = await res.json();
      const list: Notif[] = data.notifications;
      setItems(list);
      setUnread(data.unread);

      // pop toasts for newly-arrived unread notifications
      const fresh = list.filter((n) => !n.read && !seen.current.has(n.id));
      fresh.forEach((n) => seen.current.add(n.id));
      list.forEach((n) => seen.current.add(n.id));
      if (!firstLoad.current && fresh.length) {
        setToasts((t) => [...fresh, ...t].slice(0, 4));
        fresh.forEach((n) => {
          setTimeout(() => {
            setToasts((t) => t.filter((x) => x.id !== n.id));
          }, 4500);
          // Fire a real browser push notification when permitted.
          pushNotify(n);
        });
      }
      firstLoad.current = false;
    } catch {
      /* ignore */
    }
  }, [authToken]);

  useEffect(() => {
    load();
    const id = setInterval(load, 4000);
    return () => clearInterval(id);
  }, [load]);

  async function openPanel() {
    setOpen(true);
    await fetch("/api/notifications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: authToken }),
    });
    setUnread(0);
    load();
  }

  return (
    <>
      {/* Toasts */}
      <div className="pointer-events-none fixed left-1/2 top-4 z-[60] flex w-[90%] max-w-sm -translate-x-1/2 flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className="anim-float-in pointer-events-auto rounded-xl border border-amber-500/50 bg-slate-900/95 px-4 py-3 text-sm shadow-2xl"
          >
            <span className="mr-1">{ICONS[t.type] ?? "🔔"}</span>
            <span className="text-slate-100">{t.text}</span>
          </div>
        ))}
      </div>

      {/* Bell button */}
      <button
        onClick={openPanel}
        className="relative rounded-full border border-slate-600 bg-slate-800 px-3 py-2 text-lg"
        aria-label="Notifications"
      >
        🔔
        {unread > 0 && (
          <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-xs font-bold text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {/* Panel */}
      {open && (
        <div className="fixed inset-0 z-[55] flex items-start justify-center bg-black/70 px-4 pt-20" onClick={() => setOpen(false)}>
          <div
            className="w-full max-w-md rounded-2xl border border-slate-600 bg-slate-900 p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-lg font-black text-amber-400">🔔 Notifications</h3>
              <button onClick={() => setOpen(false)} className="text-slate-400">
                ✕
              </button>
            </div>
            {/* Push notification controls */}
            {pushState === "unsupported" ? (
              <p className="mb-3 rounded-lg bg-slate-800 px-3 py-2 text-xs text-slate-400">
                ℹ️ Your browser does not support push notifications.
              </p>
            ) : pushState === "granted" ? (
              <div className="mb-3 flex items-center gap-2 rounded-lg bg-emerald-900/30 px-3 py-2 text-xs text-emerald-300">
                <span>✅ Push notifications enabled!</span>
                <button
                  onClick={async () => {
                    // There is no programmatic way to revoke; guide the user.
                    alert(
                      "To disable notifications, open your browser's site settings and set Notifications to 'Block' for this site."
                    );
                  }}
                  className="ml-auto text-xs text-slate-400 underline"
                >
                  Disable
                </button>
              </div>
            ) : pushState === "denied" ? (
              <p className="mb-3 rounded-lg bg-red-900/30 px-3 py-2 text-xs text-red-300">
                🔕 Push notifications are blocked. Open your browser's site settings and allow
                notifications for this site, then refresh.
              </p>
            ) : (
              /* default — not yet asked */
              <button
                onClick={enablePush}
                className="mb-3 w-full rounded-lg bg-amber-500 py-2 text-sm font-bold text-slate-950 hover:bg-amber-400 active:scale-95"
              >
                🔔 Enable push notifications
              </button>
            )}
            <div className="max-h-[60vh] space-y-2 overflow-y-auto">
              {items.length === 0 ? (
                <p className="py-6 text-center text-sm text-slate-500">No notifications yet.</p>
              ) : (
                items.map((n) => (
                  <div
                    key={n.id}
                    className="rounded-lg border border-slate-700 bg-slate-800/60 px-3 py-2 text-sm"
                  >
                    <span className="mr-1">{ICONS[n.type] ?? "🔔"}</span>
                    <span className="text-slate-200">{n.text}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
