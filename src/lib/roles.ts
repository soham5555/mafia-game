export type Team = "town" | "mafia" | "neutral";

export interface RoleDef {
  key: string;
  name: string;
  team: Team;
  emoji: string;
  short: string;
  description: string;
  /** whether this role performs a targeted night action */
  nightAction: boolean;
  /** action label shown to the player at night */
  actionLabel?: string;
  /** can target self */
  canTargetSelf?: boolean;
}

export const ROLES: Record<string, RoleDef> = {
  commissioner: {
    key: "commissioner",
    name: "Commissioner Cattani",
    team: "town",
    emoji: "🕵️",
    short: "Lead investigator of the town.",
    description:
      "The city's lead investigator and the Mafia's primary threat. Investigate a player each night to learn if they are Mafia. Prohibited from using lethal force on the first night without an investigation.",
    nightAction: true,
    actionLabel: "Investigate",
  },
  sergeant: {
    key: "sergeant",
    name: "Sergeant",
    team: "town",
    emoji: "👮",
    short: "Assists the Commissioner; inherits the role.",
    description:
      "Assist Commissioner Cattani. If the Commissioner is eliminated, you inherit his role and abilities.",
    nightAction: false,
  },
  mayor: {
    key: "mayor",
    name: "Mayor",
    team: "town",
    emoji: "🎩",
    short: "Your daytime vote counts twice.",
    description: "You hold the office of Mayor; your vote during the daytime proceedings counts as two.",
    nightAction: false,
  },
  doctor: {
    key: "doctor",
    name: "Doctor",
    team: "town",
    emoji: "⚕️",
    short: "Protect a player from death each night.",
    description:
      "Provide protection each night. You may self-heal only once per game.",
    nightAction: true,
    actionLabel: "Heal",
    canTargetSelf: true,
  },
  mistress: {
    key: "mistress",
    name: "Mistress",
    team: "town",
    emoji: "💋",
    short: "Distract a player, blocking their action.",
    description:
      "Distract a killer for one night, preventing your target from performing an action or voting. Do not intentionally visit the Commissioner.",
    nightAction: true,
    actionLabel: "Distract",
  },
  hobo: {
    key: "hobo",
    name: "Hobo",
    team: "town",
    emoji: "🍷",
    short: "Visit a home to witness any murder there.",
    description:
      "Visit a player's residence at night to share a drink, allowing you to witness any murder that occurs there.",
    nightAction: true,
    actionLabel: "Visit",
  },
  civilian: {
    key: "civilian",
    name: "Civilian",
    team: "town",
    emoji: "🧑",
    short: "Deduce and lynch the Mafia.",
    description: "Deduce the identity of the Mafia and lynch them during the town meeting.",
    nightAction: false,
  },
  lucky: {
    key: "lucky",
    name: "Lucky",
    team: "town",
    emoji: "🍀",
    short: "You have two lives.",
    description: "Ensure a victory for the civilians. You possess two lives.",
    nightAction: false,
  },
  suicidal: {
    key: "suicidal",
    name: "Suicidal",
    team: "neutral",
    emoji: "🪦",
    short: "Win only if lynched during the day.",
    description:
      "You win only if you are eliminated during the daytime meeting. If eliminated at night or if you survive, you lose.",
    nightAction: false,
  },
  kamikaze: {
    key: "kamikaze",
    name: "Kamikaze",
    team: "town",
    emoji: "💣",
    short: "Take your killer down with you.",
    description:
      "Take the Maniac or a Mafia member with you to the grave. If targeted by a night action, you take your attacker down. If lynched, you choose any player to be eliminated alongside you.",
    nightAction: false,
  },
  don: {
    key: "don",
    name: "Don",
    team: "mafia",
    emoji: "🤵",
    short: "Leader of the Mafia.",
    description: "The leader of the organization. You decide the Mafia's nightly kill.",
    nightAction: true,
    actionLabel: "Order kill",
  },
  mafia: {
    key: "mafia",
    name: "Mafia",
    team: "mafia",
    emoji: "🔫",
    short: "Collectively eliminate a target each night.",
    description: "Your group collectively decides who will be eliminated each night.",
    nightAction: true,
    actionLabel: "Vote to kill",
  },
  lawyer: {
    key: "lawyer",
    name: "Lawyer",
    team: "mafia",
    emoji: "⚖️",
    short: "Shield the Mafia from investigation & lynch.",
    description:
      "Shield the Mafia. A chosen Mafia member reads as Civilian to the Commissioner and is protected from lynching that day. You may protect yourself from a lynch only once.",
    nightAction: true,
    actionLabel: "Protect",
    canTargetSelf: true,
  },
  assassin: {
    key: "assassin",
    name: "Assassin",
    team: "mafia",
    emoji: "🗡️",
    short: "Unstoppable Mafia kill.",
    description:
      "The Mafia's enforcer. Your kill cannot be prevented by any means. You can only be removed via the daytime vote, or by targeting the Commissioner.",
    nightAction: true,
    actionLabel: "Assassinate",
  },
  journalist: {
    key: "journalist",
    name: "Journalist",
    team: "mafia",
    emoji: "📰",
    short: "Mafia informant who identifies roles.",
    description:
      "A Mafia informant who tracks activity and identifies the roles of city members. Findings can be announced in general chat (cannot see visitors of the Commissioner).",
    nightAction: true,
    actionLabel: "Investigate role",
  },
  maniac: {
    key: "maniac",
    name: "Maniac",
    team: "neutral",
    emoji: "🔪",
    short: "Eliminate everyone else.",
    description: "Your goal is to eliminate everyone else. Kill one player each night.",
    nightAction: true,
    actionLabel: "Kill",
  },
  werewolf: {
    key: "werewolf",
    name: "Werewolf",
    team: "neutral",
    emoji: "🐺",
    short: "Transforms depending on who kills you.",
    description:
      "If killed by the Mafia, you join them the next night. If killed by the Commissioner, you become the Sergeant. If targeted by the Maniac, you are eliminated permanently.",
    nightAction: false,
  },
  arsonist: {
    key: "arsonist",
    name: "Arsonist",
    team: "neutral",
    emoji: "🔥",
    short: "Douse players, then ignite them all.",
    description:
      "Each night douse a player, or ignite to eliminate yourself-marked targets. Win if you eliminate at least 3 players.",
    nightAction: true,
    actionLabel: "Douse / Ignite",
  },
  mage: {
    key: "mage",
    name: "Mage",
    team: "neutral",
    emoji: "🧙",
    short: "Punish those who attack you.",
    description:
      "If the Don, Maniac, or Commissioner attempts to kill you, it fails and you may pardon or kill your attacker. Survive and punish aggressors.",
    nightAction: false,
  },
  conartist: {
    key: "conartist",
    name: "Con Artist",
    team: "neutral",
    emoji: "🃏",
    short: "Disguise as players you visit.",
    description:
      "By visiting a player at night you may disguise yourself and use their identity during the day vote. Goal: remain in the game.",
    nightAction: true,
    actionLabel: "Visit / Disguise",
  },
  snitch: {
    key: "snitch",
    name: "Snitch",
    team: "neutral",
    emoji: "🐍",
    short: "Match the Commissioner's check to expose it.",
    description:
      "Check the same player as the Commissioner on the same night to reveal that player's role to the whole town.",
    nightAction: true,
    actionLabel: "Check",
  },
};

export const ROLE_LIST = Object.values(ROLES);

export function roleTeam(key: string | null | undefined): Team | null {
  if (!key) return null;
  return ROLES[key]?.team ?? null;
}

/**
 * Default role pool ordering used when assigning roles based on player count.
 * Earlier entries are prioritized.
 */
export const ROLE_PRIORITY: string[] = [
  "commissioner",
  "don",
  "doctor",
  "mafia",
  "mayor",
  "mistress",
  "maniac",
  "lawyer",
  "hobo",
  "sergeant",
  "civilian",
  "assassin",
  "lucky",
  "journalist",
  "kamikaze",
  "werewolf",
  "arsonist",
  "mage",
  "conartist",
  "snitch",
  "suicidal",
  "civilian",
  "civilian",
  "civilian",
];
