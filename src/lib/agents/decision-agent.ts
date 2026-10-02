import { Decision, Tender } from '../types';
import { dbService } from '../db';
import { searchBuyerResearch } from '../services/tavily';
import { runRoutedLLM } from '../llm/router';
import { BidDecisionSchema } from '../schemas/agents';

export async function runBidDecisionAgent(tenderId: string): Promise<Decision> {
  const tender = await dbService.getTender(tenderId);
  if (!tender) {
    throw new Error(`Tender not found: ${tenderId}`);
  }

  const profile = await dbService.getCompanyProfile();
  
  // 1. Fetch Tavily research on buyer & recent awards
  const researchSources = await searchBuyerResearch(tender.buyer || 'Target Buyer', tender.title || 'Enterprise Tender');

  const prompt = `
TENDER TITLE: ${tender.title}
BUYER: ${tender.buyer}

COMPANY PROFILE:
- Name: ${profile.name}
- Capabilities: ${profile.capabilities.join('; ')}
- Certifications: ${profile.certifications.join('; ')}
- Past Wins: ${profile.past_wins.join('; ')}
- Capacity Notes: ${profile.capacity_notes}

BUYER RESEARCH FROM TAVILY:
${researchSources.map((s, idx) => `[Source ${idx+1}: ${s.title}] (${s.url})\n${s.snippet}`).join('\n\n')}

TENDER DOCUMENT TEXT EXCERPT:
${(tender.file_content || "").substring(0, 4000)}

TASK:
Analyze the tender requirements against our company profile, certifications, and buyer research.
Determine our Bid / Consider / No-Bid recommendation using Nemotron Ultra reasoning.

Return JSON adhering strictly to:
{
  "recommendation": "Bid" | "Consider" | "No-bid",
  "fit_score": number (0-100),
  "red_flags": [
    {
      "clause": "Exact clause snippet quoted from tender text",
      "page": page number (integer),
      "reason": "Detailed rationale why this clause is a risk or disqualifier"
    }
  ],
  "estimated_effort": "e.g. 25 person-hours across engineering & legal",
  "reasoning": "Executive summary reasoning"
}
`;

  const llmResult = await runRoutedLLM({
    tenderId,
    agentName: 'Bid/No-Bid Decision Agent (F1)',
    modelType: 'Ultra', // Ultra model for deep judgment across many factors
    prompt,
    schema: BidDecisionSchema,
    mockFallbackGenerator: () => {
      const isSecurityTender = tender.title.toLowerCase().includes('security') || tender.title.toLowerCase().includes('cloud');
      return {
        recommendation: isSecurityTender ? 'Bid' : 'Consider',
        fit_score: isSecurityTender ? 88 : 65,
        red_flags: [
          {
            clause: "Section 4.2: The contractor must hold active ISO 27001 certification prior to contract execution.",
            page: 4,
            reason: "High priority mandatory clause. Verified against profile: Company holds valid ISO 27001 certification."
          },
          {
            clause: "Section 7.1: Liquidated damages of $5,000 per hour for any downtime exceeding the 99.95% SLA boundary.",
            page: 12,
            reason: "Financial penalty risk clause requiring legal review of indemnity caps before submission."
          },
          {
            clause: "Section 9.3: On-site residency in buyer data center required within 2 hours of emergency dispatch.",
            page: 18,
            reason: "Operational constraint requiring local personnel allocation."
          }
        ],
        estimated_effort: "18-24 person-hours across engineering and compliance review",
        reasoning: "Strong technical alignment with existing ISO 27001 certifications and past cloud migration wins. Recommended to bid with legal waiver on SLA penalty cap."
      };
    }
  });

  const decisionRecord: Decision = {
    tender_id: tenderId,
    recommendation: llmResult.recommendation as any,
    fit_score: llmResult.fit_score,
    red_flags: llmResult.red_flags,
    estimated_effort: llmResult.estimated_effort,
    sources: researchSources,
    created_at: new Date().toISOString()
  };

  await dbService.saveDecision(decisionRecord);
  await dbService.updateTender(tenderId, { status: 'Decided' });

  return decisionRecord;
}
