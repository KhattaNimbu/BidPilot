import { Decision, Tender } from '../types';
import { dbService } from '../db';
import { searchBuyerResearch } from '../services/tavily';
import { runRoutedLLM } from '../llm/router';
import { BidDecisionSchema } from '../schemas/agents';
import { splitTextIntoSections } from '../services/pdf';

// Extract high-risk clause excerpts across the entire tender document
function extractTenderRiskExcerpts(content: string): string[] {
  const lines = content.split('\n');
  const riskKeywords = [
    'mandatory', 'shall', 'must', 'disqualif', 'penalty', 'liquidated damages',
    'bonding', 'insurance', 'liability', 'residency', 'conus', 'security clearance',
    '99.9', 'sla', 'termination', 'warranty', 'indemni'
  ];

  const excerpts: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.length > 20 && riskKeywords.some(kw => line.toLowerCase().includes(kw))) {
      // Grab surrounding context (1 line before, 1 line after)
      const prev = i > 0 ? lines[i - 1].trim() : '';
      const next = i < lines.length - 1 ? lines[i + 1].trim() : '';
      const snippet = [prev, line, next].filter(Boolean).join(' ');
      if (!excerpts.some(e => e.includes(line))) {
        excerpts.push(snippet);
      }
      if (excerpts.length >= 25) break; // Capped representative risk sample
    }
  }

  return excerpts;
}

export async function runBidDecisionAgent(tenderId: string): Promise<Decision> {
  const tender = await dbService.getTender(tenderId);
  if (!tender) {
    throw new Error(`Tender not found: ${tenderId}`);
  }

  const profile = await dbService.getCompanyProfile();
  const existingReqs = await dbService.getRequirements(tenderId);
  const sections = splitTextIntoSections(tender.file_content || "", tender.total_pages || 10);
  
  // 1. Fetch live Tavily research on buyer & procurement strategy
  const researchSources = await searchBuyerResearch(tender.buyer || 'Target Buyer', tender.title || 'Enterprise Tender');

  // 2. Build full-document structured risk digest
  const riskExcerpts = extractTenderRiskExcerpts(tender.file_content || "");
  const requirementsSummary = existingReqs.length > 0 
    ? existingReqs.map(r => `[${r.req_id} - Page ${r.page}] (${r.type}) ${r.text}`).slice(0, 30).join('\n')
    : sections.map(s => `[Section: ${s.title}, Page ${s.page}]\n${s.content.slice(0, 300)}...`).join('\n\n');

  const prompt = `
TENDER TITLE: ${tender.title}
BUYER: ${tender.buyer}
TOTAL PAGES: ${tender.total_pages || sections.length}

COMPANY PROFILE:
- Name: ${profile.name}
- Capabilities: ${profile.capabilities.join('; ')}
- Certifications: ${profile.certifications.join('; ')}
- Past Wins: ${profile.past_wins.join('; ')}
- Operational Capacity: ${profile.capacity_notes}

BUYER PROCUREMENT RESEARCH (TAVILY):
${researchSources.length > 0 
  ? researchSources.map((s, idx) => `[Source ${idx+1}: ${s.title}] (${s.url})\n${s.snippet}`).join('\n\n')
  : 'No external web search returned. Rely exclusively on verified company facts and tender text.'}

DOCUMENT STRUCTURE & HIGH-RISK CLAUSES (EXTRACTED ACROSS ENTIRE TENDER):
${riskExcerpts.join('\n---\n')}

REQUIREMENTS BREAKDOWN:
${requirementsSummary}

TASK:
Analyze our win probability, compliance fit, and disqualification risks using Nemotron Ultra multi-factor reasoning.
- Evaluate technical capability match vs mandatory certifications.
- Identify strict Red Flags (e.g. liquidated damages, mandatory ISO/FedRAMP, strict SLAs).
- Every Red Flag quoted clause MUST be an exact or near-exact quote from the tender text above. DO NOT INVENT CLAUSES.

Return JSON:
{
  "recommendation": "Bid" | "Consider" | "No-bid",
  "fit_score": number (0-100),
  "red_flags": [
    {
      "clause": "Exact clause snippet quoted from tender text",
      "page": page number (integer),
      "reason": "Detailed risk rationale"
    }
  ],
  "estimated_effort": "e.g. 20-30 person-hours across engineering & legal",
  "reasoning": "Executive summary reasoning"
}
`;

  const llmResult = await runRoutedLLM({
    tenderId,
    agentName: 'Bid/No-Bid Decision Agent (F1)',
    modelType: 'Ultra', // Ultra model for deep multi-factor judgment
    prompt,
    schema: BidDecisionSchema,
    mockFallbackGenerator: () => {
      const isSecurityTender = tender.title.toLowerCase().includes('security') || tender.title.toLowerCase().includes('cloud');
      return {
        recommendation: isSecurityTender ? 'Bid' : 'Consider',
        fit_score: isSecurityTender ? 88 : 65,
        red_flags: [
          {
            clause: "Section 2.1: The offeror MUST possess active ISO/IEC 27001 Information Security Management Certification at proposal submission.",
            page: 4,
            reason: "High priority mandatory clause. Verified against profile: Company holds active ISO 27001."
          },
          {
            clause: "Section 4.4: Vendor shall agree to $5,000 per hour liquidated damages for downtime exceeding SLA.",
            page: 28,
            reason: "Financial penalty risk requiring indemnity cap negotiation before contract signature."
          }
        ],
        estimated_effort: "18-24 person-hours across engineering and compliance review",
        reasoning: "Strong technical alignment with existing ISO 27001 certifications and past cloud migration wins. Recommended to bid with legal waiver on SLA penalty cap."
      };
    }
  });

  // Ground-truth check on red flags: verify clause existence in tender text
  const fullText = (tender.file_content || "").toLowerCase();
  const verifiedRedFlags = (llmResult.red_flags || []).map(flag => {
    const clauseTokens = flag.clause.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(w => w.length > 3);
    const matches = clauseTokens.filter(t => fullText.includes(t));
    const isGrounded = clauseTokens.length === 0 || (matches.length / clauseTokens.length) >= 0.5;

    return {
      clause: flag.clause,
      page: flag.page,
      reason: isGrounded ? flag.reason : `[Unverified Citation Warning] ${flag.reason}`
    };
  });

  const decisionRecord: Decision = {
    tender_id: tenderId,
    recommendation: llmResult.recommendation as any,
    fit_score: llmResult.fit_score,
    red_flags: verifiedRedFlags,
    estimated_effort: llmResult.estimated_effort,
    sources: researchSources,
    created_at: new Date().toISOString()
  };

  await dbService.saveDecision(decisionRecord);
  await dbService.updateTender(tenderId, { status: 'Decided' });

  return decisionRecord;
}
