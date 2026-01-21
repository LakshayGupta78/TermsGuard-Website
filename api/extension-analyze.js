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

    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

    const prompt = `You are an expert legal document analyzer specializing in privacy policies and terms of service. Analyze the following webpage content and identify ALL risky clauses, concerning terms, or potential issues for users.

IMPORTANT: You MUST identify risks if any of these exist in the document:
- HIGH RISK: Data selling/sharing with third parties, unlimited data collection, account termination clauses, liability waivers, forced arbitration, class action waivers, perpetual licenses to user content
- MEDIUM RISK: Cookie tracking, analytics collection, data retention policies, automated decision making, location tracking, cross-device tracking, marketing communications
- LOW RISK: Standard terms acceptance, minor privacy notices, typical cookie usage, basic data collection for service functionality

You MUST respond with valid JSON only. Keep the summary under 250 characters. Use this structure:
{
  "summary": "Brief 1-2 sentence overview (max 250 chars)",
  "risks": [
    {"severity": "high", "description": "Explanation in plain English"},
    {"severity": "medium", "description": "Explanation in plain English"},
    {"severity": "low", "description": "Explanation in plain English"}
  ]
}

Severity must be exactly "high", "medium", or "low" (lowercase).
Be thorough - most privacy policies and ToS documents have multiple risks. Only return empty risks array if the document is truly risk-free.

Page content:
${pageContent.substring(0, 25000)}`;

    const geminiResponse = await fetch(apiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 2048,
          responseMimeType: "application/json"
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
      try {
        // Try to parse as JSON directly first (preferred when responseMimeType is set)
        const parsed = JSON.parse(text);
        
        // Validate and normalize the response structure
        const normalized = {
          summary: parsed.summary || "Analysis complete.",
          risks: Array.isArray(parsed.risks) ? parsed.risks.map(risk => ({
            severity: (risk.severity || 'low').toLowerCase(),
            description: risk.description || risk.risk || String(risk)
          })) : []
        };
        
        return res.status(200).json(normalized);
      } catch (parseError) {
        // If direct parse fails, try to extract JSON from text
        const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/) || 
                          text.match(/(\{[\s\S]*\})/);
        
        if (jsonMatch) {
          try {
            const extracted = JSON.parse(jsonMatch[1].trim());
            const normalized = {
              summary: extracted.summary || "Analysis complete.",
              risks: Array.isArray(extracted.risks) ? extracted.risks.map(risk => ({
                severity: (risk.severity || 'low').toLowerCase(),
                description: risk.description || risk.risk || String(risk)
              })) : []
            };
            return res.status(200).json(normalized);
          } catch {
            // Fall through to summary fallback
          }
        }
        
        // Final fallback - return as summary with no risks
        return res.status(200).json({ 
          summary: text.substring(0, 500), 
          risks: [] 
        });
      }
    }

    return res.status(500).json({ error: "Invalid AI response" });

  } catch (error) {
    console.error("Error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}

