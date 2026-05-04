import vision from '@google-cloud/vision';
import { NextResponse } from 'next/server';
import path from 'path';

export async function POST(req) {
  try {
    const body = await req.json();
    const { imageBase64 } = body;

    if (!imageBase64) {
      return NextResponse.json({ success: false, error: 'No image provided' }, { status: 400 });
    }

    // Strip out the data:image/...;base64, part
    const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, "");

    const credentialsPath = path.join(process.cwd(), 'google-credentials.json');
    const client = new vision.ImageAnnotatorClient({
      keyFilename: credentialsPath,
      fallback: true // Use REST instead of gRPC to avoid next.js bundling issues
    });

    const request = {
      image: {
        content: base64Data,
      },
      features: [{ type: 'TEXT_DETECTION' }],
    };

    const [result] = await client.annotateImage(request);
    const detections = result.textAnnotations;
    
    if (!detections || detections.length === 0) {
      return NextResponse.json({ success: false, error: 'No text found in image' }, { status: 400 });
    }

    const fullText = detections[0].description;
    
    // Very basic extraction logic based on common weighbridge slip formats
    // In a production app, this regex would need to be tuned to the specific slip format
    let grossWeight = "";
    let tareWeight = "";
    let vehicleNo = "";

    // Regex for Vehicle Number (e.g. GJ-03-XX-1234 or GJ03XX1234)
    const vehicleRegex = /([A-Z]{2}[-\s]?[0-9]{1,2}[-\s]?[A-Z]{1,2}[-\s]?[0-9]{4})/i;
    const vehicleMatch = fullText.match(vehicleRegex);
    if (vehicleMatch) {
      vehicleNo = vehicleMatch[0].toUpperCase();
    }

    // Regex for Weights (Looking for numbers near 'Gross' or 'Tare')
    // This is a naive implementation that just looks for the words followed by numbers
    const lines = fullText.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].toLowerCase();
      
      // Look for Gross Weight
      if (line.includes('gross') || line.includes('કુલ વજન')) {
        const numbers = line.match(/\d+(\.\d+)?/g);
        if (numbers && numbers.length > 0) {
          grossWeight = numbers[numbers.length - 1]; // Often the last number is the weight
        } else if (i + 1 < lines.length) {
          // Check the next line if not found on current
          const nextLineNumbers = lines[i+1].match(/\d+(\.\d+)?/g);
          if (nextLineNumbers) grossWeight = nextLineNumbers[0];
        }
      }

      // Look for Tare Weight
      if (line.includes('tare') || line.includes('ખાલી વજન')) {
        const numbers = line.match(/\d+(\.\d+)?/g);
        if (numbers && numbers.length > 0) {
          tareWeight = numbers[numbers.length - 1];
        } else if (i + 1 < lines.length) {
          const nextLineNumbers = lines[i+1].match(/\d+(\.\d+)?/g);
          if (nextLineNumbers) tareWeight = nextLineNumbers[0];
        }
      }
    }

    return NextResponse.json({ 
      success: true, 
      data: {
        fullText,
        extracted: {
          vehicleNo,
          grossWeight,
          tareWeight
        }
      } 
    });

  } catch (error) {
    console.error('OCR Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
