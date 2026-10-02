import { NextResponse } from 'next/server';
import { runBidDecisionAgent } from '@/lib/agents/decision-agent';
import { dbService } from '@/lib/db';

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const tenderId = params.id;
    
    // Check if optional body includes manual user override
    let body: any = {};
    try {
      body = await req.json();
    } catch (_) {}

    if (body.user_override) {
      const existing = await dbService.getDecision(tenderId);
      if (existing) {
        existing.user_override = body.user_override;
        existing.user_notes = body.user_notes;
        await dbService.saveDecision(existing);
        return NextResponse.json(existing);
      }
    }

    const decision = await runBidDecisionAgent(tenderId);
    return NextResponse.json(decision);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function GET(req: Request, { params }: { params: { id: string } }) {
  try {
    const tenderId = params.id;
    const decision = await dbService.getDecision(tenderId);
    if (!decision) {
      return NextResponse.json({ error: 'Decision not found' }, { status: 404 });
    }
    return NextResponse.json(decision);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
