import { z } from 'zod';

export const RedFlagSchema = z.object({
  clause: z.string().describe("The exact quoted clause or text snippet from the tender document"),
  page: z.number().describe("Page number where the clause is located"),
  reason: z.string().describe("Clear explanation of why this clause presents a risk or disqualification threat")
});

export const ResearchSourceSchema = z.object({
  title: z.string(),
  url: z.string(),
  snippet: z.string()
});

export const BidDecisionSchema = z.object({
  recommendation: z.enum(['Bid', 'Consider', 'No-bid']),
  fit_score: z.number().min(0).max(100).describe("Overall technical and strategic fit score between 0 and 100"),
  red_flags: z.array(RedFlagSchema).describe("List of 3 to 5 critical red flags with exact clauses and page numbers"),
  estimated_effort: z.string().describe("Estimated human effort required to complete the bid response"),
  reasoning: z.string().describe("Executive rationale for the recommendation based on capabilities and risks")
});

export const SectionSplitterSchema = z.object({
  sections: z.array(z.object({
    title: z.string(),
    startPage: z.number(),
    endPage: z.number(),
    content: z.string()
  }))
});

export const ExtractedRequirementSchema = z.object({
  req_id: z.string().describe("Sequential requirement ID e.g. REQ-001"),
  text: z.string().describe("Exact requirement text from the tender"),
  type: z.enum(['Mandatory', 'Optional']).describe("Whether the requirement is mandatory (shall, must, required) or optional (should, preferred)"),
  section: z.string().describe("Section name or header"),
  page: z.number().describe("Page number in the document")
});

export const RequirementExtractorSchema = z.object({
  requirements: z.array(ExtractedRequirementSchema)
});

export const ComplianceJudgeSchema = z.object({
  status: z.enum(['Met', 'Partial', 'Gap']),
  reason: z.string().describe("Short justification for the compliance status"),
  confidence: z.number().min(0).max(1)
});

export const DraftAnswerSchema = z.object({
  answer: z.string().describe("Draft response grounded strictly in provided evidence or empty string if no evidence"),
  confidence: z.number().min(0).max(1),
  source_notes: z.string().optional()
});

export const EvaluationCriterionExtractSchema = z.object({
  name: z.string(),
  weight: z.number().describe("Weight as a percentage (e.g. 25)")
});

export const TenderCriteriaExtractorSchema = z.object({
  criteria: z.array(EvaluationCriterionExtractSchema)
});

export const CriterionScoreSchema = z.object({
  name: z.string(),
  score: z.number().min(0).max(100),
  justification: z.string().describe("One-line justification for the assigned score")
});

export const BuyerScorerSchema = z.object({
  per_criterion: z.array(CriterionScoreSchema),
  overall: z.number().min(0).max(100).describe("Weighted total score 0-100"),
  suggestions: z.array(z.string()).length(3).describe("Top 3 actionable changes that would raise the buyer score most")
});
