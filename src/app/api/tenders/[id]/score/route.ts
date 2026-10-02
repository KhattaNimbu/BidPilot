import { NextResponse } from 'next/server';
import { runMockBuyerScorer } from '@/lib/agents/scoring-agent';
import { dbService } from '@/lib/db';

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const tenderId = params.id;
    const scoreRecord = await runMockBuyerScorer(tenderId);
    return NextResponse.json(scoreRecord);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function GET(req: Request, { params }: { params: { id: string } }) {
  try {
    const tenderId = params.id;
    const scores = await dbService.getScores(tenderId);
    return NextResponse.json(scores);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
