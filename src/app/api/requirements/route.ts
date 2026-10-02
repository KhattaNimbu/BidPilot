import { NextResponse } from 'next/server';
import { dbService } from '@/lib/db';
import { acceptAndSaveRequirementEdit, generateDraftAnswer } from '@/lib/agents/drafting-agent';
import { findRelevantEvidence } from '@/lib/services/embeddings';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const tenderId = searchParams.get('tender_id');
    if (!tenderId) {
      return NextResponse.json({ error: 'tender_id is required' }, { status: 400 });
    }
    const reqs = await dbService.getRequirements(tenderId);
    return NextResponse.json(reqs);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
