import { NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import { dbService } from '@/lib/db';

export async function GET(req: Request, { params }: { params: { id: string } }) {
  try {
    const tenderId = params.id;
    const tender = await dbService.getTender(tenderId);
    const requirements = await dbService.getRequirements(tenderId);
    const decision = await dbService.getDecision(tenderId);
    const scores = await dbService.getScores(tenderId);
    const latestScore = scores.length > 0 ? scores[scores.length - 1] : null;

    // Build Excel sheets
    // Sheet 1: Executive Summary & Recommendation
    const summaryData = [
      ["TENDER COMPLIANCE & DRAFT EXPORT"],
      ["Tender Title", tender?.title || tenderId],
      ["Buyer", tender?.buyer || 'N/A'],
      ["Bid Recommendation", decision?.recommendation || 'Pending'],
      ["Fit Score", `${decision?.fit_score || 0} / 100`],
      ["Predicted Buyer Score", `${latestScore?.overall || 0} / 100`],
      ["Export Date", new Date().toLocaleString()],
      [],
      ["CRITICAL RED FLAGS"],
      ["Clause", "Page", "Risk Rationale"],
      ...(decision?.red_flags || []).map(rf => [rf.clause, rf.page, rf.reason])
    ];
    const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);

    // Sheet 2: Compliance Matrix
    const matrixRows = requirements.map(r => ({
      ID: r.req_id,
      "Section": r.section,
      "Page": r.page,
      "Type": r.type,
      "Status": r.status,
      "Requirement Text": r.text,
      "Draft Answer": r.draft_answer,
      "Cited Evidence": r.evidence.join(' | '),
      "Confidence": `${Math.round(r.confidence * 100)}%`,
      "Reviewer State": r.reviewer_state
    }));
    const wsMatrix = XLSX.utils.json_to_sheet(matrixRows);

    // Create workbook
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, wsSummary, "Executive Summary");
    XLSX.utils.book_append_sheet(wb, wsMatrix, "Compliance Matrix");

    // Generate buffer
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    const safeTitle = (tender?.title || 'Tender').replace(/[^a-zA-Z0-9_-]/g, '_');
    const fileName = `BidPilot_Compliance_Matrix_${safeTitle}.xlsx`;

    return new NextResponse(buf, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${fileName}"`
      }
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
