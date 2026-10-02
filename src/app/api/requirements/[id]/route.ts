import { NextResponse } from 'next/server';
import { dbService } from '@/lib/db';
import { acceptAndSaveRequirementEdit, generateDraftAnswer } from '@/lib/agents/drafting-agent';
import { findRelevantEvidence } from '@/lib/services/embeddings';

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const reqId = params.id;
    const body = await req.json();

    const { action, draft_answer, reviewer_state } = body;

    if (action === 'regenerate') {
      // Find requirement details
      let targetReq = null;
      const tenders = await dbService.listTenders();
      for (const t of tenders) {
        const reqs = await dbService.getRequirements(t._id);
        const found = reqs.find(r => r._id === reqId);
        if (found) {
          targetReq = found;
          break;
        }
      }

      if (!targetReq) {
        return NextResponse.json({ error: 'Requirement not found' }, { status: 404 });
      }

      const evidence = await findRelevantEvidence(targetReq.text, 3);
      const regenerated = await generateDraftAnswer(targetReq.tender_id, targetReq.text, evidence);

      const updated = await dbService.updateRequirement(reqId, {
        draft_answer: regenerated.answer,
        confidence: regenerated.confidence,
        reviewer_state: 'Draft',
        status: regenerated.answer.trim().length > 0 ? 'Met' : 'Gap'
      });

      return NextResponse.json(updated);
    }

    // Default action: accept or save edit
    const updated = await acceptAndSaveRequirementEdit(
      reqId,
      draft_answer || '',
      reviewer_state || 'Accepted'
    );

    return NextResponse.json(updated);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
