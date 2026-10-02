import { ScoreRecord, EvaluationCriterion } from '../types';
import { dbService } from '../db';
import { runRoutedLLM } from '../llm/router';
import { BuyerScorerSchema, TenderCriteriaExtractorSchema } from '../schemas/agents';

export async function runMockBuyerScorer(tenderId: string): Promise<ScoreRecord> {
  const tender = await dbService.getTender(tenderId);
  if (!tender) {
    throw new Error(`Tender not found: ${tenderId}`);
  }

  const requirements = await dbService.getRequirements(tenderId);
  const existingScores = await dbService.getScores(tenderId);
  const nextVersion = existingScores.length + 1;

  // 1. Extract or fetch evaluation criteria
  let criteria: EvaluationCriterion[] = tender.evaluation_criteria || [];

  if (criteria.length === 0) {
    const extractPrompt = `
TENDER TEXT EXCERPT:
${(tender.file_content || "").substring(0, 3500)}

TASK:
Extract the evaluation criteria and their respective percentage weights (e.g., Technical 40%, Security 30%, SLA 30%).
If weights are not explicitly listed in text, infer reasonable default weights summing to 100%.

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

  // Build draft response summary for buyer evaluation
  const draftSummary = requirements.map(r => `
[${r.req_id}] Section: ${r.section} | Type: ${r.type} | Status: ${r.status}
Requirement: ${r.text}
Draft Answer: ${r.draft_answer || 'NONE (GAP)'}
  `).join('\n---\n');

  const scorerPrompt = `
TENDER TITLE: ${tender.title}
BUYER: ${tender.buyer}

EVALUATION CRITERIA & WEIGHTS:
${criteria.map(c => `- ${c.name}: ${c.weight}%`).join('\n')}

FULL DRAFT RESPONSES:
${draftSummary.substring(0, 5000)}

TASK:
You are the Buyer's Evaluation Board. Act as a strict, impartial procurement evaluator.
Score our bid draft for EACH criterion on a scale of 0 to 100 based strictly on completeness, compliance, and evidence.
Calculate the overall weighted score (0 to 100).
Identify the TOP 3 specific changes that would raise our score most.

Return JSON adhering strictly to:
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
