import { NextResponse } from 'next/server';
import { dbService } from '@/lib/db';

export async function GET(req: Request, { params }: { params: { id: string } }) {
  try {
    const tenderId = params.id;
    const job = await dbService.getJobStatus(tenderId);
    const requirements = await dbService.getRequirements(tenderId);

    return NextResponse.json({
      tender_id: tenderId,
      stage: job?.stage || (requirements.length > 0 ? 'complete' : 'idle'),
      progress: job?.progress || (requirements.length > 0 ? 100 : 0),
      message: job?.message || '',
      requirements_count: requirements.length
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
