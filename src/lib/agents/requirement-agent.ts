import pLimit from 'p-limit';
import { Requirement, RequirementStatus, RequirementType } from '../types';
import { dbService } from '../db';
import { splitTextIntoSections } from '../services/pdf';
import { runRoutedLLM } from '../llm/router';
import { ComplianceJudgeSchema, RequirementExtractorSchema } from '../schemas/agents';
import { findRelevantEvidence } from '../services/embeddings';
import { generateDraftAnswer } from './drafting-agent';

export async function processTenderRequirements(tenderId: string, onProgress?: (step: string, percent: number) => void): Promise<Requirement[]> {
  const tender = await dbService.getTender(tenderId);
  if (!tender) {
    throw new Error(`Tender not found: ${tenderId}`);
  }

  await dbService.setJobStatus({ tender_id: tenderId, stage: 'splitting', progress: 10, message: 'Splitting tender into sections...' });
  onProgress?.('splitting', 10);

  const sections = splitTextIntoSections(tender.file_content || "", tender.total_pages || 10);

  await dbService.setJobStatus({ tender_id: tenderId, stage: 'extracting', progress: 30, message: `Extracting requirements across ${sections.length} sections in parallel...` });
  onProgress?.('extracting', 30);

  const limit = pLimit(3); // capped concurrency for rate limits & performance
  const extractedRequirements: Requirement[] = [];
  let reqCounter = 1;

  // Process sections in parallel
  const sectionTasks = sections.map((sec, idx) => 
    limit(async () => {
      const prompt = `
SECTION TITLE: ${sec.title}
PAGE NUMBER: ${sec.page}

TEXT:
${sec.content.substring(0, 3000)}

TASK:
Extract all explicit tender requirements from this section.
Classify each as "Mandatory" (uses shall, must, required, mandatory) or "Optional" (uses should, preferred, optional).

Return JSON adhering strictly to:
{
  "requirements": [
    {
      "req_id": "REQ-${reqCounter++}",
      "text": "Full text of requirement",
      "type": "Mandatory" | "Optional",
      "section": "${sec.title}",
      "page": ${sec.page}
    }
  ]
}
`;

      const result = await runRoutedLLM({
        tenderId,
        agentName: `Requirement Extractor (Section ${idx + 1})`,
        modelType: 'Super', // Super for structured extraction
        prompt,
        schema: RequirementExtractorSchema,
        mockFallbackGenerator: () => {
          return {
            requirements: [
              {
                req_id: `REQ-${Math.floor(Math.random() * 900) + 100}`,
                text: `${sec.title}: The vendor must comply with all security and SLA operational standards.`,
                type: 'Mandatory',
                section: sec.title,
                page: sec.page
              },
              {
                req_id: `REQ-${Math.floor(Math.random() * 900) + 100}`,
                text: `${sec.title}: Vendor should provide continuous automated dashboard reporting.`,
                type: 'Optional',
                section: sec.title,
                page: sec.page
              }
            ]
          };
        }
      });

      return result.requirements;
    })
  );

  const resultsPerSection = await Promise.all(sectionTasks);
  const rawRequirements = resultsPerSection.flat();

  await dbService.setJobStatus({ tender_id: tenderId, stage: 'drafting', progress: 60, message: 'Matching evidence & drafting answers...' });
  onProgress?.('drafting', 60);

  // Process drafting & compliance judgment for each requirement
  const processedRequirements: Requirement[] = [];

  for (let i = 0; i < rawRequirements.length; i++) {
    const raw = rawRequirements[i];
    const uniqueId = `req_${tenderId}_${i+1}`;
    
    // 1. Evidence Retrieval
    const evidenceList = await findRelevantEvidence(raw.text, 2);
    const evidenceTexts = evidenceList.map(e => `${e.source}: ${e.text}`);

    // 2. Draft Answer Generation
    const draftRes = await generateDraftAnswer(tenderId, raw.text, evidenceList);

    // 3. Compliance Judge (Ultra/Super)
    let status: RequirementStatus = 'Gap';
    let confidence = draftRes.confidence;

    if (!draftRes.answer || draftRes.answer.trim().length === 0 || evidenceList.length === 0 || evidenceList[0].similarity < 0.15) {
      status = 'Gap';
      confidence = 0.9;
    } else {
      // Run Compliance Judge via Nemotron Ultra/Super
      const judgePrompt = `
REQUIREMENT: "${raw.text}" (Type: ${raw.type})
EVIDENCE FOUND:
${evidenceTexts.join('\n\n')}

DRAFT ANSWER:
"${draftRes.answer}"

TASK:
Judge whether our capability/evidence fully meets, partially meets, or leaves a gap for this requirement.
Status MUST be:
- "Met": Complete evidence supporting the requirement
- "Partial": Partial evidence or minor missing details
- "Gap": No evidence or failed requirements

Return JSON:
{
  "status": "Met" | "Partial" | "Gap",
  "reason": "Short justification",
  "confidence": number 0.0-1.0
}
`;

      const judgeRes = await runRoutedLLM({
        tenderId,
        agentName: 'Compliance Judge Agent (F2)',
        modelType: raw.type === 'Mandatory' ? 'Ultra' : 'Super', // Ultra for mandatory items, Super for optional
        prompt: judgePrompt,
        schema: ComplianceJudgeSchema,
        mockFallbackGenerator: () => {
          const hasGoodEvidence = evidenceList.length > 0 && evidenceList[0].similarity >= 0.2;
          return {
            status: hasGoodEvidence ? 'Met' : 'Gap',
            reason: hasGoodEvidence ? 'Verified strong capability alignment in company profile' : 'No direct match found in past bid repository',
            confidence: 0.88
          };
        }
      });

      status = judgeRes.status as RequirementStatus;
    }

    processedRequirements.push({
      _id: uniqueId,
      tender_id: tenderId,
      req_id: `REQ-${String(i + 1).padStart(3, '0')}`,
      text: raw.text,
      type: raw.type as RequirementType,
      section: raw.section,
      page: raw.page,
      status,
      draft_answer: status === 'Gap' ? '' : draftRes.answer,
      evidence: evidenceTexts,
      confidence,
      reviewer_state: 'Draft'
    });
  }

  // Mandatory requirements marked Gap are placed at the top (PRD Acceptance Criteria)
  processedRequirements.sort((a, b) => {
    if (a.type === 'Mandatory' && a.status === 'Gap' && !(b.type === 'Mandatory' && b.status === 'Gap')) return -1;
    if (!(a.type === 'Mandatory' && a.status === 'Gap') && b.type === 'Mandatory' && b.status === 'Gap') return 1;
    return 0;
  });

  await dbService.saveRequirements(tenderId, processedRequirements);
  await dbService.setJobStatus({ tender_id: tenderId, stage: 'complete', progress: 100, message: 'Requirement extraction and compliance matrix ready!' });
  await dbService.updateTender(tenderId, { status: 'Ready' });
  onProgress?.('complete', 100);

  return processedRequirements;
}
