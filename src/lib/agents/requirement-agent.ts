import pLimit from 'p-limit';
import { Requirement, RequirementStatus, RequirementType } from '../types';
import { dbService } from '../db';
import { splitTextIntoSections, chunkTextWithOverlap } from '../services/pdf';
import { runRoutedLLM } from '../llm/router';
import { ComplianceJudgeSchema, RequirementExtractorSchema } from '../schemas/agents';
import { findRelevantEvidence } from '../services/embeddings';
import { generateDraftAnswer } from './drafting-agent';

export async function processTenderRequirements(tenderId: string, onProgress?: (step: string, percent: number) => void): Promise<Requirement[]> {
  const tender = await dbService.getTender(tenderId);
  if (!tender) {
    throw new Error(`Tender not found: ${tenderId}`);
  }

  await dbService.setJobStatus({ tender_id: tenderId, stage: 'splitting', progress: 10, message: 'Splitting tender and classifying document structure with Nemotron Nano...' });
  onProgress?.('splitting', 10);

  const sections = splitTextIntoSections(tender.file_content || "", tender.total_pages || 10);

  // Invoke Nemotron Nano for section classification and document structure mapping (PRD F2 routing table)
  try {
    await runRoutedLLM({
      tenderId,
      agentName: 'Document Structure Classifier (F2)',
      modelType: 'Nano',
      prompt: `TENDER SECTIONS (${sections.length}):\n${sections.map((s, idx) => `${idx + 1}. [Page ${s.page}] ${s.title}`).join('\n')}\n\nMap document hierarchy and mark compliance sections.`,
      mockFallbackGenerator: () => ({ status: 'mapped', sections_count: sections.length })
    });
  } catch (err: any) {
    console.warn("[Requirement Agent] Nano section classification logged:", err.message);
  }

  await dbService.setJobStatus({ tender_id: tenderId, stage: 'extracting', progress: 30, message: `Extracting requirements across all sections without truncation...` });
  onProgress?.('extracting', 30);

  const extractLimit = pLimit(3); // Capped concurrency for extraction calls
  let reqCounter = 1;

  // Process all section chunks with sliding-window overlap to eliminate 3,000 char truncation
  const sectionTasks: Promise<any[]>[] = [];

  sections.forEach((sec, secIdx) => {
    const chunks = chunkTextWithOverlap(sec.content, 3500, 300);

    chunks.forEach((chunk, chunkIdx) => {
      sectionTasks.push(
        extractLimit(async () => {
          const prompt = `
SECTION TITLE: ${sec.title} ${chunks.length > 1 ? `(Part ${chunkIdx + 1} of ${chunks.length})` : ''}
PAGE NUMBER: ${sec.page}

DOCUMENT TEXT:
${chunk.text}

TASK:
Extract all explicit tender requirements from this section part.
Classify each as "Mandatory" (shall, must, required, mandatory, will be disqualified) or "Optional" (should, preferred, optional, desired).

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
            agentName: `Requirement Extractor (Section ${secIdx + 1} - Part ${chunkIdx + 1})`,
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

          return result.requirements || [];
        })
      );
    });
  });

  const resultsPerChunk = await Promise.all(sectionTasks);
  const rawExtracted = resultsPerChunk.flat();

  // Deduplicate overlapping requirements by normalized text
  const seenTexts = new Set<string>();
  const rawRequirements: typeof rawExtracted = [];

  for (const r of rawExtracted) {
    const normalized = r.text.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 80);
    if (!seenTexts.has(normalized)) {
      seenTexts.add(normalized);
      rawRequirements.push(r);
    }
  }

  await dbService.setJobStatus({ tender_id: tenderId, stage: 'drafting', progress: 60, message: `Parallel evidence matching & drafting across ${rawRequirements.length} requirements...` });
  onProgress?.('drafting', 60);

  // Parallelize drafting & two-tier compliance judging (4 concurrent workers to hit <20 min SLA)
  const draftLimit = pLimit(4);

  const processedTasks = rawRequirements.map((raw, i) =>
    draftLimit(async (): Promise<Requirement> => {
      const uniqueId = `req_${tenderId}_${i + 1}`;
      const reqIdTag = `REQ-${String(i + 1).padStart(3, '0')}`;

      // 1. Semantic Evidence Retrieval
      const evidenceList = await findRelevantEvidence(raw.text, 3);
      const evidenceTexts = evidenceList.map(e => `${e.source}: ${e.text}`);

      // 2. Draft Answer Generation via Super
      const draftRes = await generateDraftAnswer(tenderId, raw.text, evidenceList);

      // 3. Two-Tier Compliance Judgment (Super first; Ultra only for borderline mandatory items)
      let status: RequirementStatus = 'Gap';
      let confidence = draftRes.confidence;

      if (!draftRes.answer || draftRes.answer.trim().length === 0 || evidenceList.length === 0 || evidenceList[0].similarity < 0.15) {
        status = 'Gap';
        confidence = 0.9;
      } else {
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

        // Tier 1: Evaluate with Nemotron Super
        const superJudge = await runRoutedLLM({
          tenderId,
          agentName: `Compliance Judge Agent (Super) - Req ${i + 1}`,
          modelType: 'Super',
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

        status = superJudge.status as RequirementStatus;
        confidence = superJudge.confidence;

        // Tier 2: Escalate to Nemotron Ultra ONLY if Mandatory AND confidence is borderline (0.4 - 0.7)
        if (raw.type === 'Mandatory' && confidence >= 0.4 && confidence <= 0.7) {
          try {
            const ultraJudge = await runRoutedLLM({
              tenderId,
              agentName: `Borderline Escalation Judge (Ultra) - Req ${i + 1}`,
              modelType: 'Ultra', // Reserved for high-stakes borderline calls
              prompt: `AUDIT FOR BORDERLINE MANDATORY REQUIREMENT:\n${judgePrompt}`,
              schema: ComplianceJudgeSchema,
              mockFallbackGenerator: () => ({
                status: superJudge.status,
                reason: `Ultra audit: ${superJudge.reason}`,
                confidence: 0.85
              })
            });
            status = ultraJudge.status as RequirementStatus;
            confidence = ultraJudge.confidence;
          } catch (ultraErr) {
            console.warn(`[Requirement Agent] Ultra fallback to Super result for ${reqIdTag}`);
          }
        }
      }

      return {
        _id: uniqueId,
        tender_id: tenderId,
        req_id: reqIdTag,
        text: raw.text,
        type: raw.type as RequirementType,
        section: raw.section,
        page: raw.page,
        status,
        draft_answer: status === 'Gap' ? '' : draftRes.answer,
        evidence: evidenceTexts,
        confidence,
        reviewer_state: 'Draft'
      };
    })
  );

  const processedRequirements = await Promise.all(processedTasks);

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
