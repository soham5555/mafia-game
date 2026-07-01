"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import type { GameState } from "@/lib/state";
import { ROLES } from "@/lib/roles";
import { SHOP_ITEMS } from "@/lib/shop";
import {
  initAudio,
  playSound,
  startMusic,
  setSfx,
  setMusic,
  getSfx,
  getMusic,
} from "@/lib/sound";
import { ActionOverlay, OVERLAYS, type OverlaySpec } from "@/components/ActionOverlay";
import { Notifications } from "@/components/Notifications";
import { AvatarView } from "@/components/AvatarView";

export default function RoomPage() {
  const params = useParams<{ code: string }>();
  const router = useRouter();
  const code = (params.code || "").toUpperCase();
  const [token, setToken] = useState<string | null>(null);
  const [state, setState] = useState<GameState | null>(null);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<number | null>(null);
  const [chatText, setChatText] = useState("");
  const [chatChannel, setChatChannel] = useState<"day" | "mafia" | "dead">("day");
  const [phaseSeconds, setPhaseSeconds] = useState(0);
  const [now, setNow] = useState(Date.now());
  const [overlay, setOverlay] = useState<OverlaySpec | null>(null);
  const [paused, setPaused] = useState(false);
  const [sfxOn, setSfxOn] = useState(true);
  const [musicOn, setMusicOn] = useState(true);
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [friendMsg, setFriendMsg] = useState("");
  const [copyMsg, setCopyMsg] = useState("");
  const [qrUrl, setQrUrl] = useState("");
  const [showQr, setShowQr] = useState(false);

  const [avatarMap, setAvatarMap] = useState<Record<string, string>>({});

  useEffect(() => {
    setAuthToken(localStorage.getItem("mafia:auth"));
    fetch("/api/avatars")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.avatars) {
          const m: Record<string, string> = {};
          for (const a of d.avatars) m[a.key] = a.image;
          setAvatarMap(m);
        }
      })
      .catch(() => {});
  }, []);

  const joinUrl =
    typeof window !== "undefined" ? `${window.location.origin}/join/${code}` : "";

  // Robust copy that works even without the async Clipboard API (insecure contexts).
  async function copyText(text: string, label: string) {
    let ok = false;
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
        ok = true;
      }
    } catch {
      ok = false;
    }
    if (!ok) {
      try {
        const ta = document.createElement("textarea");
        ta.value = text;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.focus();
        ta.select();
        ok = document.execCommand("copy");
        document.body.removeChild(ta);
      } catch {
        ok = false;
      }
    }
    setCopyMsg(ok ? `${label} copied!` : `Couldn't copy — long-press to copy manually.`);
    setTimeout(() => setCopyMsg(""), 2500);
  }

  async function toggleQr() {
    if (!showQr && !qrUrl && joinUrl) {
      try {
        const QR = (await import("qrcode")).default;
        const dataUrl = await QR.toDataURL(joinUrl, { width: 240, margin: 1 });
        setQrUrl(dataUrl);
      } catch {
        /* ignore */
      }
    }
    setShowQr((s) => !s);
  }

  async function shareInvite() {
    const shareData = {
      title: "Mafia: The City",
      text: `Join my Mafia game! Room code: ${code}`,
      url: joinUrl,
    };
    try {
      if (navigator.share) {
        await navigator.share(shareData);
        return;
      }
    } catch {
      /* user cancelled or unsupported */
    }
    await copyText(`${shareData.text}\n${joinUrl}`, "Invite link");
  }

  async function addFriendByName(name: string) {
    setFriendMsg("");
    const res = await fetch("/api/friends/request", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: authToken, username: name }),
    });
    const data = await res.json().catch(() => ({}));
    setFriendMsg(res.ok ? `Request sent to ${name}!` : data.error || "Failed");
  }
  const chatEndRef = useRef<HTMLDivElement>(null);
  const overlayKey = useRef(0);
  const lastEventId = useRef(0);
  const lastPhase = useRef<string>("");

  function triggerOverlay(kind: string) {
    const base = OVERLAYS[kind];
    if (!base) return;
    overlayKey.current += 1;
    setOverlay({ ...base, key: overlayKey.current });
    setTimeout(() => setOverlay(null), 1700);
  }

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  // Init audio + music on first user interaction (browser autoplay policy).
  useEffect(() => {
    setSfxOn(getSfx());
    setMusicOn(getMusic());
    const kick = () => {
      initAudio();
      if (getMusic()) startMusic();
      window.removeEventListener("pointerdown", kick);
    };
    window.addEventListener("pointerdown", kick);
    return () => window.removeEventListener("pointerdown", kick);
  }, []);

  // Poll for real-time sound/animation events.
  useEffect(() => {
    if (!token) return;
    let stop = false;
    async function poll() {
      try {
        const res = await fetch(
          `/api/rooms/${code}/events?token=${token}&since=${lastEventId.current}`
        );
        if (!res.ok) return;
        const data = await res.json();
        for (const ev of data.events as { id: number; type: string }[]) {
          playSound(ev.type);
          triggerOverlay(ev.type);
        }
        if (typeof data.lastId === "number" && data.lastId > lastEventId.current)
          lastEventId.current = data.lastId;
      } catch {
        /* ignore */
      }
      if (!stop) setTimeout(poll, 1500);
    }
    poll();
    return () => {
      stop = true;
    };
  }, [token, code]);

  // Play a sound when the phase changes.
  useEffect(() => {
    if (!state) return;
    const phase = `${state.room.status}-${state.room.dayNumber}`;
    if (lastPhase.current && lastPhase.current !== phase) {
      if (state.room.status === "day" || state.room.status === "night") playSound("phase");
      if (state.room.status === "ended") playSound("win");
    }
    lastPhase.current = phase;
  }, [state?.room.status, state?.room.dayNumber]);

  // Warn / leave when navigating away mid-game.
  useEffect(() => {
    function onBeforeUnload(e: BeforeUnloadEvent) {
      if (state && state.room.status !== "lobby" && state.room.status !== "ended" && state.me?.alive) {
        e.preventDefault();
        e.returnValue = "";
      }
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [state]);

  useEffect(() => {
    const t = localStorage.getItem(`mafia:${code}:token`);
    if (!t) {
      router.replace("/");
      return;
    }
    setToken(t);
  }, [code, router]);

  const fetchState = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch(`/api/rooms/${code}/state?token=${token}`);
      if (!res.ok) {
        if (res.status === 404) setError("Room not found");
        return;
      }
      const data = (await res.json()) as GameState;
      setState(data);
    } catch {
      /* ignore transient */
    }
  }, [code, token]);

  useEffect(() => {
    if (!token) return;
    fetchState();
    const id = setInterval(fetchState, 2000);
    return () => clearInterval(id);
  }, [token, fetchState]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [state?.messages.length]);

  async function post(path: string, body: Record<string, unknown>) {
    const res = await fetch(`/api/rooms/${code}/${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, ...body }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) setError(data.error || "Action failed");
    else setError("");
    fetchState();
    return res.ok;
  }

  if (error === "Room not found") {
    return (
      <Center>
        <p className="text-lg">Room not found.</p>
        <button onClick={() => router.push("/")} className="mt-4 rounded-lg bg-amber-500 px-4 py-2 font-bold text-slate-950">
          Back home
        </button>
      </Center>
    );
  }

  if (!state) return <Center>Loading…</Center>;

  const { room, me, players, messages, logs, myAction, myVote, voteTally } = state;
  const isHost = me?.isHost;
  const alivePlayers = players.filter((p) => p.alive);
  const myRoleDef = me?.roleDef ?? (me?.role ? ROLES[me.role] : null);

  // ---- CLOSED (host left the lobby) ----
  if (room.status === "closed") {
    return (
      <Center>
        <div className="text-4xl">🚪</div>
        <p className="mt-2 text-lg font-bold">The host closed this room.</p>
        <p className="mt-1 text-sm text-slate-400">No penalty — the game never started.</p>
        <button
          onClick={() => {
            localStorage.removeItem(`mafia:${code}:token`);
            router.push("/");
          }}
          className="mt-4 rounded-lg bg-amber-500 px-4 py-2 font-bold text-slate-950"
        >
          Back home
        </button>
      </Center>
    );
  }

  // ---- LOBBY ----
  if (room.status === "lobby") {
    return (
      <Shell code={code}>
        <div className="text-center">
          <p className="text-xs uppercase tracking-widest text-slate-400">Room Code</p>
          <div className="mt-1 flex items-center justify-center gap-3">
            <span className="text-5xl font-black tracking-[0.3em] text-amber-400">{code}</span>
            <button
              onClick={() => copyText(code, "Room code")}
              className="rounded-lg border border-slate-600 px-2 py-1 text-xs"
            >
              Copy
            </button>
          </div>
          <p className="mt-2 text-sm text-slate-400">Share this code so friends can join.</p>

          <div className="mt-3 grid grid-cols-3 gap-2">
            <button
              onClick={shareInvite}
              className="rounded-xl bg-amber-500 py-2.5 text-sm font-black text-slate-950"
            >
              📤 Share
            </button>
            <button
              onClick={() => copyText(joinUrl, "Invite link")}
              className="rounded-xl border border-slate-500 bg-slate-700 py-2.5 text-sm font-bold"
            >
              🔗 Copy link
            </button>
            <button
              onClick={toggleQr}
              className="rounded-xl border border-slate-500 bg-slate-700 py-2.5 text-sm font-bold"
            >
              {showQr ? "Hide QR" : "📱 QR"}
            </button>
          </div>
          {copyMsg && <p className="mt-2 text-xs text-emerald-400">{copyMsg}</p>}
          {showQr && qrUrl && (
            <div className="mt-3 flex flex-col items-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={qrUrl} alt="Join QR code" className="rounded-xl border border-slate-600" />
              <p className="mt-1 text-xs text-slate-400">Scan to join this room</p>
            </div>
          )}
        </div>

        {isHost && (
          <div className="mt-4 rounded-2xl border border-slate-700 bg-slate-800/60 p-4">
            <h3 className="text-sm font-bold text-amber-400">Room visibility</h3>
            <div className="mt-2 flex rounded-xl bg-slate-900 p-1">
              <button
                onClick={() => post("visibility", { isPublic: false })}
                className={`flex-1 rounded-lg py-2 text-sm font-bold ${
                  !room.isPublic ? "bg-amber-500 text-slate-950" : "text-slate-400"
                }`}
              >
                🔒 Private
              </button>
              <button
                onClick={() => post("visibility", { isPublic: true })}
                className={`flex-1 rounded-lg py-2 text-sm font-bold ${
                  room.isPublic ? "bg-amber-500 text-slate-950" : "text-slate-400"
                }`}
              >
                🌍 Public
              </button>
            </div>
            <p className="mt-2 text-xs text-slate-400">
              {room.isPublic
                ? "Listed in World Games — anyone can find & join by your username or code."
                : "Hidden — only people with the code can join."}
            </p>
          </div>
        )}
        {!isHost && (
          <p className="mt-4 text-center text-xs text-slate-500">
            {room.isPublic ? "🌍 Public room" : "🔒 Private room"}
          </p>
        )}

        <div className="mt-6">
          <h2 className="text-sm font-bold uppercase text-slate-400">
            Players ({players.length})
          </h2>
          <ul className="mt-2 space-y-2">
            {players.map((p) => (
              <li
                key={p.id}
                className="flex items-center justify-between rounded-xl border border-slate-700 bg-slate-800/60 px-4 py-3"
              >
                <span className="font-semibold">
                  {p.name} {p.id === me?.id && <span className="text-amber-400">(you)</span>}
                </span>
                {p.isHost && <span className="text-xs font-bold text-amber-400">HOST</span>}
              </li>
            ))}
          </ul>
        </div>

        {/* Item selection — opt-in, default OFF */}
        {me && Object.keys(me.inventory ?? {}).some((k) => (me.inventory?.[k] ?? 0) > 0) && (
          <div className="mt-6 rounded-2xl border border-slate-700 bg-slate-800/60 p-4">
            <h3 className="text-sm font-bold text-amber-400">🎒 Use your items this game?</h3>
            <p className="mt-1 text-xs text-slate-400">
              Off by default. Toggle on to bring an item into this match (consumed when used).
            </p>
            <div className="mt-3 space-y-2">
              {SHOP_ITEMS.filter((it) => (me.inventory?.[it.key] ?? 0) > 0).map((it) => {
                const on = !!me.equip?.[it.key];
                return (
                  <button
                    key={it.key}
                    onClick={() => post("equip", { itemKey: it.key, on: !on })}
                    className={`flex w-full items-center justify-between rounded-xl border px-3 py-2 text-left transition ${
                      on
                        ? "border-emerald-500 bg-emerald-900/30"
                        : "border-slate-600 bg-slate-900/50"
                    }`}
                  >
                    <span className="flex items-center gap-2 text-sm font-semibold">
                      <span className="text-xl">{it.emoji}</span>
                      {it.name}
                      <span className="text-xs text-slate-500">
                        (x{me.inventory?.[it.key] ?? 0})
                      </span>
                    </span>
                    <span
                      className={`flex h-6 w-11 items-center rounded-full px-0.5 transition ${
                        on ? "justify-end bg-emerald-500" : "justify-start bg-slate-600"
                      }`}
                    >
                      <span className="h-5 w-5 rounded-full bg-white" />
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {isHost ? (
          <>
            <div className="mt-6 rounded-2xl border border-slate-700 bg-slate-800/60 p-4">
              <h3 className="text-sm font-bold text-amber-400">Day / Night cycle</h3>
              <p className="mt-1 text-xs text-slate-400">
                {phaseSeconds === 0
                  ? "Manual — you advance each phase yourself."
                  : `Auto — each phase lasts ${phaseSeconds}s, then advances automatically.`}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <TimerChip label="Manual" active={phaseSeconds === 0} onClick={() => setPhaseSeconds(0)} />
                {[30, 60, 90, 120, 180, 300].map((s) => (
                  <TimerChip
                    key={s}
                    label={`${s}s`}
                    active={phaseSeconds === s}
                    onClick={() => setPhaseSeconds(s)}
                  />
                ))}
              </div>
              {phaseSeconds !== 0 && (
                <input
                  type="range"
                  min={30}
                  max={300}
                  step={5}
                  value={phaseSeconds}
                  onChange={(e) => setPhaseSeconds(Number(e.target.value))}
                  className="mt-3 w-full accent-amber-500"
                />
              )}
            </div>
            <button
              onClick={() => post("start", { phaseSeconds })}
              disabled={players.length < 4}
              className="mt-4 w-full rounded-xl bg-amber-500 py-4 text-lg font-black text-slate-950 disabled:opacity-40"
            >
              {players.length < 4 ? "Need at least 4 players" : "Start Game"}
            </button>
          </>
        ) : (
          <p className="mt-6 text-center text-sm text-slate-400">
            Waiting for the host to start…
          </p>
        )}
        {error && <ErrBox msg={error} />}
      </Shell>
    );
  }

  // ---- ENDED ----
  if (room.status === "ended") {
    const winnerLabel =
      room.winner === "town"
        ? "🏙️ The Town Wins!"
        : room.winner === "mafia"
        ? "🔫 The Mafia Wins!"
        : room.winner === "maniac"
        ? "🔪 The Maniac Wins!"
        : "Game Over";
    return (
      <Shell code={code}>
        <div className="text-center">
          <h2 className="text-3xl font-black text-amber-400">{winnerLabel}</h2>
        </div>
        <div className="mt-6 space-y-2">
          {players.map((p) => (
            <div
              key={p.id}
              className="flex items-center justify-between rounded-xl border border-slate-700 bg-slate-800/60 px-4 py-2"
            >
              <span className={p.alive ? "" : "text-slate-500 line-through"}>{p.name}</span>
              <span className="text-sm">
                {p.role ? `${p.roleEmoji ?? ROLES[p.role]?.emoji ?? "❓"} ${p.roleName ?? p.role}` : "?"}
              </span>
            </div>
          ))}
        </div>
        {isHost && (
          <button
            onClick={() => post("reset", {})}
            className="mt-6 w-full rounded-xl bg-amber-500 py-3 font-black text-slate-950"
          >
            Return to Lobby
          </button>
        )}
      </Shell>
    );
  }

  // ---- IN GAME (night / day) ----
  const isNight = room.status === "night";
  const canAct = me?.alive && isNight && myRoleDef?.nightAction;
  const canVote = me?.alive && !isNight;
  const blockedVote = (me?.state as Record<string, unknown> | undefined)?.blockedVote;

  async function submitAction() {
    if (!myRoleDef) return;
    const actionType =
      me?.role === "arsonist" && selected === -1 ? "ignite" : myRoleDef.actionLabel || "action";
    const ok = await post("action", { targetId: selected === -1 ? null : selected, actionType });
    if (ok && me?.role) {
      // Personal role animation on your own screen.
      triggerOverlay(me.role);
      const soundByRole: Record<string, string> = {
        commissioner: "investigate",
        doctor: "heal",
        mistress: "block",
        maniac: "stab",
      };
      playSound(soundByRole[me.role] ?? "action");
    }
  }

  async function submitVote() {
    const ok = await post("vote", { targetId: selected });
    if (ok) playSound("vote");
  }

  async function leaveGame() {
    await post("leave", {});
    localStorage.removeItem(`mafia:${code}:token`);
    router.push("/");
  }

  function toggleSfx() {
    const next = !sfxOn;
    setSfxOn(next);
    setSfx(next);
    if (next) playSound("click");
  }
  function toggleMusic() {
    const next = !musicOn;
    setMusicOn(next);
    setMusic(next);
  }

  async function sendChat() {
    if (!chatText.trim()) return;
    const ok = await post("chat", { text: chatText, channel: me?.alive ? chatChannel : "dead" });
    if (ok) setChatText("");
  }

  return (
    <Shell code={code}>
      <ActionOverlay spec={overlay} />

      {authToken && (
        <div className="fixed left-4 top-4 z-40">
          <Notifications authToken={authToken} />
        </div>
      )}

      {/* Pause / menu button */}
      <button
        onClick={() => {
          playSound("click");
          setPaused(true);
        }}
        className="fixed right-4 top-4 z-40 rounded-full border border-slate-500 bg-slate-800/90 px-3 py-1.5 text-sm font-bold text-slate-200 shadow-lg"
      >
        ⏸ Menu
      </button>

      {paused && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/80 px-6 py-10">
          <div className="w-full max-w-sm rounded-3xl border border-slate-600 bg-slate-900 p-6 text-center">
            <h2 className="text-2xl font-black text-amber-400">Paused</h2>
            <p className="mt-1 text-xs text-slate-400">
              This only pauses your view — the shared game keeps running.
            </p>

            {/* Player list + add friend */}
            <div className="mt-4 rounded-xl border border-slate-700 bg-slate-800/60 p-3 text-left">
              <h3 className="text-xs font-bold uppercase text-slate-400">
                Players ({players.length})
              </h3>
              {friendMsg && (
                <p className="mt-1 text-xs text-emerald-400">{friendMsg}</p>
              )}
              <div className="mt-2 max-h-48 space-y-1 overflow-y-auto">
                {players.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between rounded-lg bg-slate-900/60 px-2 py-1.5 text-sm"
                  >
                    <span className="flex items-center gap-2">
                      <AvatarView value={p.avatar} map={avatarMap} size="1.25rem" className="overflow-hidden rounded-full" />
                      <span className={p.alive ? "" : "text-slate-500 line-through"}>
                        {p.name}
                        {p.id === me?.id && " (you)"}
                      </span>
                    </span>
                    {p.id !== me?.id && authToken && (
                      <button
                        onClick={() => addFriendByName(p.name)}
                        className="rounded-md bg-amber-500/20 px-2 py-0.5 text-xs font-bold text-amber-300"
                      >
                        + Friend
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-4 space-y-3">
              <button
                onClick={toggleMusic}
                className="flex w-full items-center justify-between rounded-xl border border-slate-600 bg-slate-800 px-4 py-3 font-bold"
              >
                <span>🎵 Music</span>
                <span className={musicOn ? "text-emerald-400" : "text-slate-500"}>
                  {musicOn ? "ON" : "OFF"}
                </span>
              </button>
              <button
                onClick={toggleSfx}
                className="flex w-full items-center justify-between rounded-xl border border-slate-600 bg-slate-800 px-4 py-3 font-bold"
              >
                <span>🔊 Sound Effects</span>
                <span className={sfxOn ? "text-emerald-400" : "text-slate-500"}>
                  {sfxOn ? "ON" : "OFF"}
                </span>
              </button>
              <button
                onClick={() => {
                  playSound("click");
                  setPaused(false);
                }}
                className="w-full rounded-xl bg-amber-500 py-3 font-black text-slate-950"
              >
                ▶ Resume
              </button>
              <button
                onClick={() => {
                  if (confirm("Leave the game? You'll be eliminated and lose coins.")) leaveGame();
                }}
                className="w-full rounded-xl border border-red-500/60 bg-red-500/15 py-3 font-bold text-red-300"
              >
                🚪 Leave Game (penalty)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Phase banner */}
      <div
        className={`rounded-2xl px-4 py-3 text-center font-black ${
          isNight ? "bg-indigo-950 text-indigo-200" : "bg-amber-100 text-amber-900"
        }`}
      >
        {isNight ? "🌙" : "☀️"} {isNight ? "NIGHT" : "DAY"} {room.dayNumber}
        {room.phaseEndsAt && (
          <div className="mt-1 text-sm font-bold tabular-nums">
            ⏱️ {formatCountdown(room.phaseEndsAt, now)}
          </div>
        )}
      </div>

      {/* Role card */}
      {me && (
        <div className="mt-4 rounded-2xl border border-slate-700 bg-slate-800/70 p-4">
          <div className="flex items-center gap-3">
            <span className="text-4xl">{myRoleDef?.emoji}</span>
            <div>
              <div className="text-lg font-black">
                {myRoleDef?.name}{" "}
                {!me.alive && <span className="text-red-400">(dead)</span>}
              </div>
              <div
                className={`text-xs font-bold uppercase ${
                  me.team === "town"
                    ? "text-sky-400"
                    : me.team === "mafia"
                    ? "text-red-400"
                    : "text-purple-400"
                }`}
              >
                {me.team}
                {me.extraLives ? ` · ${me.extraLives} extra life` : ""}
              </div>
            </div>
          </div>
          <p className="mt-2 text-xs text-slate-400">{myRoleDef?.description}</p>
        </div>
      )}

      {/* Action / Vote panel */}
      {me?.alive && (
        <div className="mt-4 rounded-2xl border border-slate-700 bg-slate-800/50 p-4">
          {isNight ? (
            canAct ? (
              <>
                <h3 className="text-sm font-bold text-amber-400">
                  {myRoleDef?.actionLabel} — choose a target
                </h3>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  {me.role === "arsonist" && (
                    <TargetBtn
                      label="🔥 IGNITE"
                      active={selected === -1}
                      onClick={() => setSelected(-1)}
                    />
                  )}
                  {players
                    .filter((p) => p.alive && (myRoleDef?.canTargetSelf || p.id !== me.id))
                    .map((p) => (
                      <TargetBtn
                        key={p.id}
                        label={p.name + (p.id === me.id ? " (self)" : "")}
                        active={selected === p.id}
                        onClick={() => setSelected(p.id)}
                      />
                    ))}
                </div>
                <button
                  onClick={submitAction}
                  disabled={selected === null}
                  className="mt-3 w-full rounded-xl bg-amber-500 py-2.5 font-bold text-slate-950 disabled:opacity-40"
                >
                  Confirm Action
                </button>
                {myAction && (
                  <p className="mt-2 text-center text-xs text-emerald-400">
                    ✓ Action locked in ({myAction.actionType}). You can change it.
                  </p>
                )}
              </>
            ) : (
              <p className="text-center text-sm text-slate-400">
                You have no night action. Wait for dawn…
              </p>
            )
          ) : (
            <>
              <h3 className="text-sm font-bold text-amber-400">Town Vote — who to lynch?</h3>
              {blockedVote ? (
                <p className="mt-2 text-center text-sm text-red-400">
                  You were distracted last night and cannot vote today.
                </p>
              ) : (
                <>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <TargetBtn
                      label="Abstain"
                      active={selected === -1}
                      onClick={() => setSelected(-1)}
                    />
                    {alivePlayers
                      .filter((p) => p.id !== me.id)
                      .map((p) => {
                        const t = voteTally.find((v) => v.targetId === p.id);
                        return (
                          <TargetBtn
                            key={p.id}
                            label={`${p.name}${t ? ` (${t.count})` : ""}`}
                            active={selected === p.id}
                            onClick={() => setSelected(p.id)}
                          />
                        );
                      })}
                  </div>
                  <button
                    onClick={submitVote}
                    disabled={selected === null}
                    className="mt-3 w-full rounded-xl bg-amber-500 py-2.5 font-bold text-slate-950 disabled:opacity-40"
                  >
                    Confirm Vote
                  </button>
                  {myVote != null && (
                    <p className="mt-2 text-center text-xs text-emerald-400">
                      ✓ Voted. You can change it.
                    </p>
                  )}
                </>
              )}
            </>
          )}
        </div>
      )}

      {/* Private logs */}
      {logs.length > 0 && (
        <div className="mt-4 rounded-2xl border border-purple-700/50 bg-purple-950/30 p-4">
          <h3 className="text-xs font-bold uppercase text-purple-300">Your Secret Notes</h3>
          <ul className="mt-2 space-y-1 text-xs text-purple-200">
            {logs.slice(-8).map((l) => (
              <li key={l.id}>• {l.text}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Players overview */}
      <div className="mt-4">
        <h3 className="text-xs font-bold uppercase text-slate-400">Players</h3>
        <div className="mt-2 grid grid-cols-2 gap-2">
          {players.map((p) => (
            <div
              key={p.id}
              className={`rounded-xl border px-3 py-2 text-sm ${
                p.alive
                  ? "border-slate-700 bg-slate-800/60"
                  : "border-slate-800 bg-slate-900/60 text-slate-600"
              }`}
            >
              <div className="font-semibold">
                {p.alive ? "" : "💀 "}
                {p.name}
                {p.id === me?.id && " (you)"}
              </div>
              {p.roleName && (
                <div className="text-xs text-slate-400">
                  {p.roleEmoji ?? (p.role ? ROLES[p.role]?.emoji ?? "" : "")} {p.roleName}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Host controls */}
      {isHost && (
        <button
          onClick={() => post("advance", {})}
          className="mt-4 w-full rounded-xl border border-amber-500 bg-amber-500/20 py-3 font-bold text-amber-300"
        >
          {room.phaseSeconds > 0
            ? isNight
              ? "Skip to Day now (Host)"
              : "Skip to Night now (Host)"
            : isNight
            ? "Resolve Night → Day (Host)"
            : "Resolve Day → Night (Host)"}
        </button>
      )}

      {/* Chat */}
      <div className="mt-4 rounded-2xl border border-slate-700 bg-slate-800/40 p-3">
        <div className="mb-2 flex gap-2">
          {(me?.alive
            ? me.team === "mafia"
              ? (["day", "mafia"] as const)
              : (["day"] as const)
            : (["dead"] as const)
          ).map((ch) => (
            <button
              key={ch}
              onClick={() => setChatChannel(ch)}
              className={`rounded-full px-3 py-1 text-xs font-bold ${
                chatChannel === ch ? "bg-amber-500 text-slate-950" : "bg-slate-700 text-slate-300"
              }`}
            >
              {ch === "day" ? "Town" : ch === "mafia" ? "Mafia" : "Ghosts"}
            </button>
          ))}
        </div>
        <div className="h-48 overflow-y-auto rounded-lg bg-slate-900/60 p-2 text-sm">
          {messages
            .filter((m) => {
              if (chatChannel === "mafia") return m.channel === "mafia";
              if (chatChannel === "dead") return m.channel === "dead" || m.channel === "system";
              return m.channel === "day" || m.channel === "system";
            })
            .map((m) => (
              <div key={m.id} className="mb-1">
                <span
                  className={
                    m.channel === "system"
                      ? "font-bold text-amber-400"
                      : m.channel === "mafia"
                      ? "font-bold text-red-400"
                      : "font-bold text-sky-300"
                  }
                >
                  {m.senderName}:
                </span>{" "}
                <span className="text-slate-200">{m.text}</span>
              </div>
            ))}
          <div ref={chatEndRef} />
        </div>
        <div className="mt-2 flex gap-2">
          <input
            value={chatText}
            onChange={(e) => setChatText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && sendChat()}
            placeholder={
              !me?.alive
                ? "Speak with the dead…"
                : chatChannel === "mafia"
                ? "Mafia chat…"
                : isNight
                ? "Town sleeps at night"
                : "Discuss…"
            }
            disabled={me?.alive && chatChannel === "day" && isNight}
            className="flex-1 rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-sm outline-none focus:border-amber-400 disabled:opacity-50"
          />
          <button
            onClick={sendChat}
            className="rounded-lg bg-amber-500 px-4 font-bold text-slate-950"
          >
            Send
          </button>
        </div>
      </div>

      {error && <ErrBox msg={error} />}
    </Shell>
  );
}

function formatCountdown(iso: string, now: number): string {
  const remaining = Math.max(0, Math.round((new Date(iso).getTime() - now) / 1000));
  const m = Math.floor(remaining / 60);
  const s = remaining % 60;
  return m > 0 ? `${m}:${s.toString().padStart(2, "0")}` : `${s}s`;
}

function TimerChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full px-3 py-1.5 text-sm font-bold ${
        active ? "bg-amber-500 text-slate-950" : "bg-slate-700 text-slate-300"
      }`}
    >
      {label}
    </button>
  );
}

function TargetBtn({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-xl border px-3 py-2 text-sm font-semibold transition ${
        active
          ? "border-amber-400 bg-amber-500 text-slate-950"
          : "border-slate-600 bg-slate-800 text-slate-200 hover:border-slate-400"
      }`}
    >
      {label}
    </button>
  );
}

function Shell({ code, children }: { code: string; children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-black text-slate-100">
      <div className="mx-auto max-w-lg px-4 py-6">
        <div className="mb-4 flex items-center justify-between">
          <span className="text-lg font-black text-amber-400">🕵️ MAFIA</span>
          <span className="font-mono text-sm tracking-widest text-slate-400">{code}</span>
        </div>
        {children}
      </div>
    </main>
  );
}

function Center({ children }: { children: React.ReactNode }) {
  return (
    <main className="grid min-h-screen place-items-center bg-slate-950 text-center text-slate-200">
      <div>{children}</div>
    </main>
  );
}

function ErrBox({ msg }: { msg: string }) {
  return (
    <p className="mt-3 rounded-lg bg-red-500/20 px-3 py-2 text-sm text-red-300">{msg}</p>
  );
}
