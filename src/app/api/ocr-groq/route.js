import { NextResponse } from 'next/server';

export async function POST(req) {
  try {
    const { imageBase64 } = await req.json();

    if (!imageBase64) {
      return NextResponse.json({ success: false, error: "Image is required" }, { status: 400 });
    }

    const groqApiKey = process.env.GROQ_API_KEY;
    if (!groqApiKey) {
      return NextResponse.json({ success: false, error: "Groq API key not configured" }, { status: 500 });
    }

    const payload = {
      model: "meta-llama/llama-4-scout-17b-16e-instruct",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "You are an expert OCR assistant for an agri-export weighbridge. The user has uploaded a weighbridge slip. Find the final Gross Weight (or Net Weight, whatever is the final weight of the material inside the vehicle) from this slip in kilograms. You must reply in JSON format. Return ONLY a valid JSON object with a single key 'netWeight' containing the numerical value. Example: {\"netWeight\": 1540.5}. Do not include markdown formatting or any other text."
            },
            {
              type: "image_url",
              image_url: {
                url: imageBase64
              }
            }
          ]
        }
      ],
      temperature: 0,
      response_format: { type: "json_object" }
    };

    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${groqApiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();

    if (data.error) {
      console.error("Groq API Error:", data.error);
      return NextResponse.json({ success: false, error: data.error.message }, { status: 500 });
    }

    const content = data.choices[0]?.message?.content;
    if (!content) {
      return NextResponse.json({ success: false, error: "No response from OCR" }, { status: 500 });
    }

    const parsed = JSON.parse(content);

    return NextResponse.json({ success: true, netWeight: parsed.netWeight });

  } catch (error) {
    console.error("OCR Route Error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
