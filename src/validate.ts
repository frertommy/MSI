import * as fs from 'fs'
import * as path from 'path'

interface TeamRating {
  team: string
  rating: number
  matches: number
  wins: number
  draws: number
  losses: number
  lastUpdated: string
}

interface RatingsFile {
  config: any
  computedAt: string
  matchesProcessed: number
  teams: TeamRating[]
}

// Normalize team names for matching between MSI and ClubElo
const NAME_MAP: Record<string, string[]> = {
  'FC Barcelona': ['Barcelona'],
  'Club Atlético de Madrid': ['Atletico Madrid', 'Atlético Madrid', 'Atlético de Madrid'],
  'Real Betis Balompié': ['Real Betis', 'Betis'],
  'Villarreal CF': ['Villarreal'],
  'Athletic Club': ['Athletic Bilbao', 'Ath Bilbao', 'Athletic'],
  'Real Sociedad de Fútbol': ['Real Sociedad'],
  'Getafe CF': ['Getafe'],
  'Sevilla FC': ['Sevilla'],
  'RC Celta de Vigo': ['Celta Vigo', 'Celta'],
  'CA Osasuna': ['Osasuna'],
  'Rayo Vallecano de Madrid': ['Rayo Vallecano'],
  'RCD Mallorca': ['Mallorca'],
  'Deportivo Alavés': ['Alaves', 'Alavés'],
  'UD Las Palmas': ['Las Palmas'],
  'Valencia CF': ['Valencia'],
  'RCD Espanyol de Barcelona': ['Espanyol'],
  'Real Valladolid CF': ['Valladolid', 'Real Valladolid'],
  'CD Leganés': ['Leganes', 'Leganés'],
  'Girona FC': ['Girona'],
  'FC Bayern München': ['Bayern Munich', 'Bayern München', 'Bayern'],
  'Borussia Dortmund': ['Dortmund', 'BVB'],
  'RB Leipzig': ['RB Leipzig', 'Leipzig'],
  'Bayer 04 Leverkusen': ['Leverkusen', 'Bayer Leverkusen'],
  'VfB Stuttgart': ['Stuttgart'],
  'Eintracht Frankfurt': ['Frankfurt', 'Eintracht Frankfurt'],
  'VfL Wolfsburg': ['Wolfsburg'],
  'SC Freiburg': ['Freiburg'],
  'TSG 1899 Hoffenheim': ['Hoffenheim'],
  'SV Werder Bremen': ['Werder Bremen', 'Bremen'],
  'FC Augsburg': ['Augsburg'],
  '1. FC Union Berlin': ['Union Berlin'],
  '1. FSV Mainz 05': ['Mainz', 'Mainz 05'],
  '1. FC Heidenheim 1846': ['Heidenheim'],
  'VfL Bochum 1848': ['Bochum'],
  'FC St. Pauli 1910': ['St. Pauli', 'St Pauli'],
  'Holstein Kiel': ['Kiel', 'Holstein Kiel'],
  'Borussia Mönchengladbach': ['Gladbach', "M'gladbach", 'Mönchengladbach'],
  'SV Darmstadt 98': ['Darmstadt'],
  '1. FC Köln': ['Köln', 'Cologne', 'FC Köln'],
  'SSC Napoli': ['Napoli'],
  'FC Internazionale Milano': ['Inter Milan', 'Inter', 'Internazionale'],
  'AC Milan': ['AC Milan', 'Milan'],
  'Juventus FC': ['Juventus'],
  'AS Roma': ['Roma', 'AS Roma'],
  'SS Lazio': ['Lazio'],
  'Atalanta BC': ['Atalanta'],
  'ACF Fiorentina': ['Fiorentina'],
  'Bologna FC 1909': ['Bologna'],
  'Torino FC': ['Torino'],
  'US Sassuolo Calcio': ['Sassuolo'],
  'Udinese Calcio': ['Udinese'],
  'Genoa CFC': ['Genoa'],
  'Cagliari Calcio': ['Cagliari'],
  'Hellas Verona FC': ['Verona', 'Hellas Verona'],
  'US Lecce': ['Lecce'],
  'Empoli FC': ['Empoli'],
  'Frosinone Calcio': ['Frosinone'],
  'US Salernitana 1919': ['Salernitana'],
  'Parma Calcio 1913': ['Parma'],
  'AC Monza': ['Monza'],
  'Como 1907': ['Como'],
  'Venezia FC': ['Venezia'],
  'Paris Saint-Germain FC': ['PSG', 'Paris Saint-Germain', 'Paris SG'],
  'AS Monaco FC': ['Monaco'],
  'Olympique de Marseille': ['Marseille', 'OM'],
  'Olympique Lyonnais': ['Lyon', 'OL'],
  'LOSC Lille': ['Lille', 'LOSC'],
  'Stade Rennais FC 1901': ['Rennes'],
  'RC Lens': ['Lens'],
  'OGC Nice': ['Nice'],
  'RC Strasbourg Alsace': ['Strasbourg'],
  'Montpellier HSC': ['Montpellier'],
  'FC Nantes': ['Nantes'],
  'Stade Brestois 29': ['Brest'],
  'Stade de Reims': ['Reims'],
  'Toulouse FC': ['Toulouse'],
  'Angers SCO': ['Angers'],
  'Le Havre AC': ['Le Havre'],
  'AS Saint-Étienne': ['Saint-Etienne', 'St Etienne'],
  'AJ Auxerre': ['Auxerre'],
  'FC Lorient': ['Lorient'],
  'Clermont Foot 63': ['Clermont'],
  'FC Metz': ['Metz'],
  'Manchester City FC': ['Manchester City', 'Man City'],
  'Arsenal FC': ['Arsenal'],
  'Liverpool FC': ['Liverpool'],
  'Chelsea FC': ['Chelsea'],
  'Manchester United FC': ['Manchester United', 'Man United', 'Man Utd'],
  'Tottenham Hotspur FC': ['Tottenham', 'Spurs'],
  'Newcastle United FC': ['Newcastle', 'Newcastle United'],
  'Brighton & Hove Albion FC': ['Brighton'],
  'Aston Villa FC': ['Aston Villa'],
  'West Ham United FC': ['West Ham'],
  'Crystal Palace FC': ['Crystal Palace'],
  'Brentford FC': ['Brentford'],
  'Wolverhampton Wanderers FC': ['Wolves', 'Wolverhampton'],
  'Fulham FC': ['Fulham'],
  'AFC Bournemouth': ['Bournemouth'],
  'Nottingham Forest FC': ['Nottingham Forest', "Nott'm Forest"],
  'Everton FC': ['Everton'],
  'Ipswich Town FC': ['Ipswich', 'Ipswich Town'],
  'Leicester City FC': ['Leicester', 'Leicester City'],
  'Southampton FC': ['Southampton'],
  'Burnley FC': ['Burnley'],
  'Sheffield United FC': ['Sheffield United', 'Sheffield Utd'],
  'Luton Town FC': ['Luton', 'Luton Town'],
  'Real Madrid CF': ['Real Madrid'],
}

function normalizeTeamName(name: string): string[] {
  const aliases = NAME_MAP[name]
  if (aliases) return [name, ...aliases]
  return [name]
}

function spearmanCorrelation(x: number[], y: number[]): number {
  const n = x.length
  if (n < 2) return 0

  function rankArray(arr: number[]): number[] {
    const sorted = arr.map((v, i) => ({ v, i })).sort((a, b) => b.v - a.v)
    const ranks = new Array(n)
    for (let i = 0; i < n; i++) {
      ranks[sorted[i].i] = i + 1
    }
    return ranks
  }

  const rankX = rankArray(x)
  const rankY = rankArray(y)

  let sumD2 = 0
  for (let i = 0; i < n; i++) {
    const d = rankX[i] - rankY[i]
    sumD2 += d * d
  }

  return 1 - (6 * sumD2) / (n * (n * n - 1))
}

function main() {
  // Load MSI ratings
  const ratingsPath = path.join('data', 'msi_ratings.json')
  if (!fs.existsSync(ratingsPath)) {
    console.error('No ratings file found. Run `npm run compute` first.')
    process.exit(1)
  }

  const ratingsData: RatingsFile = JSON.parse(fs.readFileSync(ratingsPath, 'utf-8'))
  const msiTeams = ratingsData.teams

  // Try to load ClubElo reference
  const refPath = path.join('data', 'reference', 'tsi_current.json')
  let clubEloData: any = null

  if (fs.existsSync(refPath)) {
    clubEloData = JSON.parse(fs.readFileSync(refPath, 'utf-8'))
  }

  console.log('MSI Elo Validation Report')
  console.log('='.repeat(80))
  console.log(`Matches processed: ${ratingsData.matchesProcessed}`)
  console.log(`Teams rated: ${msiTeams.length}`)
  console.log(`Config: K=${ratingsData.config.kFactor}, Home=${ratingsData.config.homeAdvantage}, GoalMargin=${ratingsData.config.goalMarginFactor}`)
  console.log()

  // Self-validation: check rating distribution
  const ratings = msiTeams.map(t => t.rating)
  const avgRating = ratings.reduce((a, b) => a + b, 0) / ratings.length
  const maxRating = Math.max(...ratings)
  const minRating = Math.min(...ratings)

  console.log('Rating Distribution:')
  console.log(`  Average: ${avgRating.toFixed(0)}`)
  console.log(`  Highest: ${maxRating} (${msiTeams[0].team})`)
  console.log(`  Lowest:  ${minRating} (${msiTeams[msiTeams.length - 1].team})`)
  console.log(`  Spread:  ${maxRating - minRating}`)
  console.log()

  if (!clubEloData) {
    console.log('No ClubElo reference data found at data/reference/tsi_current.json')
    console.log('Skipping cross-validation. Showing MSI-only results.\n')
    printMSIOnlyTable(msiTeams)
    return
  }

  // Build ClubElo lookup
  const clubEloTeams = extractClubEloTeams(clubEloData)

  if (clubEloTeams.length === 0) {
    console.log('Could not extract ClubElo team data from reference file.')
    console.log('Showing MSI-only results.\n')
    printMSIOnlyTable(msiTeams)
    return
  }

  // Match teams
  const matched: {
    name: string
    msiRating: number
    msiRank: number
    clubEloRating: number
    clubEloRank: number
  }[] = []

  for (let i = 0; i < msiTeams.length; i++) {
    const msi = msiTeams[i]
    const aliases = normalizeTeamName(msi.team)

    for (const ceTeam of clubEloTeams) {
      const ceAliases = [ceTeam.name, ...(ceTeam.aliases || [])]
      const found = aliases.some(a =>
        ceAliases.some(c => c.toLowerCase() === a.toLowerCase())
      )

      if (found) {
        matched.push({
          name: msi.team,
          msiRating: msi.rating,
          msiRank: i + 1,
          clubEloRating: ceTeam.rating,
          clubEloRank: ceTeam.rank,
        })
        break
      }
    }
  }

  console.log(`Matched ${matched.length} teams between MSI and ClubElo\n`)

  // Print comparison table
  console.log(
    'Team'.padEnd(30) +
    'MSI Elo'.padStart(8) +
    'ClubElo'.padStart(9) +
    'Diff'.padStart(7) +
    'MSI Rk'.padStart(8) +
    'CE Rk'.padStart(7)
  )
  console.log('-'.repeat(69))

  for (const t of matched.slice(0, 30)) {
    const diff = t.msiRating - t.clubEloRating
    console.log(
      t.name.padEnd(30) +
      String(t.msiRating).padStart(8) +
      String(t.clubEloRating).padStart(9) +
      (diff >= 0 ? `+${diff}` : String(diff)).padStart(7) +
      String(t.msiRank).padStart(8) +
      String(t.clubEloRank).padStart(7)
    )
  }

  console.log()

  // Compute correlation
  const msiRatingsMatched = matched.map(t => t.msiRating)
  const clubEloRatingsMatched = matched.map(t => t.clubEloRating)
  const correlation = spearmanCorrelation(msiRatingsMatched, clubEloRatingsMatched)

  const absErrors = matched.map(t => Math.abs(t.msiRating - t.clubEloRating))
  const mae = absErrors.reduce((a, b) => a + b, 0) / absErrors.length
  const within50 = absErrors.filter(e => e <= 50).length

  console.log('Cross-validation metrics:')
  console.log(`  Spearman rank correlation: ${correlation.toFixed(4)}`)
  console.log(`  Mean absolute error:       ${mae.toFixed(1)} Elo points`)
  console.log(`  Teams within 50 Elo:       ${within50}/${matched.length} (${((within50 / matched.length) * 100).toFixed(0)}%)`)
}

function extractClubEloTeams(data: any): { name: string; rating: number; rank: number; aliases?: string[] }[] {
  // Try various formats the TSI data might be in
  const teams: { name: string; rating: number; rank: number }[] = []

  if (Array.isArray(data)) {
    // Array of team objects
    for (let i = 0; i < data.length; i++) {
      const t = data[i]
      if (t.team && t.elo) {
        teams.push({ name: t.team, rating: Math.round(t.elo), rank: i + 1 })
      } else if (t.name && t.rating) {
        teams.push({ name: t.name, rating: Math.round(t.rating), rank: i + 1 })
      } else if (t.club && t.elo) {
        teams.push({ name: t.club, rating: Math.round(t.elo), rank: i + 1 })
      }
    }
  } else if (data.teams && Array.isArray(data.teams)) {
    return extractClubEloTeams(data.teams)
  } else if (data.ratings && Array.isArray(data.ratings)) {
    return extractClubEloTeams(data.ratings)
  } else if (typeof data === 'object') {
    // Object with team names as keys
    const entries = Object.entries(data)
    const sorted = entries
      .filter(([_, v]: [string, any]) => typeof v === 'object' && v !== null)
      .map(([name, v]: [string, any]) => ({
        name,
        rating: Math.round(v.elo || v.rating || v.clubElo || 0),
        rank: 0,
      }))
      .filter(t => t.rating > 0)
      .sort((a, b) => b.rating - a.rating)

    sorted.forEach((t, i) => (t.rank = i + 1))
    return sorted
  }

  return teams.sort((a, b) => b.rating - a.rating)
}

function printMSIOnlyTable(teams: TeamRating[]) {
  console.log(
    '#'.padStart(3) +
    '  ' +
    'Team'.padEnd(30) +
    'Rating'.padStart(7) +
    '  ' +
    'W-D-L'.padStart(10) +
    '  ' +
    'Matches'.padStart(7)
  )
  console.log('-'.repeat(62))

  for (let i = 0; i < Math.min(30, teams.length); i++) {
    const t = teams[i]
    console.log(
      String(i + 1).padStart(3) +
      '  ' +
      t.team.padEnd(30) +
      String(t.rating).padStart(7) +
      '  ' +
      `${t.wins}-${t.draws}-${t.losses}`.padStart(10) +
      '  ' +
      String(t.matches).padStart(7)
    )
  }
}

main()
