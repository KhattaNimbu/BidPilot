import { dbService } from '../db';

// Semantic synonym clusters for procurement and tender domain
const SEMANTIC_CLUSTERS: Record<string, string[]> = {
  availability: ['uptime', 'availability', 'high-availability', 'sla', '99.9', '99.95', '99.99', 'failover', 'uninterrupted', 'redundancy', 'disaster'],
  security: ['security', 'iso', '27001', 'soc', 'soc2', 'hipaa', 'fedramp', 'encryption', 'aes-256', 'tls', 'zero-trust', 'vulnerability', 'penetration', 'compliance'],
  incident: ['incident', 'p1', 'critical', 'response', 'severity', 'sla', '15-minute', 'hotline', 'escalation', 'support'],
  data: ['residency', 'conus', 'data', 'storage', 'privacy', 'phi', 'de-identification', 'gdpr', 'confidentiality'],
  recovery: ['rto', 'rpo', 'recovery', 'backup', 'dr', 'restore', 'failover', 'continuity'],
  integration: ['api', 'rest', 'restful', 'fhir', 'siem', 'splunk', 'datadog', 'ehr', 'interoperability', 'connector']
};

function extractNgrams(text: string): { tokens: Map<string, number>; total: number } {
  const words = text
    .toLowerCase()
    .replace(/[^a-z0-9\s\-]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2);

  const freq = new Map<string, number>();
  let total = 0;

  // Unigrams
  for (const w of words) {
    freq.set(w, (freq.get(w) || 0) + 1.0);
    total++;

    // Semantic cluster expansion
    for (const [clusterKey, synonyms] of Object.entries(SEMANTIC_CLUSTERS)) {
      if (synonyms.some(s => w.includes(s) || s.includes(w))) {
        const clusterTag = `__cluster_${clusterKey}__`;
        freq.set(clusterTag, (freq.get(clusterTag) || 0) + 0.6);
        total += 0.6;
      }
    }
  }

  // Bigrams for phrase matching (e.g., "iso 27001", "response time", "disaster recovery")
  for (let i = 0; i < words.length - 1; i++) {
    const bigram = `${words[i]}_${words[i + 1]}`;
    freq.set(bigram, (freq.get(bigram) || 0) + 1.8);
    total += 1.8;
  }

  return { tokens: freq, total };
}

function calculateCosineSimilarity(query: string, document: string): number {
  const q = extractNgrams(query);
  const d = extractNgrams(document);

  if (q.tokens.size === 0 || d.tokens.size === 0) return 0;

  let dotProduct = 0;
  let normQ = 0;
  let normD = 0;

  for (const [token, count] of Array.from(q.tokens.entries())) {
    normQ += count * count;
    if (d.tokens.has(token)) {
      dotProduct += count * (d.tokens.get(token) || 0);
    }
  }

  for (const [, count] of Array.from(d.tokens.entries())) {
    normD += count * count;
  }

  if (normQ === 0 || normD === 0) return 0;
  return dotProduct / (Math.sqrt(normQ) * Math.sqrt(normD));
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
  if (profile.capacity_notes) {
    candidateEvidence.push({ text: `Operational Capacity: ${profile.capacity_notes}`, source: 'Company Capacity' });
  }

  // Add past bid Q&As
  pastBids.forEach(bid => {
    bid.chunks.forEach(chunk => {
      candidateEvidence.push({ text: chunk.text, source: `${bid.title} (${chunk.source_file})` });
    });
  });

  const scored = candidateEvidence.map(item => ({
    text: item.text,
    source: item.source,
    similarity: calculateCosineSimilarity(requirementText, item.text)
  }));

  // Sort by similarity descending
  scored.sort((a, b) => b.similarity - a.similarity);

  // Return top K with reasonable relevance
  return scored.slice(0, topK);
}
