import { NextResponse } from 'next/server';
import { dbService } from '@/lib/db';
import { SAMPLE_TENDER_1, SAMPLE_TENDER_2 } from '@/lib/data/sample-tenders';
import { parsePdfBuffer } from '@/lib/services/pdf';

export async function GET() {
  try {
    let tenders = await dbService.listTenders();
    // Seed initial sample tenders if database is empty
    if (tenders.length === 0) {
      await dbService.createTender({
        _id: SAMPLE_TENDER_1.id,
        title: SAMPLE_TENDER_1.title,
        buyer: SAMPLE_TENDER_1.buyer,
        file_name: SAMPLE_TENDER_1.file_name,
        file_content: SAMPLE_TENDER_1.content,
        status: 'Uploaded',
        total_pages: SAMPLE_TENDER_1.total_pages,
        evaluation_criteria: SAMPLE_TENDER_1.evaluation_criteria,
        created_at: new Date().toISOString()
      });
      await dbService.createTender({
        _id: SAMPLE_TENDER_2.id,
        title: SAMPLE_TENDER_2.title,
        buyer: SAMPLE_TENDER_2.buyer,
        file_name: SAMPLE_TENDER_2.file_name,
        file_content: SAMPLE_TENDER_2.content,
        status: 'Uploaded',
        total_pages: SAMPLE_TENDER_2.total_pages,
        evaluation_criteria: SAMPLE_TENDER_2.evaluation_criteria,
        created_at: new Date().toISOString()
      });
      tenders = await dbService.listTenders();
    }
    return NextResponse.json(tenders);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const contentType = req.headers.get('content-type') || '';
    let title = '';
    let buyer = '';
    let fileContent = '';
    let fileName = 'tender.pdf';
    let totalPages = 10;

    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData();
      const file = formData.get('file') as File | null;
      title = (formData.get('title') as string) || (file ? file.name.replace(/\.[^/.]+$/, "") : 'Uploaded Tender');
      buyer = (formData.get('buyer') as string) || 'Department of Transportation';

      if (file) {
        // Enforce 50MB maximum upload limit
        const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024;
        if (file.size > MAX_FILE_SIZE_BYTES) {
          return NextResponse.json({ 
            error: `File size exceeds 50MB limit (${(file.size / (1024 * 1024)).toFixed(1)}MB). Please upload a smaller PDF or text extract.` 
          }, { status: 413 });
        }

        // Validate allowed file extensions
        const allowedExtensions = ['.pdf', '.txt', '.doc', '.docx'];
        const hasValidExt = allowedExtensions.some(ext => file.name.toLowerCase().endsWith(ext));
        if (!hasValidExt) {
          return NextResponse.json({ 
            error: `Invalid file format for '${file.name}'. Only PDF and TXT tender documents are supported.` 
          }, { status: 400 });
        }

        fileName = file.name;
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const parsed = await parsePdfBuffer(buffer);
        fileContent = parsed.text;
        totalPages = parsed.totalPages;
      }
    } else {
      const body = await req.json();
      title = body.title || 'New Tender';
      buyer = body.buyer || 'Government Agency';
      fileContent = body.content || body.file_content || '';
      fileName = body.file_name || 'tender_text.txt';
      totalPages = body.total_pages || 10;
    }

    const newId = `tender_${Date.now()}`;
    const tender = await dbService.createTender({
      _id: newId,
      title,
      buyer,
      file_name: fileName,
      file_content: fileContent,
      status: 'Uploaded',
      total_pages: totalPages,
      created_at: new Date().toISOString()
    });

    return NextResponse.json(tender, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
