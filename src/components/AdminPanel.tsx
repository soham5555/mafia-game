"use client";

import { useCallback, useEffect, useState } from "react";

interface Member {
  id: number;
  username: string;
  approved: boolean;
  coins: number;
  banned: boolean;
  bannedUntil: string | null;
  avatar: string;
}
interface Pending {
  id: number;
  username: string;
}
interface EffItem {
  key: string;
  name: string;
  emoji: string;
  description: string;
  price: number;
  effectivePrice: number;
  discountPercent: number;
  discountName: string | null;
  disabled: boolean;
  custom: boolean;
  saleUpcoming: boolean;
  upcomingName: string | null;
  upcomingPercent: number;
}
interface CustomRole {
  id: number;
  roleKey: string;
  name: string;
  emoji: string;
  team: string;
  description: string;
}
interface CustomAvatarRow {
  key: string;
  name: string;
  image: string;
  price: number;
  effectivePrice: number;
  discountPercent: number;
  discountName: string | null;
  saleUpcoming: boolean;
  upcomingName: string | null;
  upcomingPercent: number;
}

type Tab = "members" | "shop" | "avatars" | "roles" | "text" | "background";

export function AdminPanel({
  authToken,
  pending,
  members,
  onDecide,
  onRefresh,
}: {
  authToken: string;
  pending: Pending[];
  members: Member[];
  onDecide: (id: number, decision: "yes" | "no") => void;
  onRefresh: () => void;
}) {
  const [tab, setTab] = useState<Tab>("members");
  const [msg, setMsg] = useState("");
  const [items, setItems] = useState<EffItem[]>([]);
  const [roles, setRoles] = useState<CustomRole[]>([]);
  const [avatars, setAvatars] = useState<CustomAvatarRow[]>([]);
  const [texts, setTexts] = useState<Record<string, string>>({});
  const [textKeys, setTextKeys] = useState<string[]>([]);
  // Background settings
  const [bgType, setBgType] = useState<"gradient" | "color" | "gif">("gradient");
  const [bgColor, setBgColor] = useState("#0f172a");
  const [bgGifUrl, setBgGifUrl] = useState("");
  const [bgLoaded, setBgLoaded] = useState(false);

  function flash(m: string) {
    setMsg(m);
    setTimeout(() => setMsg(""), 3000);
  }

  async function api(path: string, body: Record<string, unknown>) {
    const res = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ authToken, ...body }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) flash(data.error || "Failed");
    return res.ok;
  }

  const loadItems = useCallback(async () => {
    const res = await fetch(`/api/admin/item?token=${authToken}`);
    if (res.ok) setItems((await res.json()).items ?? []);
  }, [authToken]);
  const loadRoles = useCallback(async () => {
    const res = await fetch(`/api/admin/role?token=${authToken}`);
    if (res.ok) setRoles((await res.json()).roles ?? []);
  }, [authToken]);
  const loadTexts = useCallback(async () => {
    const res = await fetch(`/api/admin/text?token=${authToken}`);
    if (res.ok) {
      const d = await res.json();
      setTexts(d.texts ?? {});
      setTextKeys(d.keys ?? []);
    }
  }, [authToken]);
  const loadAvatars = useCallback(async () => {
    const res = await fetch(`/api/avatars`);
    if (res.ok) setAvatars((await res.json()).avatars ?? []);
  }, []);

  const loadBackground = useCallback(async () => {
    const res = await fetch(`/api/admin/background?token=${authToken}`);
    if (res.ok) {
      const d = await res.json();
      setBgType(d.bgType ?? "gradient");
      setBgColor(d.bgColor || "#0f172a");
      setBgGifUrl(d.bgGifUrl || "");
      setBgLoaded(true);
    }
  }, [authToken]);

  useEffect(() => {
    if (tab === "shop") loadItems();
    if (tab === "roles") loadRoles();
    if (tab === "text") loadTexts();
    if (tab === "avatars") loadAvatars();
    if (tab === "background") loadBackground();
  }, [tab, loadItems, loadRoles, loadTexts, loadAvatars, loadBackground]);

  return (
    <div className="mt-4">
      <div className="mb-3 grid grid-cols-3 gap-1 rounded-xl bg-slate-900 p-1">
        {(["members", "shop", "avatars", "roles", "text", "background"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-lg py-2 text-xs font-bold capitalize ${
              tab === t ? "bg-amber-500 text-slate-950" : "text-slate-400"
            }`}
          >
            {t === "background" ? "🎨 BG" : t}
          </button>
        ))}
      </div>
      {msg && <p className="mb-2 rounded-lg bg-amber-500/20 px-3 py-2 text-sm text-amber-200">{msg}</p>}

      {/* MEMBERS: approve, ban, gift */}
      {tab === "members" && (
        <div className="space-y-4">
          <div>
            <h3 className="text-sm font-bold uppercase text-amber-400">
              Access Requests ({pending.length})
            </h3>
            {pending.length === 0 ? (
              <p className="mt-2 text-sm text-slate-500">No pending requests.</p>
            ) : (
              <div className="mt-2 space-y-2">
                {pending.map((p) => (
                  <div key={p.id} className="flex items-center justify-between rounded-xl border border-slate-700 bg-slate-800/60 px-4 py-2">
                    <span className="font-semibold">{p.username}</span>
                    <div className="flex gap-2">
                      <button onClick={() => onDecide(p.id, "yes")} className="rounded-lg bg-emerald-500 px-3 py-1 text-sm font-bold text-slate-950">
                        Yes ✓
                      </button>
                      <button onClick={() => onDecide(p.id, "no")} className="rounded-lg bg-red-500 px-3 py-1 text-sm font-bold text-white">
                        No ✕
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <h3 className="text-sm font-bold uppercase text-slate-400">
              Members ({members.length})
            </h3>
            <div className="mt-2 space-y-2">
              {members.map((m) => (
                <MemberRow
                  key={m.id}
                  m={m}
                  onDecide={onDecide}
                  onGiftCoins={async (amt) => {
                    if (await api("/api/admin/gift", { targetId: m.id, kind: "coins", amount: amt })) {
                      flash(`Gifted ${amt} coins to ${m.username}`);
                      onRefresh();
                    }
                  }}
                  onGiftItem={async (itemKey) => {
                    if (await api("/api/admin/gift", { targetId: m.id, kind: "item", value: itemKey })) {
                      flash(`Gifted ${itemKey} to ${m.username}`);
                    }
                  }}
                  onBan={async (minutes, reason) => {
                    if (await api("/api/admin/ban", { targetId: m.id, action: "ban", minutes, reason })) {
                      flash(`Banned ${m.username}`);
                      onRefresh();
                    }
                  }}
                  onUnban={async () => {
                    if (await api("/api/admin/ban", { targetId: m.id, action: "unban" })) {
                      flash(`Unbanned ${m.username}`);
                      onRefresh();
                    }
                  }}
                  items={items}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* SHOP: price / discount / disable / create */}
      {tab === "shop" && (
        <div className="space-y-3">
          <CreateItem
            onCreate={async (f) => {
              if (await api("/api/admin/item", { op: "create", ...f })) {
                flash(`Created ${f.name}`);
                loadItems();
              }
            }}
          />
          {items.map((it) => (
            <ShopItemAdmin
              key={it.key}
              it={it}
              onPrice={async (price) => {
                if (await api("/api/admin/item", { op: "price", itemKey: it.key, price })) {
                  flash("Price updated");
                  loadItems();
                }
              }}
              onDiscount={async (pct, name, startMinutes, endMinutes, surprise) => {
                if (await api("/api/admin/item", { op: "discount", itemKey: it.key, discountPercent: pct, discountName: name, startMinutes, endMinutes, surprise })) {
                  flash("Sale scheduled");
                  loadItems();
                }
              }}
              onDisable={async (minutes) => {
                if (await api("/api/admin/item", { op: "disable", itemKey: it.key, minutes })) {
                  flash("Item disabled");
                  loadItems();
                }
              }}
              onEnable={async () => {
                if (await api("/api/admin/item", { op: "enable", itemKey: it.key })) {
                  flash("Item enabled / reset");
                  loadItems();
                }
              }}
              onDelete={async () => {
                if (await api("/api/admin/item", { op: "delete", itemKey: it.key })) {
                  flash("Removed");
                  loadItems();
                }
              }}
            />
          ))}
        </div>
      )}

      {/* AVATARS: upload / delete custom avatars */}
      {tab === "avatars" && (
        <div className="space-y-3">
          <UploadAvatar
            onCreate={async (f) => {
              if (await api("/api/admin/avatar", { op: "create", ...f })) {
                flash(`Added avatar ${f.name}`);
                loadAvatars();
              }
            }}
          />
          {avatars.length === 0 ? (
            <p className="text-sm text-slate-500">No custom avatars yet. Upload one above.</p>
          ) : (
            <div className="space-y-2">
              {avatars.map((a) => (
                <AvatarAdminRow
                  key={a.key}
                  a={a}
                  onPrice={async (price) => {
                    if (await api("/api/admin/avatar", { op: "price", avatarKey: a.key, price })) {
                      flash("Price updated");
                      loadAvatars();
                    }
                  }}
                  onSale={async (pct, name, startMinutes, endMinutes, surprise) => {
                    if (await api("/api/admin/avatar", { op: "discount", avatarKey: a.key, discountPercent: pct, discountName: name, startMinutes, endMinutes, surprise })) {
                      flash("Sale scheduled");
                      loadAvatars();
                    }
                  }}
                  onClearSale={async () => {
                    if (await api("/api/admin/avatar", { op: "clearSale", avatarKey: a.key })) {
                      flash("Sale cleared");
                      loadAvatars();
                    }
                  }}
                  onDelete={async () => {
                    if (await api("/api/admin/avatar", { op: "delete", avatarKey: a.key })) {
                      flash("Deleted");
                      loadAvatars();
                    }
                  }}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ROLES: create / delete custom roles */}
      {tab === "roles" && (
        <div className="space-y-3">
          <CreateRole
            onCreate={async (f) => {
              if (await api("/api/admin/role", { op: "create", ...f })) {
                flash(`Created role ${f.name}`);
                loadRoles();
              }
            }}
          />
          {roles.length === 0 ? (
            <p className="text-sm text-slate-500">No custom roles yet.</p>
          ) : (
            roles.map((r) => (
              <div key={r.id} className="flex items-center justify-between rounded-xl border border-slate-700 bg-slate-800/60 p-3">
                <span className="text-sm">
                  <span className="text-xl">{r.emoji}</span>{" "}
                  <span className="font-bold">{r.name}</span>{" "}
                  <span className="text-xs text-slate-400">({r.team})</span>
                </span>
                <button
                  onClick={async () => {
                    if (await api("/api/admin/role", { op: "delete", roleKey: r.roleKey })) {
                      flash("Deleted");
                      loadRoles();
                    }
                  }}
                  className="text-xs text-red-400 underline"
                >
                  delete
                </button>
              </div>
            ))
          )}
        </div>
      )}

      {/* TEXT: edit site text */}
      {tab === "text" && (
        <div className="space-y-3">
          <p className="text-xs text-slate-400">
            Edit the text shown across the site (title, tagline, footer link, etc.).
          </p>
          {textKeys.map((k) => (
            <div key={k}>
              <label className="text-xs font-semibold uppercase text-slate-400">{k}</label>
              <input
                value={texts[k] ?? ""}
                onChange={(e) => setTexts((t) => ({ ...t, [k]: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-sm outline-none focus:border-amber-400"
              />
            </div>
          ))}
          <button
            onClick={async () => {
              if (await api("/api/admin/text", { texts })) flash("Saved! Refresh to see changes.");
            }}
            className="w-full rounded-xl bg-amber-500 py-2.5 font-bold text-slate-950"
          >
            Save Text
          </button>
        </div>
      )}

      {/* BACKGROUND: set background colour or GIF for main menu + game screens */}
      {tab === "background" && (
        <div className="space-y-4">
          <p className="text-xs text-slate-400">
            Set the background for the main menu and game screens. Changes take effect immediately
            for all users after they refresh.
          </p>

          {/* Type selector */}
          <div>
            <label className="text-xs font-semibold uppercase text-slate-400">Background Type</label>
            <div className="mt-2 grid grid-cols-3 gap-1 rounded-xl bg-slate-900 p-1">
              {(["gradient", "color", "gif"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setBgType(t)}
                  className={`rounded-lg py-2 text-xs font-bold capitalize ${
                    bgType === t ? "bg-amber-500 text-slate-950" : "text-slate-400"
                  }`}
                >
                  {t === "gradient" ? "🌌 Gradient" : t === "color" ? "🎨 Colour" : "🖼️ GIF"}
                </button>
              ))}
            </div>
          </div>

          {/* Colour picker – shown for color type */}
          {bgType === "color" && (
            <div>
              <label className="text-xs font-semibold uppercase text-slate-400">
                Background Colour
              </label>
              <div className="mt-2 flex items-center gap-3">
                <input
                  type="color"
                  value={bgColor.startsWith("#") ? bgColor : "#0f172a"}
                  onChange={(e) => setBgColor(e.target.value)}
                  className="h-10 w-16 cursor-pointer rounded-lg border border-slate-600 bg-transparent"
                />
                <input
                  value={bgColor}
                  onChange={(e) => setBgColor(e.target.value)}
                  placeholder="#0f172a or rgb(15,23,42)"
                  className="flex-1 rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-sm outline-none focus:border-amber-400"
                />
              </div>
              <div
                className="mt-2 h-12 w-full rounded-lg border border-slate-600"
                style={{ backgroundColor: bgColor }}
              />
            </div>
          )}

          {/* GIF URL – shown for gif type */}
          {bgType === "gif" && (
            <div>
              <label className="text-xs font-semibold uppercase text-slate-400">
                GIF / Image URL
              </label>
              <input
                value={bgGifUrl}
                onChange={(e) => setBgGifUrl(e.target.value)}
                placeholder="https://example.com/background.gif"
                className="mt-2 w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-sm outline-none focus:border-amber-400"
              />
              <p className="mt-1 text-xs text-slate-500">
                Paste any direct GIF, PNG, or JPEG URL. Hosted images from imgur, giphy, etc. all
                work.
              </p>
              {bgGifUrl && (
                <div className="mt-2 overflow-hidden rounded-lg border border-slate-600">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={bgGifUrl}
                    alt="Background preview"
                    className="max-h-40 w-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = "none";
                    }}
                  />
                </div>
              )}
            </div>
          )}

          {bgLoaded && bgType === "gradient" && (
            <p className="rounded-lg bg-slate-800 px-3 py-2 text-xs text-slate-400">
              The default gradient background will be used. Switch to Colour or GIF to customise.
            </p>
          )}

          <button
            onClick={async () => {
              const ok = await api("/api/admin/background", { bgType, bgColor, bgGifUrl });
              if (ok) flash("Background saved! Users will see it on next page load.");
            }}
            className="w-full rounded-xl bg-amber-500 py-2.5 font-bold text-slate-950"
          >
            💾 Save Background
          </button>

          <button
            onClick={async () => {
              setBgType("gradient");
              setBgColor("#0f172a");
              setBgGifUrl("");
              const ok = await api("/api/admin/background", {
                bgType: "gradient",
                bgColor: "",
                bgGifUrl: "",
              });
              if (ok) flash("Background reset to default gradient.");
            }}
            className="w-full rounded-xl border border-slate-600 py-2 text-sm font-bold text-slate-300"
          >
            🔄 Reset to Default
          </button>
        </div>
      )}
    </div>
  );
}

function MemberRow({
  m,
  onDecide,
  onGiftCoins,
  onGiftItem,
  onBan,
  onUnban,
  items,
}: {
  m: Member;
  onDecide: (id: number, d: "yes" | "no") => void;
  onGiftCoins: (amt: number) => void;
  onGiftItem: (itemKey: string) => void;
  onBan: (minutes: number, reason: string) => void;
  onUnban: () => void;
  items: EffItem[];
}) {
  const [open, setOpen] = useState(false);
  const [coinAmt, setCoinAmt] = useState(100);
  const [banMins, setBanMins] = useState(0);
  const [banReason, setBanReason] = useState("");
  const [giftKey, setGiftKey] = useState("");

  return (
    <div className="rounded-xl border border-slate-700 bg-slate-800/60 p-3">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-2 text-sm font-semibold">
          <span className="text-lg">{m.avatar}</span>
          {m.username}
          {m.banned && <span className="rounded bg-red-500/30 px-1.5 text-xs text-red-300">BANNED</span>}
          {!m.approved && <span className="rounded bg-yellow-500/30 px-1.5 text-xs text-yellow-300">pending</span>}
        </span>
        <span className="flex items-center gap-2">
          <span className="text-xs text-amber-300">🪙 {m.coins}</span>
          <button onClick={() => setOpen((o) => !o)} className="text-xs text-slate-300 underline">
            {open ? "close" : "manage"}
          </button>
        </span>
      </div>

      {open && (
        <div className="mt-3 space-y-3 border-t border-slate-700 pt-3">
          {/* approve / revoke */}
          <div className="flex gap-2">
            {m.approved ? (
              <button onClick={() => onDecide(m.id, "no")} className="rounded-lg bg-slate-700 px-3 py-1 text-xs font-bold">
                Revoke access
              </button>
            ) : (
              <button onClick={() => onDecide(m.id, "yes")} className="rounded-lg bg-emerald-500 px-3 py-1 text-xs font-bold text-slate-950">
                Approve
              </button>
            )}
            {m.banned ? (
              <button onClick={onUnban} className="rounded-lg bg-emerald-500 px-3 py-1 text-xs font-bold text-slate-950">
                Unban
              </button>
            ) : null}
          </div>

          {/* gift coins */}
          <div className="flex items-center gap-2">
            <input
              type="number"
              value={coinAmt}
              onChange={(e) => setCoinAmt(Number(e.target.value))}
              className="w-24 rounded-lg border border-slate-600 bg-slate-900 px-2 py-1 text-sm"
            />
            <button onClick={() => onGiftCoins(coinAmt)} className="rounded-lg bg-amber-500 px-3 py-1 text-xs font-bold text-slate-950">
              🎁 Gift coins
            </button>
          </div>

          {/* gift item / power */}
          <div className="flex items-center gap-2">
            <select
              value={giftKey}
              onChange={(e) => setGiftKey(e.target.value)}
              className="flex-1 rounded-lg border border-slate-600 bg-slate-900 px-2 py-1 text-sm"
            >
              <option value="">Select item/power…</option>
              {items.map((it) => (
                <option key={it.key} value={it.key}>
                  {it.emoji} {it.name}
                </option>
              ))}
            </select>
            <button
              onClick={() => giftKey && onGiftItem(giftKey)}
              disabled={!giftKey}
              className="rounded-lg bg-amber-500 px-3 py-1 text-xs font-bold text-slate-950 disabled:opacity-40"
            >
              🎁 Gift
            </button>
          </div>

          {/* ban */}
          {!m.banned && (
            <div className="rounded-lg border border-red-700/40 bg-red-950/20 p-2">
              <p className="text-xs font-bold text-red-300">Ban player</p>
              <div className="mt-1 flex items-center gap-2">
                <input
                  type="number"
                  placeholder="minutes (0 = forever)"
                  value={banMins}
                  onChange={(e) => setBanMins(Number(e.target.value))}
                  className="w-28 rounded-lg border border-slate-600 bg-slate-900 px-2 py-1 text-xs"
                />
                <input
                  placeholder="reason"
                  value={banReason}
                  onChange={(e) => setBanReason(e.target.value)}
                  className="flex-1 rounded-lg border border-slate-600 bg-slate-900 px-2 py-1 text-xs"
                />
              </div>
              <button
                onClick={() => onBan(banMins, banReason)}
                className="mt-2 w-full rounded-lg bg-red-500 py-1.5 text-xs font-bold text-white"
              >
                ⛔ Ban {banMins > 0 ? `for ${banMins} min` : "permanently"}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ShopItemAdmin({
  it,
  onPrice,
  onDiscount,
  onDisable,
  onEnable,
  onDelete,
}: {
  it: EffItem;
  onPrice: (price: number) => void;
  onDiscount: (pct: number, name: string, startMinutes: number, endMinutes: number, surprise: boolean) => void;
  onDisable: (minutes: number) => void;
  onEnable: () => void;
  onDelete: () => void;
}) {
  const [price, setPrice] = useState(it.price);
  const [pct, setPct] = useState(it.discountPercent);
  const [dName, setDName] = useState(it.discountName ?? "");
  const [startMins, setStartMins] = useState(0);
  const [endMins, setEndMins] = useState(0);
  const [surprise, setSurprise] = useState(false);
  const [mins, setMins] = useState(0);

  return (
    <div className="rounded-xl border border-slate-700 bg-slate-800/60 p-3">
      <div className="flex items-center justify-between">
        <span className="font-bold">
          <span className="text-xl">{it.emoji}</span> {it.name}
          {it.custom && <span className="ml-1 rounded bg-purple-500/30 px-1 text-xs text-purple-300">custom</span>}
          {it.disabled && <span className="ml-1 rounded bg-red-500/30 px-1 text-xs text-red-300">disabled</span>}
        </span>
        <span className="text-xs text-slate-400">
          {it.discountPercent > 0 ? (
            <>
              <span className="line-through">🪙 {it.price}</span>{" "}
              <span className="text-emerald-300">🪙 {it.effectivePrice}</span>
            </>
          ) : (
            <>🪙 {it.price}</>
          )}
        </span>
      </div>

      {/* price */}
      <div className="mt-2 flex items-center gap-2">
        <input
          type="number"
          value={price}
          onChange={(e) => setPrice(Number(e.target.value))}
          className="w-24 rounded-lg border border-slate-600 bg-slate-900 px-2 py-1 text-sm"
        />
        <button onClick={() => onPrice(price)} className="rounded-lg bg-amber-500 px-3 py-1 text-xs font-bold text-slate-950">
          Set price
        </button>
      </div>

      {/* discount / scheduled sale */}
      <div className="mt-2 rounded-lg border border-emerald-700/30 bg-emerald-950/10 p-2">
        <p className="text-xs font-bold text-emerald-300">Sale / Launch event</p>
        {it.saleUpcoming && (
          <p className="text-[10px] text-sky-300">
            ⏳ Scheduled: {it.upcomingName} −{it.upcomingPercent}% (not started yet)
          </p>
        )}
        <div className="mt-1 flex flex-wrap items-center gap-1">
          <input type="number" placeholder="% off" value={pct} onChange={(e) => setPct(Number(e.target.value))} className="w-14 rounded-lg border border-slate-600 bg-slate-900 px-2 py-1 text-xs" />
          <input placeholder="sale name" value={dName} onChange={(e) => setDName(e.target.value)} className="w-24 rounded-lg border border-slate-600 bg-slate-900 px-2 py-1 text-xs" />
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-1">
          <label className="text-[10px] text-slate-400">starts in</label>
          <input type="number" placeholder="0=now" value={startMins} onChange={(e) => setStartMins(Number(e.target.value))} className="w-16 rounded-lg border border-slate-600 bg-slate-900 px-2 py-1 text-xs" />
          <label className="text-[10px] text-slate-400">ends in</label>
          <input type="number" placeholder="0=∞" value={endMins} onChange={(e) => setEndMins(Number(e.target.value))} className="w-16 rounded-lg border border-slate-600 bg-slate-900 px-2 py-1 text-xs" />
          <span className="text-[10px] text-slate-500">min</span>
        </div>
        <label className="mt-1 flex items-center gap-2 text-xs text-slate-300">
          <input type="checkbox" checked={surprise} onChange={(e) => setSurprise(e.target.checked)} />
          🎁 Keep it a surprise (hide name & % until it&apos;s live)
        </label>
        <button onClick={() => onDiscount(pct, dName, startMins, endMins, surprise)} className="mt-1 w-full rounded-lg bg-emerald-500 py-1 text-xs font-bold text-slate-950">
          Schedule / Apply sale
        </button>
      </div>

      {/* enable/disable/delete */}
      <div className="mt-2 flex flex-wrap items-center gap-2">
        {it.disabled ? (
          <button onClick={onEnable} className="rounded-lg bg-emerald-500 px-3 py-1 text-xs font-bold text-slate-950">
            Enable
          </button>
        ) : (
          <>
            <input
              type="number"
              placeholder="mins (0=∞)"
              value={mins}
              onChange={(e) => setMins(Number(e.target.value))}
              className="w-20 rounded-lg border border-slate-600 bg-slate-900 px-2 py-1 text-xs"
            />
            <button onClick={() => onDisable(mins)} className="rounded-lg bg-slate-700 px-3 py-1 text-xs font-bold">
              Disable {mins > 0 ? `${mins}m` : ""}
            </button>
          </>
        )}
        <button onClick={onEnable} className="rounded-lg bg-slate-700 px-3 py-1 text-xs font-bold">
          Clear sale
        </button>
        {it.custom && (
          <button onClick={onDelete} className="rounded-lg bg-red-500/80 px-3 py-1 text-xs font-bold text-white">
            Delete
          </button>
        )}
      </div>
    </div>
  );
}

function CreateItem({
  onCreate,
}: {
  onCreate: (f: { itemKey: string; name: string; emoji: string; description: string; price: number }) => void;
}) {
  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState("🎁");
  const [desc, setDesc] = useState("");
  const [price, setPrice] = useState(100);

  return (
    <div className="rounded-xl border border-purple-700/40 bg-purple-950/20 p-3">
      <h3 className="text-sm font-bold text-purple-300">➕ Add new item</h3>
      <div className="mt-2 space-y-2">
        <div className="flex gap-2">
          <input
            value={emoji}
            onChange={(e) => setEmoji(e.target.value)}
            className="w-14 rounded-lg border border-slate-600 bg-slate-900 px-2 py-1 text-center text-lg"
          />
          <input
            placeholder="Item name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="flex-1 rounded-lg border border-slate-600 bg-slate-900 px-2 py-1 text-sm"
          />
          <input
            type="number"
            value={price}
            onChange={(e) => setPrice(Number(e.target.value))}
            className="w-20 rounded-lg border border-slate-600 bg-slate-900 px-2 py-1 text-sm"
          />
        </div>
        <input
          placeholder="Description"
          value={desc}
          onChange={(e) => setDesc(e.target.value)}
          className="w-full rounded-lg border border-slate-600 bg-slate-900 px-2 py-1 text-sm"
        />
        <button
          onClick={() => {
            if (!name.trim()) return;
            const itemKey = "custom_" + name.toLowerCase().replace(/[^a-z0-9]+/g, "_").slice(0, 20);
            onCreate({ itemKey, name, emoji, description: desc, price });
            setName("");
            setDesc("");
          }}
          className="w-full rounded-lg bg-purple-500 py-2 text-sm font-bold text-white"
        >
          Create item
        </button>
      </div>
    </div>
  );
}

function UploadAvatar({
  onCreate,
}: {
  onCreate: (f: { name: string; price: number; image: string }) => void;
}) {
  const [name, setName] = useState("");
  const [price, setPrice] = useState(300);
  const [image, setImage] = useState("");
  const [err, setErr] = useState("");

  async function onFile(file: File | undefined) {
    setErr("");
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setErr("Please choose an image file.");
      return;
    }
    try {
      const dataUrl = await resizeImage(file, 256, 256);
      setImage(dataUrl);
    } catch {
      setErr("Could not read that image.");
    }
  }

  return (
    <div className="rounded-xl border border-purple-700/40 bg-purple-950/20 p-3">
      <h3 className="text-sm font-bold text-purple-300">🖼️ Upload new avatar</h3>
      <p className="mt-1 text-xs text-slate-400">
        Any square-ish photo works — it&apos;s auto-resized to 256×256.
      </p>
      <div className="mt-2 flex items-center gap-3">
        <label className="grid h-16 w-16 cursor-pointer place-items-center overflow-hidden rounded-full border border-slate-600 bg-slate-900 text-2xl">
          {image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={image} alt="preview" className="h-full w-full object-cover" />
          ) : (
            "＋"
          )}
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => onFile(e.target.files?.[0])}
          />
        </label>
        <div className="flex-1 space-y-2">
          <input
            placeholder="Avatar name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-lg border border-slate-600 bg-slate-900 px-2 py-1 text-sm"
          />
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400">Price 🪙</span>
            <input
              type="number"
              value={price}
              onChange={(e) => setPrice(Number(e.target.value))}
              className="w-24 rounded-lg border border-slate-600 bg-slate-900 px-2 py-1 text-sm"
            />
          </div>
        </div>
      </div>
      {err && <p className="mt-2 text-xs text-red-400">{err}</p>}
      <button
        onClick={() => {
          if (!name.trim()) return setErr("Enter a name");
          if (!image) return setErr("Choose an image");
          onCreate({ name, price, image });
          setName("");
          setImage("");
        }}
        className="mt-3 w-full rounded-lg bg-purple-500 py-2 text-sm font-bold text-white"
      >
        Add avatar to shop
      </button>
    </div>
  );
}

function AvatarAdminRow({
  a,
  onPrice,
  onSale,
  onClearSale,
  onDelete,
}: {
  a: CustomAvatarRow;
  onPrice: (price: number) => void;
  onSale: (pct: number, name: string, startMinutes: number, endMinutes: number, surprise: boolean) => void;
  onClearSale: () => void;
  onDelete: () => void;
}) {
  const [price, setPrice] = useState(a.price);
  const [pct, setPct] = useState(a.discountPercent);
  const [name, setName] = useState(a.discountName ?? "Launch Event");
  const [startMins, setStartMins] = useState(0);
  const [endMins, setEndMins] = useState(0);
  const [surprise, setSurprise] = useState(false);

  return (
    <div className="rounded-xl border border-slate-700 bg-slate-800/60 p-3">
      <div className="flex items-center gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={a.image} alt={a.name} className="h-12 w-12 rounded-full object-cover" />
        <div className="flex-1">
          <div className="text-sm font-bold">{a.name}</div>
          <div className="text-xs text-amber-300">
            {a.discountPercent > 0 ? (
              <>
                <span className="line-through">🪙 {a.price}</span>{" "}
                <span className="text-emerald-300">🪙 {a.effectivePrice}</span>{" "}
                <span className="text-emerald-300">({a.discountName} −{a.discountPercent}%)</span>
              </>
            ) : (
              <>🪙 {a.price}</>
            )}
          </div>
          {a.saleUpcoming && (
            <div className="text-[10px] text-sky-300">⏳ {a.upcomingName} −{a.upcomingPercent}% (scheduled)</div>
          )}
        </div>
        <button onClick={onDelete} className="text-xs text-red-400 underline">
          delete
        </button>
      </div>

      {/* price */}
      <div className="mt-2 flex items-center gap-2">
        <input type="number" value={price} onChange={(e) => setPrice(Number(e.target.value))} className="w-24 rounded-lg border border-slate-600 bg-slate-900 px-2 py-1 text-sm" />
        <button onClick={() => onPrice(price)} className="rounded-lg bg-amber-500 px-3 py-1 text-xs font-bold text-slate-950">
          Set price
        </button>
      </div>

      {/* scheduled sale */}
      <div className="mt-2 rounded-lg border border-emerald-700/30 bg-emerald-950/10 p-2">
        <p className="text-xs font-bold text-emerald-300">Sale / Launch event</p>
        <div className="mt-1 flex flex-wrap items-center gap-1">
          <input type="number" placeholder="% off" value={pct} onChange={(e) => setPct(Number(e.target.value))} className="w-14 rounded-lg border border-slate-600 bg-slate-900 px-2 py-1 text-xs" />
          <input placeholder="sale name" value={name} onChange={(e) => setName(e.target.value)} className="w-28 rounded-lg border border-slate-600 bg-slate-900 px-2 py-1 text-xs" />
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-1">
          <label className="text-[10px] text-slate-400">starts in</label>
          <input type="number" placeholder="0=now" value={startMins} onChange={(e) => setStartMins(Number(e.target.value))} className="w-16 rounded-lg border border-slate-600 bg-slate-900 px-2 py-1 text-xs" />
          <label className="text-[10px] text-slate-400">ends in</label>
          <input type="number" placeholder="0=∞" value={endMins} onChange={(e) => setEndMins(Number(e.target.value))} className="w-16 rounded-lg border border-slate-600 bg-slate-900 px-2 py-1 text-xs" />
          <span className="text-[10px] text-slate-500">min</span>
        </div>
        <label className="mt-1 flex items-center gap-2 text-xs text-slate-300">
          <input type="checkbox" checked={surprise} onChange={(e) => setSurprise(e.target.checked)} />
          🎁 Surprise launch (hide details until live)
        </label>
        <div className="mt-1 flex gap-2">
          <button onClick={() => onSale(pct, name, startMins, endMins, surprise)} className="flex-1 rounded-lg bg-emerald-500 py-1 text-xs font-bold text-slate-950">
            Schedule / Apply
          </button>
          <button onClick={onClearSale} className="rounded-lg bg-slate-700 px-3 py-1 text-xs font-bold">
            Clear
          </button>
        </div>
      </div>
    </div>
  );
}

/** Resize/crop an image file to a square dataURL (JPEG). */
function resizeImage(file: File, maxW: number, maxH: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("read error"));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("image error"));
      img.onload = () => {
        const side = Math.min(img.width, img.height);
        const sx = (img.width - side) / 2;
        const sy = (img.height - side) / 2;
        const canvas = document.createElement("canvas");
        canvas.width = maxW;
        canvas.height = maxH;
        const ctx = canvas.getContext("2d");
        if (!ctx) return reject(new Error("no ctx"));
        ctx.drawImage(img, sx, sy, side, side, 0, 0, maxW, maxH);
        resolve(canvas.toDataURL("image/jpeg", 0.82));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

function CreateRole({
  onCreate,
}: {
  onCreate: (f: { name: string; emoji: string; team: string; description: string }) => void;
}) {
  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState("❓");
  const [team, setTeam] = useState("town");
  const [desc, setDesc] = useState("");

  return (
    <div className="rounded-xl border border-purple-700/40 bg-purple-950/20 p-3">
      <h3 className="text-sm font-bold text-purple-300">➕ Add new role</h3>
      <div className="mt-2 space-y-2">
        <div className="flex gap-2">
          <input
            value={emoji}
            onChange={(e) => setEmoji(e.target.value)}
            className="w-14 rounded-lg border border-slate-600 bg-slate-900 px-2 py-1 text-center text-lg"
          />
          <input
            placeholder="Role name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="flex-1 rounded-lg border border-slate-600 bg-slate-900 px-2 py-1 text-sm"
          />
          <select
            value={team}
            onChange={(e) => setTeam(e.target.value)}
            className="rounded-lg border border-slate-600 bg-slate-900 px-2 py-1 text-sm"
          >
            <option value="town">Town</option>
            <option value="mafia">Mafia</option>
            <option value="neutral">Neutral</option>
          </select>
        </div>
        <input
          placeholder="Description"
          value={desc}
          onChange={(e) => setDesc(e.target.value)}
          className="w-full rounded-lg border border-slate-600 bg-slate-900 px-2 py-1 text-sm"
        />
        <button
          onClick={() => {
            if (!name.trim()) return;
            onCreate({ name, emoji, team, description: desc });
            setName("");
            setDesc("");
          }}
          className="w-full rounded-lg bg-purple-500 py-2 text-sm font-bold text-white"
        >
          Create role
        </button>
      </div>
    </div>
  );
}
