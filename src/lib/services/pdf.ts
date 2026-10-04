import pdfParse from 'pdf-parse';

export interface Section {
  title: string;
  page: number;
  content: string;
}

export interface ParsedDocument {
  text: string;
  totalPages: number;
  sections: Section[];
}

export interface TextChunk {
  chunkIndex: number;
  totalChunks: number;
  text: string;
}

/**
 * Splits text into overlapping sliding-window chunks so no requirements are truncated.
 */
export function chunkTextWithOverlap(text: string, maxChunkChars = 3500, overlap = 400): TextChunk[] {
  if (text.length <= maxChunkChars) {
    return [{ chunkIndex: 0, totalChunks: 1, text }];
  }

  const chunks: TextChunk[] = [];
  let startIndex = 0;

  while (startIndex < text.length) {
    let endIndex = Math.min(startIndex + maxChunkChars, text.length);
    if (endIndex < text.length) {
      const lastNewline = text.lastIndexOf('\n', endIndex);
      if (lastNewline > startIndex + maxChunkChars * 0.7) {
        endIndex = lastNewline;
      }
    }
    const chunkText = text.substring(startIndex, endIndex).trim();
    if (chunkText.length > 0) {
      chunks.push({
        chunkIndex: chunks.length,
        totalChunks: 0,
        text: chunkText
      });
    }
    if (endIndex >= text.length) break;
    startIndex = Math.max(startIndex + 1, endIndex - overlap);
  }

  chunks.forEach(c => c.totalChunks = chunks.length);
  return chunks;
}

export async function parsePdfBuffer(buffer: Buffer): Promise<ParsedDocument> {
  try {
    const data = await pdfParse(buffer);
    const fullText = data.text || "";
    const totalPages = Math.max(1, data.numpages || 1);

    const sections = splitTextIntoSections(fullText, totalPages);
    return {
      text: fullText,
      totalPages,
      sections
    };
  } catch (err: any) {
    // If not a valid PDF, verify if it is plain readable text (.txt / Markdown)
    const isReadableAscii = buffer.slice(0, Math.min(200, buffer.length)).every(b => 
      (b >= 9 && b <= 13) || (b >= 32 && b <= 126)
    );

    if (isReadableAscii) {
      const text = buffer.toString('utf-8');
      const estimatedPages = Math.max(1, Math.ceil(text.split('\n').length / 45));
      return {
        text,
        totalPages: estimatedPages,
        sections: splitTextIntoSections(text, estimatedPages)
      };
    }

    // Fail-fast on corrupted binary PDF bytes - never feed binary garbage to the LLM
    throw new Error(`Corrupted or unreadable PDF document: ${err.message}. Please upload a valid PDF or text document.`);
  }
}

export function splitTextIntoSections(text: string, totalPages: number): Section[] {
  // Check for real PDF page feed delimiters (\f or \x0C)
  const hasPageFeeds = text.includes('\f');
  const pages = hasPageFeeds ? text.split('\f') : [text];

  const sections: Section[] = [];
  let currentTitle = "Section 1: General Requirements";
  let currentLines: string[] = [];
  let currentPage = 1;

  if (hasPageFeeds) {
    pages.forEach((pageContent, pageIdx) => {
      const pageNum = pageIdx + 1;
      const lines = pageContent.split('\n');

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (/^(SECTION|PART|\d+\.0|\d+\.\d+|REQUIREMENTS|EVALUATION|SCOPE|SCHEDULE)/i.test(line) && line.length < 90) {
          if (currentLines.length > 0) {
            sections.push({
              title: currentTitle,
              page: currentPage,
              content: currentLines.join('\n')
            });
            currentLines = [];
          }
          currentTitle = line;
          currentPage = pageNum;
        } else {
          currentLines.push(line);
        }
      }
    });
  } else {
    // Fallback line heuristic with safe page allocation
    const lines = text.split('\n');
    const linesPerPage = Math.max(1, Math.ceil(lines.length / Math.max(1, totalPages)));

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      const pageNum = Math.min(totalPages, Math.floor(i / linesPerPage) + 1);

      if (/^(SECTION|PART|\d+\.0|\d+\.\d+|REQUIREMENTS|EVALUATION|SCOPE|SCHEDULE)/i.test(line) && line.length < 90) {
        if (currentLines.length > 0) {
          sections.push({
            title: currentTitle,
            page: currentPage,
            content: currentLines.join('\n')
          });
          currentLines = [];
        }
        currentTitle = line;
        currentPage = pageNum;
      } else {
        currentLines.push(line);
      }
    }
  }

  if (currentLines.length > 0) {
    sections.push({
      title: currentTitle,
      page: currentPage,
      content: currentLines.join('\n')
    });
  }

  return sections.length > 0 ? sections : [{ title: "Section 1: Complete Tender", page: 1, content: text }];
}
