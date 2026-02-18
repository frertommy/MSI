/**
 * API Route: GET /api/l3-derived/[teamId]
 *
 * Returns L3 market-derived rating for a team.
 * Designed for future live consumption (WebSocket, polling, etc.)
 */
import { NextRequest, NextResponse } from "next/server";
import { l3Source } from "@/lib/dataSources/l3";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
) {
  const { teamId } = await params;
  const teamName = decodeURIComponent(teamId);

  const detail = l3Source.getTeamDetail(teamName);
  if (!detail) {
    return NextResponse.json(
      { error: "Team not found", team: teamName },
      { status: 404 }
    );
  }

  const allRatings = l3Source.getRatings();
  const rank = allRatings.findIndex((r) => r.team === teamName) + 1;

  return NextResponse.json({
    teamId: teamName,
    teamName: teamName,
    rank,
    l3Derived: {
      rating: detail.l3Rating,
      baseElo: detail.baseElo,
      marketConsensus: detail.marketConsensus,
      premium: detail.premium,
      timestamp: detail.timestamp,
      confidence: detail.confidence,
      components: {
        matchOdds: {
          rating: detail.components.matchImplied,
          matchCount: detail.components.matchCount,
          averageWinProb: detail.components.avgWinProb,
          weight: 0.80,
        },
      },
      oraclePrice: detail.oraclePrice,
      oracleConfidence: detail.oracleConfidence,
      freshness: detail.dataFreshness,
    },
  });
}
