import { ScoreRecord, EvaluationCriterion } from '../types';
import { dbService } from '../db';
import { runRoutedLLM } from '../llm/router';
import { BuyerScorerSchema, TenderCriteriaExtractorSchema } from '../schemas/agents';
import { splitTextIntoSections } from '../services/pdf';

export async function runMockBuyerScorer(tenderId: string): Promise<ScoreRecord> {
  const tender = await dbService.getTender(tenderId);
  if (!tender) {
    throw new Error(`Tender not found: ${tenderId}`);
  }

  const requirements = await dbService.getRequirements(tenderId);
  const existingScores = await dbService.getScores(tenderId);
  const nextVersion = existingScores.length + 1;
  const sections = splitTextIntoSections(tender.file_content || "", tender.total_pages || 10);

  // 1. Extract or fetch evaluation criteria
  let criteria: EvaluationCriterion[] = tender.evaluation_criteria || [];

  if (criteria.length === 0) {
    // Find sections that mention evaluation, award, criteria, weights, or scoring
    const evalSections = sections.filter(s => 
      /evaluation|award|criteria|scoring|weight|basis/i.test(s.title) ||
      /evaluation criteria|award criteria|percentage weight|scoring method/i.test(s.content)
    );

    const evalTextContent = evalSections.length > 0 
      ? evalSections.map(s => `[${s.title}]\n${s.content}`).join('\n\n')
      : sections.map(s => `[${s.title}]\n${s.content.slice(0, 400)}`).join('\n\n');

    const extractPrompt = `
TENDER TITLE: ${tender.title}
BUYER: ${tender.buyer}

EVALUATION & AWARD SECTIONS (EXTRACTED ACROSS TENDER):
${evalTextContent.slice(0, 6000)}

TASK:
Extract the official tender evaluation criteria and percentage weights (summing to 100%).
If weights are not explicitly quantified in the text, extract the stated evaluation factors and assign balanced weights reflecting their stated priority in the text.

Return JSON:
{
  "criteria": [
    { "name": "Technical Architecture & Capability", "weight": 40 },
    { "name": "Security, Compliance & ISO Certifications", "weight": 35 },
    { "name": "SLA & Operational Support", "weight": 25 }
  ]
}
`;

    const extracted = await runRoutedLLM({
      tenderId,
      agentName: 'Tender Evaluation Criteria Extractor (F4)',
      modelType: 'Super',
      prompt: extractPrompt,
      schema: TenderCriteriaExtractorSchema,
      mockFallbackGenerator: () => ({
        criteria: [
          { name: "Technical Architecture & Capability", weight: 40 },
          { name: "Security, Compliance & ISO Certifications", weight: 35 },
          { name: "SLA, Support & Disaster Recovery", weight: 25 }
        ]
      })
    });

    criteria = extracted.criteria;
    await dbService.updateTender(tenderId, { evaluation_criteria: criteria });
  }

  // Build full draft response digest organized by compliance status
  const gaps = requirements.filter(r => r.status === 'Gap');
  const partials = requirements.filter(r => r.status === 'Partial');
  const mets = requirements.filter(r => r.status === 'Met');

  const draftSummary = `
TOTAL REQUIREMENTS: ${requirements.length} (Met: ${mets.length}, Partial: ${partials.length}, Gaps: ${gaps.length})

GAPS / UNADDRESSED (${gaps.length}):
${gaps.map(r => `- [${r.req_id}] (${r.type}) ${r.text}`).slice(0, 20).join('\n') || 'None'}

PARTIAL COMPLIANCE (${partials.length}):
${partials.map(r => `- [${r.req_id}] ${r.text}\n  Draft: ${r.draft_answer}`).slice(0, 15).join('\n') || 'None'}

MET REQUIREMENTS SAMPLE (${mets.length}):
${mets.map(r => `- [${r.req_id}] ${r.text}\n  Draft: ${r.draft_answer.slice(0, 200)}...`).slice(0, 10).join('\n')}
`;

  const scorerPrompt = `
TENDER TITLE: ${tender.title}
BUYER: ${tender.buyer}

EVALUATION CRITERIA & WEIGHTS:
${criteria.map(c => `- ${c.name}: ${c.weight}%`).join('\n')}

COMPLIANCE & DRAFT RESPONSES DIGEST:
${draftSummary}

TASK:
You are the Buyer's Evaluation Board. Act as a strict, impartial procurement evaluator.
Score our proposal draft for EACH criterion on a scale of 0 to 100 based strictly on evidence completeness and gaps.
Dock heavy points for mandatory Gaps or missing certifications.
Calculate the overall weighted score (0 to 100).
Identify the TOP 3 specific changes that would raise our score most.

Return JSON strictly:
{
  "per_criterion": [
    {
      "name": "Criterion Name",
      "score": number (0-100),
      "justification": "One line clear evaluator justification"
    }
  ],
  "overall": number (0-100),
  "suggestions": [
    "Suggestion 1 to increase score",
    "Suggestion 2 to increase score",
    "Suggestion 3 to increase score"
  ]
}
`;

  const evalResult = await runRoutedLLM({
    tenderId,
    agentName: 'Mock Buyer Scorer (F4)',
    modelType: 'Ultra', // Ultra model for subtle, high-stakes buyer judgment
    prompt: scorerPrompt,
    schema: BuyerScorerSchema,
    mockFallbackGenerator: () => {
      // Calculate dynamic score based on answered requirements
      const metCount = requirements.filter(r => r.status === 'Met').length;
      const totalCount = requirements.length || 1;
      const ratio = metCount / totalCount;
      const baseScore = Math.min(95, Math.max(50, Math.round(55 + ratio * 38)));

      return {
        per_criterion: criteria.map(c => ({
          name: c.name,
          score: baseScore + (c.name.includes('Security') ? 5 : -2),
          justification: `Evaluated ${metCount}/${totalCount} requirements met; strong compliance evidence present.`
        })),
        overall: baseScore,
        suggestions: [
          "Provide explicit SLA penalty waiver documentation in Section 7.1 to secure maximum points on Support & SLA.",
          "Add past performance client references for sub-1 hour RTO disaster recovery to upgrade Technical rating from 80 to 95.",
          "Resolve remaining mandatory Gap items by accepting suggested past-bid template evidence."
        ]
      };
    }
  });

  const scoreRecord: ScoreRecord = {
    tender_id: tenderId,
    version: nextVersion,
    per_criterion: evalResult.per_criterion.map(c => {
      const match = criteria.find(cr => cr.name === c.name);
      return {
        name: c.name,
        weight: match ? match.weight : 25,
        score: c.score,
        justification: c.justification
      };
    }),
    overall: evalResult.overall,
    suggestions: evalResult.suggestions,
    created_at: new Date().toISOString()
  };

  await dbService.saveScore(scoreRecord);
  return scoreRecord;
}
