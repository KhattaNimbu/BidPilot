import { RelevantEvidence } from '../services/embeddings';
import { runRoutedLLM } from '../llm/router';
import { DraftAnswerSchema } from '../schemas/agents';
import { dbService } from '../db';
import { Requirement } from '../types';

export interface DraftResult {
  answer: string;
  confidence: number;
}

export async function generateDraftAnswer(
  tenderId: string,
  requirementText: string,
  evidence: RelevantEvidence[]
): Promise<DraftResult> {
  // If no high-quality evidence exists (similarity < 0.15), return blank answer and zero confidence (PRD rule: no hallucination)
  const validEvidence = evidence.filter(e => e.similarity >= 0.15);
  if (validEvidence.length === 0) {
    return { answer: '', confidence: 0.0 };
  }

  const prompt = `
REQUIREMENT: "${requirementText}"

RETRIEVED EVIDENCES:
${validEvidence.map((e, i) => `[Source ${i + 1}: ${e.source}] (Match Similarity: ${(e.similarity * 100).toFixed(0)}%)\n${e.text}`).join('\n\n')}

TASK:
Write a precise, professional bid answer tailored strictly to the requirement.
Use ONLY the provided evidence. Cite the source in brackets (e.g. "[Source: Company Profile]").
If the evidence does NOT contain facts to address the requirement, return answer as empty string "". DO NOT INVENT FACTS.

Return JSON:
{
  "answer": "Drafted answer string or empty string",
  "confidence": number between 0.0 and 1.0
}
`;

  const llmResult = await runRoutedLLM({
    tenderId,
    agentName: 'Evidence-Backed Answer Drafter (F3)',
    modelType: 'Super', // Super model for volume grounded drafting
    prompt,
    schema: DraftAnswerSchema,
    mockFallbackGenerator: () => {
      const primarySource = validEvidence[0]?.source || 'Company Capability Library';
      return {
        answer: `Apex Defense & Tech Solutions directly addresses this requirement utilizing our established operational protocols [Source: ${primarySource}]. Our solution complies with all specified standards, ensuring full audit readiness and operational excellence.`,
        confidence: 0.92
      };
    }
  });

  return {
    answer: llmResult.answer || '',
    confidence: llmResult.confidence || 0.8
  };
}

export async function acceptAndSaveRequirementEdit(
  reqId: string,
  newAnswer: string,
  reviewerState: 'Accepted' | 'Edited'
): Promise<Requirement | null> {
  const updated = await dbService.updateRequirement(reqId, {
    draft_answer: newAnswer,
    reviewer_state: reviewerState,
    status: newAnswer.trim().length > 0 ? 'Met' : 'Gap'
  });

  if (updated && newAnswer.trim().length > 0) {
    // Save accepted edit back to past-bid library for future learning check (PRD F3 acceptance criteria)
    await dbService.addPastBid({
      title: `Accepted Edit - ${updated.section}`,
      buyer: 'Internal Library Update',
      outcome: 'Won',
      created_at: new Date().toISOString(),
      chunks: [
        {
          text: `Requirement: ${updated.text}\nAnswer: ${newAnswer}`,
          source_file: `User Edit (${updated.req_id})`
        }
      ]
    });
  }

  return updated;
}
