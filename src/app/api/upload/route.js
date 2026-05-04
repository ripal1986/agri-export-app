import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

export async function POST(req) {
  try {
    const { imageBase64, filename } = await req.json();
    if (!imageBase64) {
      return NextResponse.json({ success: false, error: 'No image provided' }, { status: 400 });
    }

    // Strip out the data:image/...;base64, part
    const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, "");
    const buffer = Buffer.from(base64Data, 'base64');
    
    const uploadsDir = path.join(process.cwd(), 'public', 'uploads');
    
    // Ensure dir exists
    try {
      await fs.access(uploadsDir);
    } catch {
      await fs.mkdir(uploadsDir, { recursive: true });
    }

    // Safe filename
    const safeFilename = filename.replace(/[^a-zA-Z0-9.-]/g, '_');
    const uniqueName = `${Date.now()}-${safeFilename}`;
    const filePath = path.join(uploadsDir, uniqueName);
    
    await fs.writeFile(filePath, buffer);
    
    // Return the relative URL so it can be accessed via localhost:3000/uploads/name.jpg
    return NextResponse.json({ success: true, url: `/uploads/${uniqueName}` });
  } catch (error) {
    console.error('Upload Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
