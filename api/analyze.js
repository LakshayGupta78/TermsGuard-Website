// This is a Vercel Serverless Function that acts as a secure proxy to the Gemini API.
import fetch from "node-fetch";
import multer from "multer";

// Configure multer to handle file uploads in memory
const upload = multer({ storage: multer.memoryStorage() });

// A helper function to adapt Express-style middleware like multer for Vercel Functions
const runMiddleware = (req, res, fn) => {
  return new Promise((resolve, reject) => {
    fn(req, res, (result) => {
      if (result instanceof Error) {
        return reject(result);
      }
      return resolve(result);
    });
  });
};

export default async function handler(req, res) {
  // Set CORS headers for all responses. This allows your frontend to call this API.
  res.setHeader("Access-Control-Allow-Origin", "*"); // In production, you might restrict this to your actual domain.
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  // Handle the browser's preflight OPTIONS request
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  // We only want to handle POST requests for analysis
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  try {
    // Run the multer middleware to process the uploaded file from the FormData
    await runMiddleware(req, res, upload.single("document"));

    if (!req.file) {
      return res
        .status(400)
        .json({ error: "No file was provided in the request." });
    }

    // The file is now available in req.file. Convert its buffer to a base64 string.
    const imageBase64 = req.file.buffer.toString("base64");
    const mimeType = req.file.mimetype || "image/jpeg";

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.error("GEMINI_API_KEY is not set in environment variables.");
      return res
        .status(500)
        .json({ error: "Server configuration error: API key not found." });
    }

    // Using Google's Gemini 2.5 Flash model for fast, intelligent document analysis.
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

    const systemPrompt = `You are an AI legal assistant named TermsGuard. Analyze legal document images. 
        1. Provide a concise, easy-to-understand summary of the document's purpose.
        2. List key details like clauses, responsibilities, and deadlines.
        3. Highlight potential risks (fees, ambiguous language). For each risk, you MUST classify its severity as 'Low', 'Medium', or 'High'.
        
        You MUST respond ONLY with a valid JSON object with this exact structure:
        {
          "summary": "string",
          "keyDetails": ["string"],
          "risks": [{"risk": "string", "severity": "'Low'|'Medium'|'High'"}]
        }`;

    const payload = {
      systemInstruction: { parts: [{ text: systemPrompt }] },
      contents: [
        {
          parts: [
            {
              text: "Analyze the document image and provide the analysis in the required JSON format.",
            },
            { inlineData: { mimeType, data: imageBase64 } },
          ],
        },
      ],
      generationConfig: { responseMimeType: "application/json" },
    };

    const geminiResponse = await fetch(apiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const result = await geminiResponse.json();

    if (!geminiResponse.ok) {
      console.error("Gemini API Error:", result);
      const errorMessage =
        result?.error?.message || "An error occurred with the AI service.";
      return res.status(geminiResponse.status).json({ error: errorMessage });
    }

    const jsonText = result.candidates?.[0]?.content?.parts?.[0]?.text;

    if (jsonText) {
      res.setHeader("Content-Type", "application/json");
      return res.status(200).send(jsonText);
    } else {
      console.error("Invalid response structure from Gemini API:", result);
      return res
        .status(500)
        .json({ error: "Invalid response from the AI service." });
    }
  } catch (error) {
    console.error("Error in Vercel function:", error);
    return res
      .status(500)
      .json({
        error: "An internal server error occurred processing your request.",
      });
  }
}
