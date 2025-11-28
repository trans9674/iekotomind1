import { GoogleGenAI, Type } from "@google/genai";

// Initialize Gemini Client
// In a real app, this should be handled securely.
// Based on instructions, we assume process.env.API_KEY is available.
const apiKey = process.env.API_KEY || '';
const ai = new GoogleGenAI({ apiKey });

export const generateTasksForCustomer = async (customerName: string, status: string) => {
  if (!apiKey) {
    console.warn("No API Key provided for Gemini.");
    return [];
  }

  try {
    const model = 'gemini-2.5-flash';
    const prompt = `Generate a realistic checklist of 5 key tasks for a home construction customer named "${customerName}" who is currently in the "${status}" phase.
    Include a mix of '営業' (Sales), '設計' (Design), '申請' (Application), and '工務' (Construction) categories.
    Mark one task as a major milestone (e.g., Contract, Handover, Groundbreaking).
    The titles must be in Japanese.
    Return JSON.`;

    const response = await ai.models.generateContent({
      model,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              category: { type: Type.STRING, enum: ['営業', '設計', '申請', '工務'] },
              title: { type: Type.STRING },
              isMilestone: { type: Type.BOOLEAN }
            },
            required: ['category', 'title', 'isMilestone']
          }
        }
      }
    });

    const text = response.text;
    if (!text) return [];
    return JSON.parse(text);

  } catch (error) {
    console.error("Gemini API Error:", error);
    return [];
  }
};