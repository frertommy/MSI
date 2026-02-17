/**
 * News Classifier — keyword-based event detection with time-decay
 *
 * Classifies football news articles into high-impact event types and
 * computes an Elo-equivalent rating adjustment per team.
 */

// ── Event type definitions ──

export interface EventPattern {
  type: string;
  label: string;
  eloImpact: number; // raw Elo impact (negative = bad for team)
  decayDays: number; // days until effect fully decays
  keywords: string[][]; // array of keyword groups — each group is AND within, groups are OR between
}

export const EVENT_PATTERNS: EventPattern[] = [
  {
    type: "manager_sacked",
    label: "Manager Sacked",
    eloImpact: -25,
    decayDays: 30,
    keywords: [
      ["manager", "sacked"],
      ["manager", "fired"],
      ["coach", "sacked"],
      ["coach", "fired"],
      ["head coach", "dismissed"],
      ["manager", "dismissed"],
      ["parted ways", "manager"],
      ["parted ways", "coach"],
      ["relieved of duties"],
      ["sacked", "boss"],
    ],
  },
  {
    type: "manager_appointed",
    label: "Manager Appointed",
    eloImpact: 10,
    decayDays: 21,
    keywords: [
      ["manager", "appointed"],
      ["new manager"],
      ["new head coach"],
      ["coach", "appointed"],
      ["named", "manager"],
      ["named", "head coach"],
      ["takes charge"],
      ["new boss"],
    ],
  },
  {
    type: "star_signing",
    label: "Star Signing",
    eloImpact: 15,
    decayDays: 14,
    keywords: [
      ["sign", "star"],
      ["signs", "million"],
      ["transfer", "complete"],
      ["transfer", "confirmed"],
      ["officially signs"],
      ["completed signing"],
      ["new signing"],
      ["deal done"],
      ["joins", "from"],
    ],
  },
  {
    type: "star_departure",
    label: "Star Departure",
    eloImpact: -15,
    decayDays: 14,
    keywords: [
      ["star", "leaves"],
      ["departs"],
      ["exit", "confirmed"],
      ["sold", "million"],
      ["agrees to join"],
      ["transfer away"],
      ["set to leave"],
      ["confirms exit"],
    ],
  },
  {
    type: "financial_crisis",
    label: "Financial Crisis",
    eloImpact: -15,
    decayDays: 45,
    keywords: [
      ["financial", "crisis"],
      ["points deduction"],
      ["administration"],
      ["financial trouble"],
      ["debt", "crisis"],
      ["ffp", "breach"],
      ["financial fair play"],
      ["winding up"],
      ["insolvency"],
    ],
  },
  {
    type: "player_scandal",
    label: "Player Scandal",
    eloImpact: -8,
    decayDays: 14,
    keywords: [
      ["scandal"],
      ["arrested"],
      ["suspended", "misconduct"],
      ["ban", "doping"],
      ["investigation", "player"],
      ["charged", "assault"],
      ["controversy"],
    ],
  },
  {
    type: "ownership_change",
    label: "Ownership Change",
    eloImpact: 5,
    decayDays: 30,
    keywords: [
      ["takeover", "complete"],
      ["new owner"],
      ["ownership", "change"],
      ["acquisition", "complete"],
      ["consortium", "buys"],
      ["purchased", "club"],
    ],
  },
  {
    type: "fan_unrest",
    label: "Fan Unrest",
    eloImpact: -3,
    decayDays: 10,
    keywords: [
      ["fan protest"],
      ["fans", "boycott"],
      ["supporter", "unrest"],
      ["fans", "furious"],
      ["fan", "walkout"],
    ],
  },
  {
    type: "stadium_issue",
    label: "Stadium Issue",
    eloImpact: -3,
    decayDays: 10,
    keywords: [
      ["stadium", "ban"],
      ["ground", "closed"],
      ["behind closed doors"],
      ["stadium", "damage"],
      ["pitch", "unplayable"],
    ],
  },
];

// ── Classified event ──

export interface ClassifiedEvent {
  type: string;
  label: string;
  eloImpact: number;
  decayDays: number;
  headline: string;
  url: string;
  source: string;
  publishedAt: string;
  team: string;
  confidence: number; // 0-1 score based on keyword match quality
}

// ── History entry (stored in news/history.json) ──

export interface NewsHistoryEntry {
  id: string; // deterministic dedup key
  type: string;
  label: string;
  eloImpact: number;
  decayDays: number;
  headline: string;
  url: string;
  source: string;
  publishedAt: string;
  team: string;
  confidence: number;
  firstSeen: string; // ISO date when we first detected this
}

// ── Current team news data (stored in news/current.json) ──

export interface TeamNewsData {
  events: {
    type: string;
    label: string;
    headline: string;
    url: string;
    source: string;
    publishedAt: string;
    rawImpact: number;
    decayedImpact: number;
    daysAgo: number;
  }[];
  totalRawImpact: number;
  totalDecayedImpact: number;
  newsAdjustment: number; // after dampening + cap
}

export interface CurrentNewsFile {
  computedAt: string;
  dampeningFactor: number;
  capElo: number;
  teams: Record<string, TeamNewsData>;
}

// ── Match result filter patterns ──
// Articles that are just match reports (scores, goals, results) should be excluded
const MATCH_RESULT_PATTERNS = [
  /\d+\s*-\s*\d+/, // Score patterns like "2-1", "3 - 0"
  /\bgoals?\b.*\b(scored|netted|struck)\b/i,
  /\b(scored|netted|struck)\b.*\bgoals?\b/i,
  /\bmatch\s*report\b/i,
  /\bfull[- ]time\b/i,
  /\bhalf[- ]time\b/i,
  /\bpost[- ]match\b/i,
  /\bplayer ratings\b/i,
  /\blineup\b/i,
  /\bstarting\s*xi\b/i,
  /\bhighlights\b/i,
  /\bresult\b.*\b(win|draw|loss|defeat|beat)\b/i,
];

// ── Source quality weights ──
const SOURCE_QUALITY: Record<string, number> = {
  "bbc.co.uk": 1.0,
  "bbc-news": 1.0,
  "bbc-sport": 1.0,
  "the-guardian-uk": 0.95,
  "guardian.co.uk": 0.95,
  "reuters": 0.95,
  "associated-press": 0.95,
  "espn": 0.9,
  "sky-sports": 0.9,
  "skysports.com": 0.9,
  "the-athletic": 0.9,
  "theathletic.com": 0.9,
  "telegraph.co.uk": 0.85,
  "independent.co.uk": 0.8,
  "mirror.co.uk": 0.6,
  "dailymail.co.uk": 0.5,
  "thesun.co.uk": 0.4,
  "express.co.uk": 0.4,
};

const DAMPENING_FACTOR = 0.6;
const CAP_ELO = 30; // ±30 raw → ±18 effective max

/**
 * Check if an article is just a match report (should be excluded)
 */
export function isMatchReport(title: string, description?: string): boolean {
  const text = `${title} ${description || ""}`.toLowerCase();
  return MATCH_RESULT_PATTERNS.some((pattern) => pattern.test(text));
}

/**
 * Get source quality weight (0-1)
 */
export function getSourceQuality(sourceId: string, sourceName: string): number {
  const id = sourceId.toLowerCase();
  const name = sourceName.toLowerCase();
  if (SOURCE_QUALITY[id]) return SOURCE_QUALITY[id];
  // Check by domain fragments in name
  for (const [key, weight] of Object.entries(SOURCE_QUALITY)) {
    if (name.includes(key) || id.includes(key)) return weight;
  }
  return 0.65; // default for unknown sources
}

/**
 * Classify an article against a team
 */
export function classifyArticle(
  title: string,
  description: string | null,
  url: string,
  sourceId: string,
  sourceName: string,
  publishedAt: string,
  teamName: string
): ClassifiedEvent | null {
  const text = `${title} ${description || ""}`.toLowerCase();

  // Must mention the team
  const teamLower = teamName.toLowerCase();
  // Also try common short names
  const teamParts = teamLower.split(/\s+/);
  const mainName = teamParts.length > 1 ? teamParts.slice(-1)[0] : teamLower;

  const mentionsTeam =
    text.includes(teamLower) ||
    (mainName.length > 3 && text.includes(mainName));

  if (!mentionsTeam) return null;

  // Filter out match reports
  if (isMatchReport(title, description || undefined)) return null;

  // Try each event pattern
  for (const pattern of EVENT_PATTERNS) {
    let matched = false;
    let matchedKeywords = 0;

    for (const keywordGroup of pattern.keywords) {
      const allMatch = keywordGroup.every((kw) => text.includes(kw.toLowerCase()));
      if (allMatch) {
        matched = true;
        matchedKeywords = keywordGroup.length;
        break;
      }
    }

    if (!matched) continue;

    const sourceQuality = getSourceQuality(sourceId, sourceName);
    const confidence = Math.min(1, 0.5 + matchedKeywords * 0.15) * sourceQuality;

    return {
      type: pattern.type,
      label: pattern.label,
      eloImpact: pattern.eloImpact,
      decayDays: pattern.decayDays,
      headline: title,
      url,
      source: sourceName || sourceId,
      publishedAt,
      team: teamName,
      confidence,
    };
  }

  return null;
}

/**
 * Generate a deterministic dedup ID for an event
 */
export function eventDedupId(event: ClassifiedEvent): string {
  // Combine team + type + date (day only) to deduplicate similar events
  const day = event.publishedAt.substring(0, 10);
  const slug = event.headline
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .substring(0, 40);
  return `${event.team}:${event.type}:${day}:${slug}`;
}

/**
 * Compute time-based decay factor (1.0 = full effect, 0.0 = fully decayed)
 */
export function computeDecay(publishedAt: string, decayDays: number, now?: Date): number {
  const pub = new Date(publishedAt);
  const current = now || new Date();
  const daysAgo = (current.getTime() - pub.getTime()) / (1000 * 60 * 60 * 24);
  if (daysAgo <= 0) return 1.0;
  if (daysAgo >= decayDays) return 0.0;
  // Linear decay
  return 1.0 - daysAgo / decayDays;
}

/**
 * Compute per-team news adjustments from history entries
 */
export function computeTeamAdjustments(
  history: NewsHistoryEntry[],
  now?: Date
): CurrentNewsFile {
  const current = now || new Date();
  const teams: Record<string, TeamNewsData> = {};

  // Group by team
  const teamEvents: Record<string, NewsHistoryEntry[]> = {};
  for (const entry of history) {
    if (!teamEvents[entry.team]) teamEvents[entry.team] = [];
    teamEvents[entry.team].push(entry);
  }

  for (const [team, entries] of Object.entries(teamEvents)) {
    const events: TeamNewsData["events"] = [];
    let totalRawImpact = 0;
    let totalDecayedImpact = 0;

    for (const entry of entries) {
      const decay = computeDecay(entry.publishedAt, entry.decayDays, current);
      if (decay <= 0) continue; // fully decayed, skip

      const daysAgo = Math.round(
        (current.getTime() - new Date(entry.publishedAt).getTime()) /
          (1000 * 60 * 60 * 24)
      );
      const rawImpact = entry.eloImpact * entry.confidence;
      const decayedImpact = rawImpact * decay;

      totalRawImpact += rawImpact;
      totalDecayedImpact += decayedImpact;

      events.push({
        type: entry.type,
        label: entry.label,
        headline: entry.headline,
        url: entry.url,
        source: entry.source,
        publishedAt: entry.publishedAt,
        rawImpact: Math.round(rawImpact * 10) / 10,
        decayedImpact: Math.round(decayedImpact * 10) / 10,
        daysAgo,
      });
    }

    if (events.length === 0) continue;

    // Sort by most recent first
    events.sort(
      (a, b) =>
        new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
    );

    // Apply cap then dampening
    const capped = Math.max(-CAP_ELO, Math.min(CAP_ELO, totalDecayedImpact));
    const newsAdjustment = Math.round(capped * DAMPENING_FACTOR * 10) / 10;

    teams[team] = {
      events,
      totalRawImpact: Math.round(totalRawImpact * 10) / 10,
      totalDecayedImpact: Math.round(totalDecayedImpact * 10) / 10,
      newsAdjustment,
    };
  }

  return {
    computedAt: current.toISOString(),
    dampeningFactor: DAMPENING_FACTOR,
    capElo: CAP_ELO,
    teams,
  };
}
