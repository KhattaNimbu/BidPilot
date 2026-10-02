import { PastBidChunk } from '../types';
import { dbService } from '../db';

// Simple TF-IDF / Cosine similarity matching algorithm for local vector search
function tokenize(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .split(/\s+/)
      .filter(w => w.length > 2)
  );
}

function calculateJaccardCosineSimilarity(query: string, document: string): number {
  const queryTokens = tokenize(query);
  const docTokens = tokenize(document);

  if (queryTokens.size === 0 || docTokens.size === 0) return 0;

  let intersection = 0;
  for (const token of Array.from(queryTokens)) {
    if (docTokens.has(token)) {
      intersection++;
    }
  }

  const denominator = Math.sqrt(queryTokens.size * docTokens.size);
  return denominator === 0 ? 0 : intersection / denominator;
}

export interface RelevantEvidence {
  text: string;
  source: string;
  similarity: number;
}

export async function findRelevantEvidence(requirementText: string, topK: number = 3): Promise<RelevantEvidence[]> {
  const pastBids = await dbService.getPastBids();
  const profile = await dbService.getCompanyProfile();

  const candidateEvidence: { text: string; source: string }[] = [];

  // Add company profile facts
  profile.capabilities.forEach(cap => candidateEvidence.push({ text: `Capability: ${cap}`, source: 'Company Profile' }));
  profile.certifications.forEach(cert => candidateEvidence.push({ text: `Certification: ${cert}`, source: 'Company Certifications' }));
  profile.past_wins.forEach(win => candidateEvidence.push({ text: `Past Win: ${win}`, source: 'Company Track Record' }));

  // Add past bid Q&As
  pastBids.forEach(bid => {
    bid.chunks.forEach(chunk => {
      candidateEvidence.push({ text: chunk.text, source: `${bid.title} (${chunk.source_file})` });
    });
  });

  const scored = candidateEvidence.map(item => ({
    text: item.text,
    source: item.source,
    similarity: calculateJaccardCosineSimilarity(requirementText, item.text)
  }));

  // Sort by similarity descending
  scored.sort((a, b) => b.similarity - a.similarity);

  // Return top K with a minimum similarity threshold
  return scored.slice(0, topK);
}
