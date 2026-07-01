"use client";

export interface OverlaySpec {
  key: number; // unique to retrigger animation
  emoji: string;
  label: string;
  color: string; // tailwind text color class
  bg: string; // flash bg color class
  variant: "shoot" | "search" | "heal" | "generic";
}

export const OVERLAYS: Record<string, Omit<OverlaySpec, "key">> = {
  // personal role actions (shown on the acting player's own screen)
  don: {
    emoji: "🔫",
    label: "You order the hit — BANG!",
    color: "text-red-400",
    bg: "bg-red-600",
    variant: "shoot",
  },
  assassin: {
    emoji: "🗡️",
    label: "Assassination in progress…",
    color: "text-red-400",
    bg: "bg-red-700",
    variant: "shoot",
  },
  mafia: {
    emoji: "🔫",
    label: "You mark the target.",
    color: "text-red-400",
    bg: "bg-red-800",
    variant: "shoot",
  },
  maniac: {
    emoji: "🔪",
    label: "Slash! The Maniac strikes.",
    color: "text-rose-400",
    bg: "bg-rose-800",
    variant: "shoot",
  },
  commissioner: {
    emoji: "🔍",
    label: "Investigating…",
    color: "text-sky-300",
    bg: "bg-sky-700",
    variant: "search",
  },
  doctor: {
    emoji: "⚕️",
    label: "You administer treatment.",
    color: "text-emerald-300",
    bg: "bg-emerald-700",
    variant: "heal",
  },
  mistress: {
    emoji: "💋",
    label: "You distract your target.",
    color: "text-pink-300",
    bg: "bg-pink-700",
    variant: "generic",
  },
  hobo: {
    emoji: "🍷",
    label: "You share a drink and watch…",
    color: "text-amber-300",
    bg: "bg-amber-700",
    variant: "generic",
  },
  lawyer: {
    emoji: "⚖️",
    label: "You shield your client.",
    color: "text-indigo-300",
    bg: "bg-indigo-700",
    variant: "generic",
  },
  journalist: {
    emoji: "📰",
    label: "You dig for the truth…",
    color: "text-yellow-300",
    bg: "bg-yellow-700",
    variant: "search",
  },
  arsonist: {
    emoji: "🔥",
    label: "You douse them in fuel…",
    color: "text-orange-300",
    bg: "bg-orange-700",
    variant: "generic",
  },
  conartist: {
    emoji: "🃏",
    label: "You slip on a disguise.",
    color: "text-purple-300",
    bg: "bg-purple-700",
    variant: "generic",
  },
  snitch: {
    emoji: "🐍",
    label: "You snoop around…",
    color: "text-lime-300",
    bg: "bg-lime-700",
    variant: "search",
  },
  // broadcast / result events
  gunshot: {
    emoji: "🔫",
    label: "A GUNSHOT echoes across the city!",
    color: "text-red-400",
    bg: "bg-red-700",
    variant: "shoot",
  },
  stab: {
    emoji: "🔪",
    label: "A scream pierces the night…",
    color: "text-rose-400",
    bg: "bg-rose-800",
    variant: "generic",
  },
  found_mafia: {
    emoji: "🚨",
    label: "MAFIA FOUND!",
    color: "text-red-400",
    bg: "bg-red-700",
    variant: "search",
  },
  found_innocent: {
    emoji: "✅",
    label: "This player is innocent.",
    color: "text-emerald-300",
    bg: "bg-emerald-700",
    variant: "search",
  },
};

export function ActionOverlay({ spec }: { spec: OverlaySpec | null }) {
  if (!spec) return null;
  return (
    <div
      key={spec.key}
      className="pointer-events-none fixed inset-0 z-50 flex flex-col items-center justify-center"
    >
      <div className={`anim-flash-bg absolute inset-0 ${spec.bg} opacity-0`} />
      {spec.variant === "shoot" && (
        <div className="anim-flash absolute text-[12rem]">💥</div>
      )}
      {spec.variant === "search" && (
        <div className="anim-sweep absolute text-[8rem]">🔦</div>
      )}
      {spec.variant === "heal" && (
        <div className="anim-float absolute text-[7rem]">✨</div>
      )}
      <div
        className={`anim-pop relative z-10 text-center ${
          spec.variant === "shoot" ? "anim-shake" : ""
        }`}
      >
        <div className="text-[9rem] leading-none drop-shadow-2xl">{spec.emoji}</div>
        <div className={`mt-2 text-2xl font-black ${spec.color} drop-shadow-lg`}>
          {spec.label}
        </div>
      </div>
    </div>
  );
}
