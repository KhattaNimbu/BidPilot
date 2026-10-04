import { tavily } from '@tavily/core';
import { ResearchSource } from '../types';
import { isMockModeActive } from '../llm/router';

export async function searchBuyerResearch(buyerName: string, tenderTitle: string): Promise<ResearchSource[]> {
  const isMock = isMockModeActive();
  const apiKey = process.env.TAVILY_API_KEY;

  if (!isMock) {
    if (!apiKey || apiKey === 'mock_tavily_key') {
      console.warn(`[Tavily] Real mode active but TAVILY_API_KEY is not set. Returning 0 sources (never inventing fake URLs).`);
      return [];
    }

    try {
      const tv = tavily({ apiKey });
      const query = `"${buyerName}" tender award history procurement strategy ${tenderTitle}`;
      const response = await tv.search(query, {
        searchDepth: "advanced",
        maxResults: 5
      });

      return (response.results || []).map((res: any) => ({
        title: res.title || buyerName,
        url: res.url,
        snippet: res.content || ""
      }));
    } catch (err: any) {
      console.error(`[Tavily API Error] Search failed for buyer '${buyerName}':`, err.message);
      // In real mode, do NOT invent fake URLs. Return empty array or throw.
      return [];
    }
  }

  // Explicit Mock Mode fallback with public reference domains
  return [
    {
      title: `${buyerName} - Public Procurement Guidelines & Award Criteria`,
      url: `https://www.acquisition.gov/procurement/${encodeURIComponent(buyerName.toLowerCase().replace(/[^a-z0-9]/g, '-'))}`,
      snippet: `${buyerName} procurement guidelines emphasize vendor ISO 27001 / SOC 2 compliance, past federal performance, and sub-1 hour disaster recovery SLAs.`
    },
    {
      title: `State Comptroller Audit & Procurement Assessment: ${buyerName}`,
      url: `https://www.usaspending.gov/recipient/${encodeURIComponent(buyerName.toLowerCase().replace(/[^a-z0-9]/g, '-'))}`,
      snippet: `Mandatory disqualification enforced on past proposals lacking certified cloud data residency or required insurance bonding.`
    }
  ];
}
