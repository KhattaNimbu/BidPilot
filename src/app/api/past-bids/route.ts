import { NextResponse } from 'next/server';
import { dbService } from '@/lib/db';
import { PastBid } from '@/lib/types';

export async function GET() {
  try {
    const pastBids = await dbService.getPastBids();
    return NextResponse.json(pastBids);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const pastBid: PastBid = {
      title: body.title || 'Past Tender Bid',
      buyer: body.buyer || 'Government Client',
      outcome: body.outcome || 'Won',
      chunks: body.chunks || [{ text: body.text || '', source_file: body.source_file || 'manual_entry.txt' }],
      created_at: new Date().toISOString()
    };

    await dbService.addPastBid(pastBid);
    return NextResponse.json(pastBid, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
