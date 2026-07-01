"use client";

import { useEffect, useState } from "react";
import { AvatarView } from "@/components/AvatarView";

interface ProfileData {
  username: string;
  avatar: string;
  isSelf: boolean;
  areFriends: boolean;
  profilePublic: boolean;
  canSeeAchievements: boolean;
  relStatus: string;
  stats: { wins: number; losses: number; total: number } | null;
}

export function ProfileModal({
  authToken,
  username,
  avatarMap,
  onClose,
  onAddFriend,
}: {
  authToken: string;
  username: string;
  avatarMap: Record<string, string>;
  onClose: () => void;
  onAddFriend?: (username: string) => void;
}) {
  const [data, setData] = useState<ProfileData | null>(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    fetch(`/api/profile?token=${authToken}&username=${encodeURIComponent(username)}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) setErr(d.error);
        else setData(d.profile);
      })
      .catch(() => setErr("Failed to load profile"));
  }, [authToken, username]);

  const winRate =
    data?.stats && data.stats.total > 0
      ? Math.round((data.stats.wins / data.stats.total) * 100)
      : 0;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 px-5" onClick={onClose}>
      <div
        className="w-full max-w-sm rounded-3xl border border-slate-600 bg-slate-900 p-6 text-center"
        onClick={(e) => e.stopPropagation()}
      >
        {err ? (
          <p className="text-red-300">{err}</p>
        ) : !data ? (
          <p className="text-slate-400">Loading…</p>
        ) : (
          <>
            <div className="mx-auto grid h-20 w-20 place-items-center overflow-hidden rounded-full bg-slate-700">
              <AvatarView value={data.avatar} map={avatarMap} size="5rem" />
            </div>
            <h2 className="mt-3 text-2xl font-black text-amber-400">{data.username}</h2>
            <p className="text-xs text-slate-500">
              {data.profilePublic ? "🌍 Public profile" : "🔒 Private profile"}
              {data.areFriends && " · 👥 Friend"}
            </p>

            {data.canSeeAchievements && data.stats ? (
              <div className="mt-4 space-y-3">
                <div className="grid grid-cols-3 gap-2">
                  <Stat label="🏆 Wins" value={data.stats.wins} color="text-emerald-300" />
                  <Stat label="😔 Losses" value={data.stats.losses} color="text-red-300" />
                  <Stat label="Win rate" value={`${winRate}%`} color="text-amber-300" />
                </div>
                <div className="rounded-xl border border-slate-700 bg-slate-800/60 p-3 text-sm text-slate-300">
                  🎮 {data.stats.total} games played
                  {data.stats.wins >= 10 && <div className="mt-1 text-amber-300">🥇 Veteran (10+ wins)</div>}
                  {data.stats.wins >= 25 && <div className="text-amber-300">👑 Legend (25+ wins)</div>}
                </div>
              </div>
            ) : (
              <div className="mt-4 rounded-xl border border-slate-700 bg-slate-800/60 p-4 text-sm text-slate-400">
                🔒 This player&apos;s achievements are private. Only friends can see them.
              </div>
            )}

            {!data.isSelf && onAddFriend && data.relStatus === "none" && (
              <button
                onClick={() => onAddFriend(data.username)}
                className="mt-4 w-full rounded-xl bg-amber-500 py-2.5 font-bold text-slate-950"
              >
                + Add friend
              </button>
            )}
            {data.relStatus === "outgoing" && (
              <p className="mt-4 text-xs text-slate-500">Friend request sent</p>
            )}

            <button onClick={onClose} className="mt-4 text-sm text-slate-400 underline">
              Close
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: number | string; color: string }) {
  return (
    <div className="rounded-xl border border-slate-700 bg-slate-800/60 p-3">
      <div className={`text-xl font-black ${color}`}>{value}</div>
      <div className="text-[10px] text-slate-400">{label}</div>
    </div>
  );
}
