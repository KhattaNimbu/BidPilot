import pdfParse from 'pdf-parse';

export interface ParsedDocument {
  text: string;
  totalPages: number;
  sections: { title: string; page: number; content: string }[];
}

export async function parsePdfBuffer(buffer: Buffer): Promise<ParsedDocument> {
  try {
    const data = await pdfParse(buffer);
    const fullText = data.text || "";
    const totalPages = data.numpages || 1;

    const sections = splitTextIntoSections(fullText, totalPages);
    return {
      text: fullText,
      totalPages,
      sections
    };
  } catch (err: any) {
    console.warn("PDF Buffer parsing fallback:", err.message);
    const text = buffer.toString('utf-8');
    return {
      text,
      totalPages: 1,
      sections: splitTextIntoSections(text, 1)
    };
  }
}

export function splitTextIntoSections(text: string, totalPages: number): { title: string; page: number; content: string }[] {
  const lines = text.split('\n');
  const sections: { title: string; page: number; content: string }[] = [];
  
  let currentTitle = "Section 1: General Requirements";
  let currentLines: string[] = [];
  let currentPage = 1;
  const linesPerPage = Math.max(1, Math.ceil(lines.length / Math.max(1, totalPages)));

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    const pageNum = Math.min(totalPages, Math.floor(i / linesPerPage) + 1);

    // Heuristic section header detection (Section X, REQ, 1.0, 2.0, EVALUATION)
    if (/^(SECTION|PART|\d+\.0|\d+\.\d+|REQUIREMENTS|EVALUATION|SCOPE)/i.test(line) && line.length < 80) {
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

  if (currentLines.length > 0) {
    sections.push({
      title: currentTitle,
      page: currentPage,
      content: currentLines.join('\n')
    });
  }

  return sections.length > 0 ? sections : [{ title: "Section 1: Complete Tender", page: 1, content: text }];
}
