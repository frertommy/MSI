/**
 * Player importance model for injury impact calculation.
 * Weights players by position and star status.
 */

// Base importance by position
const POSITION_IMPORTANCE: Record<string, number> = {
  Goalkeeper: 0.8,
  Defender: 0.5,
  Midfielder: 0.55,
  Attacker: 0.7,
};

// Star players get direct importance scores (bypasses position weight)
// Abbreviated names matching API-Football format
const STAR_PLAYERS: Record<string, number> = {
  // Premier League
  "E. Haaland": 1.0,
  "M. Salah": 1.0,
  "B. Saka": 0.9,
  "K. De Bruyne": 0.95,
  "V. van Dijk": 0.95,
  "M. Ødegaard": 0.9,
  "D. Rice": 0.85,
  "Bruno Fernandes": 0.85,
  "Son Heung-Min": 0.9,
  "C. Palmer": 0.85,
  "P. Foden": 0.85,
  "A. Isak": 0.85,
  "Alisson": 0.9,
  "W. Saliba": 0.85,
  "D. Núñez": 0.8,
  "Casemiro": 0.75,
  "J. Savinho": 0.75,
  "N. Jackson": 0.75,
  "O. Watkins": 0.8,
  "R. Dias": 0.8,

  // La Liga
  "K. Mbappé": 1.0,
  "R. Lewandowski": 0.95,
  "Vinícius Júnior": 0.95,
  "L. Yamal": 0.9,
  "J. Bellingham": 0.9,
  "Pedri": 0.85,
  "A. Griezmann": 0.85,
  "F. Valverde": 0.85,
  "Rodrygo": 0.85,
  "D. Carvajal": 0.8,
  "Gavi": 0.8,
  "T. Courtois": 0.85,
  "Marc-André ter Stegen": 0.85,
  "A. Sörloth": 0.75,
  "Raphinha": 0.8,

  // Bundesliga
  "H. Kane": 1.0,
  "J. Musiala": 0.9,
  "F. Wirtz": 0.9,
  "M. Neuer": 0.8,
  "L. Sané": 0.8,
  "J. Kimmich": 0.85,
  "M. Reus": 0.75,
  "S. Guirassy": 0.8,
  "Dani Olmo": 0.8,
  "G. Xhaka": 0.8,
  "V. Boniface": 0.8,
  "K. Adeyemi": 0.75,
  "M. Sabitzer": 0.75,

  // Serie A
  "L. Martínez": 0.95,
  "R. Leão": 0.85,
  "K. Kvaratskhelia": 0.85,
  "D. Vlahović": 0.85,
  "N. Barella": 0.85,
  "H. Çalhanoğlu": 0.8,
  "P. Dybala": 0.8,
  "F. Chiesa": 0.8,
  "V. Osimhen": 0.9,
  "M. Thuram": 0.8,
  "T. Hernández": 0.8,
  "C. Pulisic": 0.75,
  "G. Di Lorenzo": 0.75,

  // Ligue 1
  "O. Dembélé": 0.85,
  "B. Barcola": 0.8,
  "Marquinhos": 0.85,
  "G. Donnarumma": 0.8,
  "A. Hakimi": 0.8,
  "J. David": 0.85,
  "A. Lacazette": 0.75,
  "M. Greenwood": 0.8,
  "W. Zaïre-Emery": 0.8,
  "F. Balogun": 0.75,
};

export function getPlayerImportance(
  playerName: string,
  position: string
): number {
  const starBoost = STAR_PLAYERS[playerName];
  if (starBoost !== undefined) return starBoost;
  return POSITION_IMPORTANCE[position] || 0.4;
}

export function injuryToEloAdjustment(totalImpact: number): number {
  // Cap total impact to prevent extreme swings
  const cappedImpact = Math.min(totalImpact, 3.0);
  // Scale: each 1.0 impact point = ~15 Elo points reduction
  const ELO_PER_IMPACT = 15;
  return -cappedImpact * ELO_PER_IMPACT;
}

export interface InjuredPlayer {
  name: string;
  position: string;
  reason: string;
  importance: number;
}

export interface TeamInjuryImpact {
  team: string;
  injuredPlayers: InjuredPlayer[];
  totalImpact: number;
  ratingAdjustment: number;
}

export function calculateTeamInjuryImpact(
  team: string,
  injuries: { name: string; position: string; reason: string }[]
): TeamInjuryImpact {
  const injuredPlayers: InjuredPlayer[] = injuries.map((inj) => ({
    name: inj.name,
    position: inj.position,
    reason: inj.reason,
    importance: getPlayerImportance(inj.name, inj.position),
  }));

  const totalImpact = injuredPlayers.reduce(
    (sum, p) => sum + p.importance,
    0
  );

  return {
    team,
    injuredPlayers,
    totalImpact,
    ratingAdjustment: injuryToEloAdjustment(totalImpact),
  };
}

export { STAR_PLAYERS };
