// Vercel Serverless Function - Extension API Proxy
// This endpoint receives page text and returns Gemini analysis

export default async function handler(req, res) {
  // CORS headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  try {
    const { pageContent } = req.body;

    if (!pageContent || pageContent.length < 50) {
      return res.status(400).json({ error: "Page content is too short or missing" });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.error("GEMINI_API_KEY is not set");
      return res.status(500).json({ error: "Server configuration error" });
    }

    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

    const prompt = `You are a legal document analyzer. Analyze the following webpage content and identify any risky clauses, terms of service issues, or concerning legal language.

Respond in JSON format with this structure:
{
  "summary": "A brief 2-3 sentence overview of what this page contains and its overall risk level",
  "risks": [
    {
      "severity": "high|medium|low",
      "description": "Clear explanation of the risky clause in plain English"
    }
  ]
}

If no significant risks are found, return an empty risks array.

Page content:
${pageContent.substring(0, 30000)}`;

    const geminiResponse = await fetch(apiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 2048,
        }
      })
    });

    const result = await geminiResponse.json();

    if (!geminiResponse.ok) {
      console.error("Gemini API Error:", result);
      return res.status(geminiResponse.status).json({ 
        error: result?.error?.message || "AI service error" 
      });
    }

    const text = result.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (text) {
      // Extract JSON from response
      const jsonMatch = text.match(/```json\n?([\s\S]*?)\n?```/) || text.match(/\{[\s\S]*\}/);
      const jsonStr = jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : text;
      
      try {
        const parsed = JSON.parse(jsonStr);
        return res.status(200).json(parsed);
      } catch {
        return res.status(200).json({ summary: text, risks: [] });
      }
    }

    return res.status(500).json({ error: "Invalid AI response" });

  } catch (error) {
    console.error("Error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}
