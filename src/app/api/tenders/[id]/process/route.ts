import { NextResponse } from 'next/server';
import { processTenderRequirements } from '@/lib/agents/requirement-agent';

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const tenderId = params.id;
    
    // Kick off requirement processing asynchronously
    processTenderRequirements(tenderId).catch(err => {
      console.error(`Background job error for tender ${tenderId}:`, err);
    });

    return NextResponse.json({
      message: 'Background processing job initiated successfully',
      tender_id: tenderId,
      status: 'Processing'
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
