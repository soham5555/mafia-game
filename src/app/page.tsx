"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { ROLE_LIST } from "@/lib/roles";
import { AVATAR_SHOP, DEFAULT_AVATARS } from "@/lib/shop";
import { initAudio, startMusic } from "@/lib/sound";
import { Notifications } from "@/components/Notifications";
import { AdminPanel } from "@/components/AdminPanel";
import { AvatarView } from "@/components/AvatarView";
import { LaunchTicker } from "@/components/LaunchTicker";
import { ProfileModal } from "@/components/ProfileModal";

interface CustomAvatar {
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
  saleStartsAt: string | null;
  saleEndsAt: string | null;
}

interface Me {
  username: string;
  coins: number;
  approved: boolean;
  isAdmin: boolean;
  inventory: Record<string, number>;
  avatar: string;
  ownedAvatars: string[];
  profilePublic?: boolean;
  ban?: { banned: boolean; until: string | null; reason: string | null };
}
interface Pending {
  id: number;
  username: string;
}
interface Member {
  id: number;
  username: string;
  approved: boolean;
  coins: number;
  banned: boolean;
  bannedUntil: string | null;
  avatar: string;
}
interface Friend {
  relId: number;
  id: number;
  username: string;
  avatar: string;
}
type FriendReq = Friend;
interface SearchResult extends Friend {
  status: string;
}

type Panel = "none" | "shop" | "friends" | "settings" | "roles" | "profile" | "world" | "history";

interface PublicRoom {
  code: string;
  hostName: string;
  playerCount: number;
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
  sellValue: number;
  custom: boolean;
  saleUpcoming: boolean;
  upcomingName: string | null;
  upcomingPercent: number;
}
interface HistoryRow {
  id: number;
  roomCode: string;
  role: string | null;
  team: string | null;
  result: string;
  createdAt: string;
}

export default function HomePage() {
  const router = useRouter();
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [me, setMe] = useState<Me | null>(null);
  const [activeGame, setActiveGame] = useState<{ code: string; roomToken: string } | null>(null);
  const [pending, setPending] = useState<Pending[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [mode, setMode] = useState<"login" | "register">("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const [panel, setPanel] = useState<Panel>("none");
  const [makePublic, setMakePublic] = useState(false);
  const [shopData, setShopData] = useState<EffItem[]>([]);
  const [publicRooms, setPublicRooms] = useState<PublicRoom[]>([]);
  const [worldQ, setWorldQ] = useState("");
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [stats, setStats] = useState<{ wins: number; losses: number }>({ wins: 0, losses: 0 });
  const [siteTexts, setSiteTexts] = useState<Record<string, string>>({});
  const [customAvatars, setCustomAvatars] = useState<CustomAvatar[]>([]);
  const [viewProfile, setViewProfile] = useState<string | null>(null);
  const [visitors, setVisitors] = useState<{ username: string; avatar: string; at: string }[]>([]);
  const [cpCurrent, setCpCurrent] = useState("");
  const [cpNew, setCpNew] = useState("");
  const [cpConfirm, setCpConfirm] = useState("");
  const [cpError, setCpError] = useState("");
  const [cpSuccess, setCpSuccess] = useState("");
  const [cpBusy, setCpBusy] = useState(false);

  useEffect(() => {
    fetch("/api/texts")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d?.texts && setSiteTexts(d.texts))
      .catch(() => {});
  }, []);

  const loadAvatars = useCallback(() => {
    fetch("/api/avatars")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d?.avatars && setCustomAvatars(d.avatars))
      .catch(() => {});
  }, []);
  useEffect(() => {
    loadAvatars();
  }, [loadAvatars]);

  const T = (key: string, fallback: string) => siteTexts[key] ?? fallback;
  const avatarMap: Record<string, string> = Object.fromEntries(
    customAvatars.map((a) => [a.key, a.image])
  );
  const [shopTab, setShopTab] = useState<"items" | "avatars" | "inventory">("items");

  // friends state
  const [friends, setFriends] = useState<Friend[]>([]);
  const [incoming, setIncoming] = useState<FriendReq[]>([]);
  const [outgoing, setOutgoing] = useState<FriendReq[]>([]);
  const [searchQ, setSearchQ] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);

  const loadMe = useCallback(async (token: string) => {
    const res = await fetch(`/api/auth/me?token=${token}`);
    if (!res.ok) {
      localStorage.removeItem("mafia:auth");
      setAuthToken(null);
      setMe(null);
      return;
    }
    const data = await safeJson(res);
    setMe(data.user as Me);
    setActiveGame((data.activeGame as typeof activeGame) ?? null);
    setPending((data.pending as Pending[]) ?? []);
    setMembers((data.members as Member[]) ?? []);
  }, []);

  const loadFriends = useCallback(async (token: string) => {
    const res = await fetch(`/api/friends?token=${token}`);
    if (!res.ok) return;
    const data = await res.json();
    setFriends(data.friends ?? []);
    setIncoming(data.incoming ?? []);
    setOutgoing(data.outgoing ?? []);
  }, []);

  useEffect(() => {
    const t = localStorage.getItem("mafia:auth");
    if (t) {
      setAuthToken(t);
      loadMe(t);
      loadFriends(t);
    }
  }, [loadMe, loadFriends]);

  useEffect(() => {
    if (!authToken) return;
    const id = setInterval(() => {
      loadMe(authToken);
      loadFriends(authToken);
    }, 5000);
    return () => clearInterval(id);
  }, [authToken, loadMe, loadFriends]);

  async function auth() {
    if (!username.trim() || !password) return setError("Enter username and password");
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/auth/${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await safeJson(res);
      if (!res.ok) throw new Error((data.error as string) || "Failed");
      const tok = data.token as string;
      localStorage.setItem("mafia:auth", tok);
      setAuthToken(tok);
      setMe(data.user as Me);
      await loadMe(tok);
      await loadFriends(tok);
      setPassword("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  function logout() {
    localStorage.removeItem("mafia:auth");
    setAuthToken(null);
    setMe(null);
    setActiveGame(null);
    setPanel("none");
  }

  function resumeGame() {
    if (!activeGame) return;
    initAudio();
    startMusic();
    localStorage.setItem(`mafia:${activeGame.code}:token`, activeGame.roomToken);
    router.push(`/room/${activeGame.code}`);
  }

  async function leaveActiveGame() {
    if (!activeGame) return;
    if (!confirm("Leave the game? You'll be eliminated and lose coins.")) return;
    setBusy(true);
    try {
      await fetch(`/api/rooms/${activeGame.code}/leave`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: activeGame.roomToken }),
      });
      localStorage.removeItem(`mafia:${activeGame.code}:token`);
      setActiveGame(null);
      if (authToken) await loadMe(authToken);
    } finally {
      setBusy(false);
    }
  }

  async function createRoom() {
    initAudio();
    startMusic();
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ authToken, isPublic: makePublic }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      localStorage.setItem(`mafia:${data.code}:token`, data.token);
      router.push(`/room/${data.code}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
      setBusy(false);
    }
  }

  async function joinRoom(joinCode?: string) {
    const c = (joinCode ?? code).toUpperCase();
    if (!c.trim()) return setError("Enter a room code");
    initAudio();
    startMusic();
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/rooms/${c}/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ authToken }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      localStorage.setItem(`mafia:${data.code}:token`, data.token);
      router.push(`/room/${data.code}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
      setBusy(false);
    }
  }

  async function buy(itemKey: string, kind: "item" | "avatar") {
    setError("");
    setMsg("");
    const res = await fetch("/api/shop/buy", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ authToken, itemKey, kind }),
    });
    const data = await res.json();
    if (!res.ok) setError(data.error || "Purchase failed");
    else if (authToken) loadMe(authToken);
  }

  async function sell(itemKey: string) {
    setError("");
    const res = await fetch("/api/shop/sell", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ authToken, itemKey }),
    });
    const data = await res.json();
    if (!res.ok) setError(data.error || "Sell failed");
    else if (authToken) loadMe(authToken);
  }

  async function selectAvatar(avatar: string) {
    const res = await fetch("/api/profile/avatar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ authToken, avatar }),
    });
    if (res.ok && authToken) loadMe(authToken);
  }

  async function decide(targetId: number, decision: "yes" | "no") {
    await fetch("/api/admin/approve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ authToken, targetId, decision }),
    });
    if (authToken) loadMe(authToken);
  }

  const loadShop = useCallback(async () => {
    const res = await fetch("/api/shop");
    if (!res.ok) return;
    const data = await res.json();
    setShopData(data.items ?? []);
  }, []);

  useEffect(() => {
    if (panel === "shop") {
      loadShop();
      loadAvatars();
    }
    if (panel === "profile") loadAvatars();
  }, [panel, loadShop, loadAvatars]);

  const loadPublicRooms = useCallback(async (q: string) => {
    const res = await fetch(`/api/rooms/public?q=${encodeURIComponent(q)}`);
    if (!res.ok) return;
    const data = await res.json();
    setPublicRooms(data.rooms ?? []);
  }, []);

  const loadHistory = useCallback(async (token: string) => {
    const res = await fetch(`/api/history?token=${token}`);
    if (!res.ok) return;
    const data = await res.json();
    setHistory(data.history ?? []);
    setStats({ wins: data.wins ?? 0, losses: data.losses ?? 0 });
  }, []);

  // Auto-refresh world games list while the panel is open.
  useEffect(() => {
    if (panel !== "world") return;
    loadPublicRooms(worldQ);
    const id = setInterval(() => loadPublicRooms(worldQ), 4000);
    return () => clearInterval(id);
  }, [panel, worldQ, loadPublicRooms]);

  useEffect(() => {
    if (panel === "history" && authToken) loadHistory(authToken);
  }, [panel, authToken, loadHistory]);

  const loadVisitors = useCallback(async (token: string) => {
    const res = await fetch(`/api/profile/visits?token=${token}`);
    if (res.ok) setVisitors((await res.json()).visitors ?? []);
  }, []);
  useEffect(() => {
    if (panel === "profile" && authToken) loadVisitors(authToken);
  }, [panel, authToken, loadVisitors]);

  async function setProfilePrivacy(isPublic: boolean) {
    await fetch("/api/profile/privacy", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ authToken, isPublic }),
    });
    if (authToken) loadMe(authToken);
  }

  async function changePassword() {
    if (!authToken) return;
    setCpError("");
    setCpSuccess("");
    if (!cpCurrent || !cpNew || !cpConfirm) return setCpError("All fields are required.");
    if (cpNew !== cpConfirm) return setCpError("New passwords do not match.");
    if (cpNew.length < 4) return setCpError("New password must be at least 4 characters.");
    setCpBusy(true);
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: authToken, currentPassword: cpCurrent, newPassword: cpNew }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to change password.");

      // The server has invalidated the old session and returned a new token.
      // Update local storage and app state with the new token so the user
      // stays logged in on THIS device, then briefly show success before logout.
      const newToken = data.newToken as string | undefined;
      if (newToken) {
        localStorage.setItem("mafia:auth", newToken);
        setAuthToken(newToken);
        await loadMe(newToken);
      }

      setCpSuccess(
        "✅ Password changed! All other sessions have been logged out. You'll stay logged in here."
      );
      setCpCurrent("");
      setCpNew("");
      setCpConfirm("");
    } catch (e) {
      setCpError(e instanceof Error ? e.message : "Failed.");
    } finally {
      setCpBusy(false);
    }
  }

  // ---- friends actions ----
  async function search() {
    if (!searchQ.trim()) return setResults([]);
    const res = await fetch("/api/friends", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: authToken, query: searchQ }),
    });
    const data = await res.json();
    setResults(data.results ?? []);
  }

  async function sendRequest(targetId: number) {
    await fetch("/api/friends/request", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: authToken, targetId }),
    });
    if (authToken) loadFriends(authToken);
    search();
  }

  async function sendRequestByName(username: string) {
    await fetch("/api/friends/request", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: authToken, username }),
    });
    if (authToken) loadFriends(authToken);
  }

  async function respond(relId: number, decision: "accept" | "decline" | "remove") {
    await fetch("/api/friends/respond", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: authToken, relId, decision }),
    });
    if (authToken) loadFriends(authToken);
  }

  async function inviteFriend(targetId: number) {
    setError("");
    setMsg("");
    const res = await fetch("/api/friends/invite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: authToken, targetId }),
    });
    const data = await res.json();
    if (!res.ok) setError(data.error || "Invite failed");
    else setMsg(`Invite sent (room ${data.code})`);
  }

  const groups = {
    town: ROLE_LIST.filter((r) => r.team === "town"),
    mafia: ROLE_LIST.filter((r) => r.team === "mafia"),
    neutral: ROLE_LIST.filter((r) => r.team === "neutral"),
  };
  const ownedAvatarList = me ? [...DEFAULT_AVATARS, ...(me.ownedAvatars ?? [])] : [];

  function togglePanel(p: Panel) {
    setPanel((cur) => (cur === p ? "none" : p));
    setError("");
    setMsg("");
  }

  // Build the background style based on admin setting stored in siteTexts.
  const bgType = siteTexts["bg_type"] ?? "gradient";
  const bgColor = siteTexts["bg_color"] ?? "";
  const bgGifUrl = siteTexts["bg_gif_url"] ?? "";

  const mainStyle: React.CSSProperties =
    bgType === "gif" && bgGifUrl
      ? {
          backgroundImage: `url(${bgGifUrl})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundRepeat: "no-repeat",
          backgroundAttachment: "fixed",
        }
      : bgType === "color" && bgColor
      ? { backgroundColor: bgColor }
      : {};

  const mainClassName =
    bgType === "gradient" || (!bgGifUrl && bgType === "gif") || (!bgColor && bgType === "color")
      ? "min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-black text-slate-100"
      : "min-h-screen text-slate-100";

  return (
    <main className={mainClassName} style={mainStyle}>
      <div className="mx-auto flex min-h-screen max-w-lg flex-col px-5 py-8">
        <header className="text-center">
          <div className="text-6xl">🕵️‍♂️</div>
          <h1 className="mt-2 text-4xl font-black tracking-tight text-amber-400">
            {T("title", "MAFIA: The City")}
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            {T("tagline", "Commissioner Cattani vs. The Mob — real-time social deduction")}
          </p>
        </header>

        {/* ---- NOT LOGGED IN ---- */}
        {!me && (
          <section className="mt-8 rounded-3xl border border-slate-700 bg-slate-800/60 p-6 shadow-2xl">
            <div className="mb-4 flex rounded-xl bg-slate-900 p-1">
              {(["login", "register"] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => {
                    setMode(m);
                    setError("");
                  }}
                  className={`flex-1 rounded-lg py-2 text-sm font-bold ${
                    mode === m ? "bg-amber-500 text-slate-950" : "text-slate-400"
                  }`}
                >
                  {m === "login" ? "Sign In" : "Create Account"}
                </button>
              ))}
            </div>
            <label className="text-xs font-semibold uppercase text-slate-400">Username</label>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              maxLength={20}
              className="mt-1 w-full rounded-xl border border-slate-600 bg-slate-900 px-4 py-3 outline-none focus:border-amber-400"
            />
            <label className="mt-3 block text-xs font-semibold uppercase text-slate-400">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && auth()}
              className="mt-1 w-full rounded-xl border border-slate-600 bg-slate-900 px-4 py-3 outline-none focus:border-amber-400"
            />
            <button
              onClick={auth}
              disabled={busy}
              className="mt-4 w-full rounded-xl bg-amber-500 py-3 text-lg font-bold text-slate-950 disabled:opacity-50"
            >
              {mode === "login" ? "Sign In" : "Create Account"}
            </button>
            {mode === "register" && (
              <p className="mt-3 text-center text-xs text-slate-500">
                New accounts must be approved by the admin before you can play.
              </p>
            )}
            {error && <ErrBox msg={error} />}
          </section>
        )}

        {/* ---- LOGGED IN ---- */}
        {me && authToken && (
          <>
            <section className="mt-6 flex items-center justify-between rounded-2xl border border-slate-700 bg-slate-800/60 px-4 py-3">
              <button
                onClick={() => togglePanel("profile")}
                className="flex items-center gap-3 text-left"
              >
                <span className="grid h-11 w-11 place-items-center overflow-hidden rounded-full bg-slate-700 text-2xl">
                  <AvatarView value={me.avatar} map={avatarMap} size="2.75rem" />
                </span>
                <span>
                  <span className="block font-black">
                    {me.username}{" "}
                    {me.isAdmin && <span className="text-xs text-amber-400">ADMIN</span>}
                  </span>
                  <span className="block text-sm text-amber-300">🪙 {me.coins} coins</span>
                </span>
              </button>
              <div className="flex items-center gap-2">
                <Notifications authToken={authToken} />
                <button onClick={logout} className="text-xs text-slate-400 underline">
                  Log out
                </button>
              </div>
            </section>

            {me.ban?.banned && (
              <div className="mt-6 rounded-2xl border border-red-700/60 bg-red-950/40 p-6 text-center">
                <div className="text-4xl">⛔</div>
                <p className="mt-2 text-lg font-black text-red-300">You are banned</p>
                <p className="mt-1 text-sm text-slate-300">
                  {me.ban.reason || "Violation of rules"}
                </p>
                <p className="mt-2 text-sm text-slate-400">
                  {me.ban.until
                    ? `Ban lifts: ${new Date(me.ban.until).toLocaleString()}`
                    : "This ban is permanent until an admin lifts it."}
                </p>
                <p className="mt-3 text-xs text-slate-500">
                  All features (games, shop, friends) are disabled while banned.
                </p>
              </div>
            )}

            {!me.ban?.banned && activeGame && (
              <div className="mt-4 rounded-2xl border border-emerald-600/60 bg-emerald-900/30 p-4 text-center">
                <p className="font-bold text-emerald-300">
                  🎮 You have a game in progress ({activeGame.code})
                </p>
                <p className="mt-1 text-xs text-slate-400">
                  Rejoin within 30 seconds of leaving or you&apos;ll be eliminated.
                </p>
                <div className="mt-3 flex gap-2">
                  <button
                    onClick={resumeGame}
                    disabled={busy}
                    className="flex-1 rounded-xl bg-emerald-500 py-3 font-black text-slate-950 disabled:opacity-50"
                  >
                    ▶ Resume Game
                  </button>
                  <button
                    onClick={leaveActiveGame}
                    disabled={busy}
                    className="flex-1 rounded-xl border border-red-500/60 bg-red-500/15 py-3 font-bold text-red-300 disabled:opacity-50"
                  >
                    🚪 Leave Game
                  </button>
                </div>
              </div>
            )}

            {me.ban?.banned ? null : !me.approved && !me.isAdmin ? (
              <div className="mt-6 rounded-2xl border border-yellow-700/50 bg-yellow-950/30 p-5 text-center">
                <div className="text-3xl">⏳</div>
                <p className="mt-2 font-bold text-yellow-300">Awaiting admin approval</p>
                <p className="mt-1 text-sm text-slate-400">
                  The admin (SOHAM) must approve your account before you can create or join games.
                </p>
              </div>
            ) : (
              <section className="mt-6 rounded-3xl border border-slate-700 bg-slate-800/60 p-6 shadow-2xl">
                {/* Public / Private toggle */}
                <div className="mb-3 flex rounded-xl bg-slate-900 p-1">
                  <button
                    onClick={() => setMakePublic(false)}
                    className={`flex-1 rounded-lg py-2 text-sm font-bold ${
                      !makePublic ? "bg-amber-500 text-slate-950" : "text-slate-400"
                    }`}
                  >
                    🔒 Private
                  </button>
                  <button
                    onClick={() => setMakePublic(true)}
                    className={`flex-1 rounded-lg py-2 text-sm font-bold ${
                      makePublic ? "bg-amber-500 text-slate-950" : "text-slate-400"
                    }`}
                  >
                    🌍 Public
                  </button>
                </div>
                <p className="mb-3 text-center text-xs text-slate-500">
                  {makePublic
                    ? "Anyone can find your room in World Games by your username or code."
                    : "Only people with the room code can join."}
                </p>
                <button
                  onClick={createRoom}
                  disabled={busy}
                  className="w-full rounded-xl bg-amber-500 py-3 text-lg font-bold text-slate-950 disabled:opacity-50"
                >
                  Create {makePublic ? "Public" : "Private"} Game
                </button>
                <div className="my-4 flex items-center gap-3 text-xs text-slate-500">
                  <div className="h-px flex-1 bg-slate-700" />
                  OR JOIN
                  <div className="h-px flex-1 bg-slate-700" />
                </div>
                <div className="flex gap-2">
                  <input
                    value={code}
                    onChange={(e) => setCode(e.target.value.toUpperCase())}
                    maxLength={5}
                    placeholder="CODE"
                    className="w-32 rounded-xl border border-slate-600 bg-slate-900 px-4 py-3 text-center font-mono text-lg tracking-widest outline-none focus:border-amber-400"
                  />
                  <button
                    onClick={() => joinRoom()}
                    disabled={busy}
                    className="flex-1 rounded-xl border border-slate-500 bg-slate-700 py-3 text-lg font-bold disabled:opacity-50"
                  >
                    Join Game
                  </button>
                </div>
                {error && <ErrBox msg={error} />}
              </section>
            )}

            {/* Launch events / sales ticker with live countdown */}
            {!me.ban?.banned && (
              <LaunchTicker onOpenShop={() => setPanel("shop")} />
            )}

            {/* Nav buttons */}
            {!me.ban?.banned && (
            <div className="mt-4 grid grid-cols-4 gap-2">
              <PanelBtn label="🌍 World" onClick={() => togglePanel("world")} active={panel === "world"} />
              <PanelBtn label="🛒 Shop" onClick={() => togglePanel("shop")} active={panel === "shop"} />
              <PanelBtn
                label={`👥 Friends${incoming.length ? ` (${incoming.length})` : ""}`}
                onClick={() => togglePanel("friends")}
                active={panel === "friends"}
              />
              <PanelBtn label="📊 History" onClick={() => togglePanel("history")} active={panel === "history"} />
              <PanelBtn label="📜 Roles" onClick={() => togglePanel("roles")} active={panel === "roles"} />
              {me.isAdmin && (
                <PanelBtn
                  label="⚙️ Admin"
                  onClick={() => togglePanel("settings")}
                  active={panel === "settings"}
                />
              )}
            </div>
            )}

            {/* WORLD GAMES */}
            {panel === "world" && (
              <div className="mt-4 rounded-2xl border border-slate-700 bg-slate-800/60 p-4">
                <h3 className="text-sm font-bold uppercase text-amber-400">🌍 World Games (Public)</h3>
                <div className="mt-2 flex gap-2">
                  <input
                    value={worldQ}
                    onChange={(e) => setWorldQ(e.target.value)}
                    placeholder="Search by host username or code…"
                    className="flex-1 rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-sm outline-none focus:border-amber-400"
                  />
                </div>
                <div className="mt-3 space-y-2">
                  {publicRooms.length === 0 ? (
                    <p className="py-4 text-center text-sm text-slate-500">
                      No public games right now. Create one with the 🌍 Public option!
                    </p>
                  ) : (
                    publicRooms.map((r) => (
                      <div
                        key={r.code}
                        className="flex items-center justify-between rounded-lg border border-slate-700 bg-slate-900/50 px-3 py-2"
                      >
                        <span className="text-sm">
                          <button onClick={() => setViewProfile(r.hostName)} className="font-bold text-amber-300 underline">
                            {r.hostName}
                          </button>
                          &apos;s room
                          <span className="ml-2 font-mono text-xs text-slate-400">{r.code}</span>
                          <span className="ml-2 text-xs text-slate-500">👥 {r.playerCount}</span>
                        </span>
                        <button
                          onClick={() => joinRoom(r.code)}
                          disabled={busy}
                          className="rounded-lg bg-amber-500 px-3 py-1 text-xs font-bold text-slate-950 disabled:opacity-50"
                        >
                          Join
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* MATCH HISTORY */}
            {panel === "history" && (
              <div className="mt-4 rounded-2xl border border-slate-700 bg-slate-800/60 p-4">
                <h3 className="text-sm font-bold uppercase text-amber-400">📊 Match History</h3>
                <div className="mt-2 flex gap-3 text-sm">
                  <span className="rounded-lg bg-emerald-900/40 px-3 py-1 font-bold text-emerald-300">
                    🏆 {stats.wins} Wins
                  </span>
                  <span className="rounded-lg bg-red-900/40 px-3 py-1 font-bold text-red-300">
                    😔 {stats.losses} Losses
                  </span>
                </div>
                <div className="mt-3 space-y-2">
                  {history.length === 0 ? (
                    <p className="py-4 text-center text-sm text-slate-500">
                      No matches played yet. Win some games!
                    </p>
                  ) : (
                    history.map((h) => (
                      <div
                        key={h.id}
                        className={`flex items-center justify-between rounded-lg border px-3 py-2 text-sm ${
                          h.result === "win"
                            ? "border-emerald-700/50 bg-emerald-900/20"
                            : "border-red-700/50 bg-red-900/20"
                        }`}
                      >
                        <span>
                          <span className="font-bold">
                            {h.result === "win" ? "🏆 WIN" : "😔 LOSS"}
                          </span>
                          <span className="ml-2 text-xs text-slate-400">
                            as {h.role ?? "?"} ({h.team ?? "?"})
                          </span>
                        </span>
                        <span className="font-mono text-xs text-slate-500">{h.roomCode}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* PROFILE / AVATAR */}
            {panel === "profile" && (
              <div className="mt-4 rounded-2xl border border-slate-700 bg-slate-800/60 p-4">
                <h3 className="text-sm font-bold uppercase text-amber-400">Choose your avatar</h3>
                <div className="mt-3 grid grid-cols-6 gap-2">
                  {ownedAvatarList.map((a) => (
                    <button
                      key={a}
                      onClick={() => selectAvatar(a)}
                      className={`grid aspect-square place-items-center overflow-hidden rounded-xl border ${
                        me.avatar === a
                          ? "border-amber-400 bg-amber-500/20"
                          : "border-slate-600 bg-slate-900"
                      }`}
                    >
                      <AvatarView value={a} map={avatarMap} size="1.9rem" />
                    </button>
                  ))}
                </div>
                <p className="mt-3 text-xs text-slate-500">
                  Unlock more avatars in the Shop → Avatars tab.
                </p>

                {/* Privacy toggle */}
                <div className="mt-4 border-t border-slate-700 pt-4">
                  <h3 className="text-sm font-bold uppercase text-amber-400">Profile privacy</h3>
                  <div className="mt-2 flex rounded-xl bg-slate-900 p-1">
                    <button
                      onClick={() => setProfilePrivacy(true)}
                      className={`flex-1 rounded-lg py-2 text-sm font-bold ${
                        me.profilePublic ? "bg-amber-500 text-slate-950" : "text-slate-400"
                      }`}
                    >
                      🌍 Public
                    </button>
                    <button
                      onClick={() => setProfilePrivacy(false)}
                      className={`flex-1 rounded-lg py-2 text-sm font-bold ${
                        !me.profilePublic ? "bg-amber-500 text-slate-950" : "text-slate-400"
                      }`}
                    >
                      🔒 Friends only
                    </button>
                  </div>
                  <p className="mt-2 text-xs text-slate-500">
                    {me.profilePublic
                      ? "Anyone can see your wins, losses & achievements."
                      : "Only friends can see your achievements."}
                  </p>
                  <button
                    onClick={() => setViewProfile(me.username)}
                    className="mt-2 w-full rounded-lg border border-slate-600 py-2 text-sm font-bold text-slate-300"
                  >
                    👁️ View my public profile
                  </button>
                </div>

                {/* Visitors */}
                <div className="mt-4 border-t border-slate-700 pt-4">
                  <h3 className="text-sm font-bold uppercase text-amber-400">
                    Profile visits ({visitors.length})
                  </h3>
                  {visitors.length === 0 ? (
                    <p className="mt-2 text-xs text-slate-500">No visitors yet.</p>
                  ) : (
                    <div className="mt-2 space-y-1">
                      {visitors.map((v) => (
                        <button
                          key={v.username + v.at}
                          onClick={() => setViewProfile(v.username)}
                          className="flex w-full items-center gap-2 rounded-lg border border-slate-700 bg-slate-900/50 px-3 py-1.5 text-left text-sm"
                        >
                          <AvatarView value={v.avatar} map={avatarMap} size="1.25rem" className="overflow-hidden rounded-full" />
                          <span>{v.username}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* CHANGE PASSWORD */}
                <div className="mt-4 border-t border-slate-700 pt-4">
                  <h3 className="text-sm font-bold uppercase text-amber-400">🔑 Change Password</h3>
                  <div className="mt-3 space-y-2">
                    <input
                      type="password"
                      placeholder="Current password"
                      value={cpCurrent}
                      onChange={(e) => setCpCurrent(e.target.value)}
                      className="w-full rounded-xl border border-slate-600 bg-slate-900 px-4 py-2 text-sm outline-none focus:border-amber-400"
                    />
                    <input
                      type="password"
                      placeholder="New password"
                      value={cpNew}
                      onChange={(e) => setCpNew(e.target.value)}
                      className="w-full rounded-xl border border-slate-600 bg-slate-900 px-4 py-2 text-sm outline-none focus:border-amber-400"
                    />
                    <input
                      type="password"
                      placeholder="Confirm new password"
                      value={cpConfirm}
                      onChange={(e) => setCpConfirm(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && changePassword()}
                      className="w-full rounded-xl border border-slate-600 bg-slate-900 px-4 py-2 text-sm outline-none focus:border-amber-400"
                    />
                    {cpError && (
                      <p className="rounded-lg bg-red-500/20 px-3 py-2 text-sm text-red-300">{cpError}</p>
                    )}
                    {cpSuccess && (
                      <p className="rounded-lg bg-emerald-500/20 px-3 py-2 text-sm text-emerald-300">{cpSuccess}</p>
                    )}
                    <button
                      onClick={changePassword}
                      disabled={cpBusy}
                      className="w-full rounded-xl bg-amber-500 py-2 text-sm font-bold text-slate-950 disabled:opacity-50"
                    >
                      {cpBusy ? "Changing…" : "Change Password"}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* SHOP */}
            {panel === "shop" && (
              <div className="mt-4">
                <div className="mb-3 flex rounded-xl bg-slate-900 p-1">
                  {(["items", "avatars", "inventory"] as const).map((t) => (
                    <button
                      key={t}
                      onClick={() => setShopTab(t)}
                      className={`flex-1 rounded-lg py-2 text-sm font-bold capitalize ${
                        shopTab === t ? "bg-amber-500 text-slate-950" : "text-slate-400"
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
                <p className="mb-2 text-sm text-amber-300">🪙 {me.coins} coins</p>
                {msg && <p className="mb-2 rounded-lg bg-emerald-500/20 px-3 py-2 text-sm text-emerald-300">{msg}</p>}
                {error && <ErrBox msg={error} />}

                {shopTab === "items" && (
                  <div className="space-y-3">
                    {shopData.map((item) => (
                      <div key={item.key} className="rounded-xl border border-slate-700 bg-slate-800/60 p-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 font-bold">
                            <span className="text-2xl">{item.emoji}</span>
                            {item.name}
                          </div>
                          <span className="text-right text-sm">
                            {item.discountPercent > 0 ? (
                              <>
                                <span className="mr-1 text-slate-500 line-through">🪙 {item.price}</span>
                                <span className="font-bold text-emerald-300">🪙 {item.effectivePrice}</span>
                              </>
                            ) : (
                              <span className="text-amber-300">🪙 {item.effectivePrice}</span>
                            )}
                          </span>
                        </div>
                        {item.discountPercent > 0 && (
                          <span className="mt-1 inline-block rounded-full bg-emerald-600/30 px-2 py-0.5 text-xs font-bold text-emerald-300">
                            🔖 {item.discountName} −{item.discountPercent}%
                          </span>
                        )}
                        {item.saleUpcoming && (
                          <span className="mt-1 inline-block rounded-full bg-sky-600/30 px-2 py-0.5 text-xs font-bold text-sky-300">
                            ⏳ {item.upcomingName} coming soon −{item.upcomingPercent}%
                          </span>
                        )}
                        <p className="mt-1 text-xs text-slate-400">{item.description}</p>
                        <div className="mt-2 flex items-center justify-between">
                          <span className="text-xs text-slate-500">Owned: {me.inventory[item.key] ?? 0}</span>
                          <button
                            onClick={() => buy(item.key, "item")}
                            disabled={me.coins < item.effectivePrice}
                            className="rounded-lg bg-amber-500 px-4 py-1.5 text-sm font-bold text-slate-950 disabled:opacity-40"
                          >
                            Buy
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {shopTab === "avatars" && (
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      ...AVATAR_SHOP.map((a) => ({
                        key: a.key, name: a.name, emoji: a.emoji, image: "", price: a.price,
                        effectivePrice: a.price, discountPercent: 0, discountName: null as string | null,
                        saleUpcoming: false, upcomingName: null as string | null, upcomingPercent: 0,
                        saleEndsAt: null as string | null, saleStartsAt: null as string | null,
                      })),
                      ...customAvatars.map((a) => ({ ...a, emoji: "" })),
                    ].map((av) => {
                      const owned = (me.ownedAvatars ?? []).includes(av.key);
                      return (
                        <div key={av.key} className="rounded-xl border border-slate-700 bg-slate-800/60 p-3 text-center">
                          <div className="flex h-14 items-center justify-center">
                            <AvatarView value={av.image ? av.key : av.emoji} map={avatarMap} size="3rem" />
                          </div>
                          <div className="mt-1 text-sm font-bold">{av.name}</div>
                          {av.discountPercent > 0 && (
                            <span className="mt-1 inline-block rounded-full bg-emerald-600/30 px-2 py-0.5 text-[10px] font-bold text-emerald-300">
                              🔖 {av.discountName} −{av.discountPercent}%
                            </span>
                          )}
                          {av.saleUpcoming && (
                            <span className="mt-1 inline-block rounded-full bg-sky-600/30 px-2 py-0.5 text-[10px] font-bold text-sky-300">
                              ⏳ {av.upcomingName} soon −{av.upcomingPercent}%
                            </span>
                          )}
                          {owned ? (
                            <button
                              onClick={() => selectAvatar(av.key)}
                              className="mt-2 w-full rounded-lg border border-emerald-500 py-1.5 text-xs font-bold text-emerald-300"
                            >
                              {me.avatar === av.key ? "Selected" : "Use"}
                            </button>
                          ) : (
                            <button
                              onClick={() => buy(av.key, "avatar")}
                              disabled={me.coins < av.effectivePrice}
                              className="mt-2 w-full rounded-lg bg-amber-500 py-1.5 text-xs font-bold text-slate-950 disabled:opacity-40"
                            >
                              {av.discountPercent > 0 ? (
                                <>
                                  <span className="mr-1 text-slate-700 line-through">🪙 {av.price}</span>
                                  🪙 {av.effectivePrice}
                                </>
                              ) : (
                                <>🪙 {av.effectivePrice}</>
                              )}
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {shopTab === "inventory" && (
                  <div className="space-y-3">
                    {Object.keys(me.inventory).filter((k) => (me.inventory[k] ?? 0) > 0).length === 0 ? (
                      <p className="py-6 text-center text-sm text-slate-500">
                        Your inventory is empty. Buy items to see them here.
                      </p>
                    ) : (
                      shopData.filter((it) => (me.inventory[it.key] ?? 0) > 0).map((it) => (
                        <div key={it.key} className="rounded-xl border border-slate-700 bg-slate-800/60 p-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 font-bold">
                              <span className="text-2xl">{it.emoji}</span>
                              {it.name}
                              <span className="text-xs text-slate-500">x{me.inventory[it.key]}</span>
                            </div>
                          </div>
                          <div className="mt-2 flex items-center justify-between">
                            <span className="text-xs text-slate-500">
                              Sells for 🪙 {it.sellValue} (70% of {it.price})
                            </span>
                            <button
                              onClick={() => sell(it.key)}
                              className="rounded-lg border border-amber-500 bg-amber-500/15 px-4 py-1.5 text-sm font-bold text-amber-300"
                            >
                              Sell
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            )}

            {/* FRIENDS */}
            {panel === "friends" && (
              <div className="mt-4 space-y-4">
                {msg && <p className="rounded-lg bg-emerald-500/20 px-3 py-2 text-sm text-emerald-300">{msg}</p>}
                {error && <ErrBox msg={error} />}

                {/* Search */}
                <div className="rounded-2xl border border-slate-700 bg-slate-800/60 p-4">
                  <h3 className="text-sm font-bold uppercase text-amber-400">Find players</h3>
                  <div className="mt-2 flex gap-2">
                    <input
                      value={searchQ}
                      onChange={(e) => setSearchQ(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && search()}
                      placeholder="Search username…"
                      className="flex-1 rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-sm outline-none focus:border-amber-400"
                    />
                    <button onClick={search} className="rounded-lg bg-amber-500 px-4 font-bold text-slate-950">
                      Search
                    </button>
                  </div>
                  <div className="mt-3 space-y-2">
                    {results.map((r) => (
                      <div key={r.id} className="flex items-center justify-between rounded-lg border border-slate-700 bg-slate-900/50 px-3 py-2">
                        <span className="flex items-center gap-2 text-sm">
                          <span className="text-xl">{r.avatar}</span>
                          {r.username}
                        </span>
                        {r.status === "none" ? (
                          <button onClick={() => sendRequest(r.id)} className="rounded-lg bg-amber-500 px-3 py-1 text-xs font-bold text-slate-950">
                            + Add
                          </button>
                        ) : (
                          <span className="text-xs text-slate-500">
                            {r.status === "friends" ? "✓ Friend" : r.status === "outgoing" ? "Requested" : "Wants to add you"}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Incoming requests */}
                {incoming.length > 0 && (
                  <div className="rounded-2xl border border-slate-700 bg-slate-800/60 p-4">
                    <h3 className="text-sm font-bold uppercase text-amber-400">
                      Requests ({incoming.length})
                    </h3>
                    <div className="mt-2 space-y-2">
                      {incoming.map((r) => (
                        <div key={r.relId} className="flex items-center justify-between rounded-lg border border-slate-700 bg-slate-900/50 px-3 py-2">
                          <span className="flex items-center gap-2 text-sm">
                            <span className="text-xl">{r.avatar}</span>
                            {r.username}
                          </span>
                          <div className="flex gap-2">
                            <button onClick={() => respond(r.relId, "accept")} className="rounded-lg bg-emerald-500 px-3 py-1 text-xs font-bold text-slate-950">
                              Accept
                            </button>
                            <button onClick={() => respond(r.relId, "decline")} className="rounded-lg bg-red-500 px-3 py-1 text-xs font-bold text-white">
                              Decline
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Friends list */}
                <div className="rounded-2xl border border-slate-700 bg-slate-800/60 p-4">
                  <h3 className="text-sm font-bold uppercase text-slate-400">
                    Your Friends ({friends.length})
                  </h3>
                  {friends.length === 0 ? (
                    <p className="mt-2 text-sm text-slate-500">No friends yet. Search above to add some!</p>
                  ) : (
                    <div className="mt-2 space-y-2">
                      {friends.map((f) => (
                        <div key={f.id} className="flex items-center justify-between rounded-lg border border-slate-700 bg-slate-900/50 px-3 py-2">
                          <button onClick={() => setViewProfile(f.username)} className="flex items-center gap-2 text-sm">
                            <AvatarView value={f.avatar} map={avatarMap} size="1.25rem" className="overflow-hidden rounded-full" />
                            <span className="underline">{f.username}</span>
                          </button>
                          <div className="flex gap-2">
                            {activeGame && (
                              <button onClick={() => inviteFriend(f.id)} className="rounded-lg bg-amber-500 px-3 py-1 text-xs font-bold text-slate-950">
                                Invite
                              </button>
                            )}
                            <button onClick={() => respond(f.relId, "remove")} className="text-xs text-slate-500 underline">
                              remove
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  {outgoing.length > 0 && (
                    <p className="mt-3 text-xs text-slate-500">
                      Pending sent: {outgoing.map((o) => o.username).join(", ")}
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* SETTINGS (admin) */}
            {panel === "settings" && me.isAdmin && authToken && (
              <AdminPanel
                authToken={authToken}
                pending={pending}
                members={members}
                onDecide={decide}
                onRefresh={() => authToken && loadMe(authToken)}
              />
            )}
          </>
        )}

        {/* ROLES (available to all) */}
        {panel === "roles" && (
          <div className="mt-4 space-y-5">
            {(["town", "mafia", "neutral"] as const).map((team) => (
              <div key={team}>
                <h3
                  className={`text-sm font-bold uppercase ${
                    team === "town" ? "text-sky-400" : team === "mafia" ? "text-red-400" : "text-purple-400"
                  }`}
                >
                  {team === "town" ? "🏙️ Civilians" : team === "mafia" ? "🔫 Mafia" : "🎭 Lone Players"}
                </h3>
                <div className="mt-2 space-y-2">
                  {groups[team].map((r) => (
                    <div key={r.key} className="rounded-xl border border-slate-700 bg-slate-800/50 p-3">
                      <div className="flex items-center gap-2 font-bold">
                        <span className="text-xl">{r.emoji}</span> {r.name}
                      </div>
                      <p className="mt-1 text-xs text-slate-400">{r.description}</p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {viewProfile && authToken && (
          <ProfileModal
            authToken={authToken}
            username={viewProfile}
            avatarMap={avatarMap}
            onClose={() => setViewProfile(null)}
            onAddFriend={(uname) => {
              sendRequestByName(uname);
              setViewProfile(null);
            }}
          />
        )}

        <footer className="mt-auto pt-8 text-center text-xs text-slate-500">
          <p>{T("footerNote", "Play on any phone or computer browser. Share the room code with friends.")}</p>
          <a
            href={T("footerLinkUrl", "https://mafia-the-city.example.com")}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 inline-block font-semibold text-amber-400 underline"
          >
            {T("footerLinkLabel", "🌐 mafia-the-city.example.com")}
          </a>
        </footer>
      </div>
    </main>
  );
}

function PanelBtn({ label, onClick, active }: { label: string; onClick: () => void; active: boolean }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-xl border py-2.5 text-xs font-bold ${
        active ? "border-amber-400 bg-amber-500/20 text-amber-300" : "border-slate-600 bg-slate-800 hover:border-amber-400"
      }`}
    >
      {label}
    </button>
  );
}

function ErrBox({ msg }: { msg: string }) {
  return <p className="mt-3 rounded-lg bg-red-500/20 px-3 py-2 text-sm text-red-300">{msg}</p>;
}

// Safely parse a fetch Response as JSON even if the body is empty or not JSON.
async function safeJson(res: Response): Promise<Record<string, unknown>> {
  const text = await res.text();
  if (!text) return {};
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    return { error: "Server error — please try again." };
  }
}
