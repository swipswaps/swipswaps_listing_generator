import { GoogleGenAI, GenerateContentResponse, Modality } from "@google/genai";
import { GroundingSource } from '../types'; // Import GroundingSource type

// Helper function to convert Blob or File to Base64 string
export async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      // Remove the data URL prefix (e.g., "data:image/jpeg;base64,")
      resolve(base64String.split(',')[1]);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

// Initialize GoogleGenAI with the API key from environment variables.
// The API key must be obtained exclusively from process.env.API_KEY.
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });

export const geminiService = {
  discernItemFromImage: async (base64Image: string, mimeType: string): Promise<string> => {
    if (!ai.apiKey) {
      throw new Error("Gemini API Key is not configured. Please set process.env.API_KEY.");
    }

    try {
      const imagePart = {
        inlineData: {
          mimeType: mimeType,
          data: base64Image,
        },
      };
      const textPart = {
        text: `Analyze this image to identify the item. Focus on any labels, logos, model numbers, serial numbers, or product codes.
              Provide a concise description of the item and its most appropriate eBay category.
              Format your response as:
              Item: [Concise item description including any alphanumeric identifiers from labels]
              Category: [Most appropriate eBay category for the item, e.g., "Electronics > Video Games & Consoles > Video Game Consoles"]`
      };

      const response: GenerateContentResponse = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image', // Use the image generation model
        contents: { parts: [imagePart, textPart] },
      });

      const text = response.text;
      if (!text) {
        throw new Error("Gemini did not return any text response for image analysis.");
      }
      return text.trim();
    } catch (error) {
      console.error('Error discerning item from image with Gemini:', error);
      throw new Error(`Gemini image identification failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  },

  fetchEbayGroundingData: async (
    query: string,
  ): Promise<{
    priceRange: string;
    conditionSummary: string;
    keywords: string[];
    groundingSources: GroundingSource[];
  }> => {
    if (!ai.apiKey) {
      throw new Error("Gemini API Key is not configured. Please set process.env.API_KEY.");
    }

    try {
      const prompt = `Perform a Google Search for recent eBay "Sold Listings" related to "${query}".
                      From the search results, identify the following:
                      - **Typical Price Range:** What is the common price range for this item in sold listings? (e.g., "$50 - $100 USD")
                      - **Common Condition Summary:** What are the most frequently mentioned conditions (e.g., "Used - Good Condition", "New - Open Box", "Refurbished")?
                      - **Key Descriptive Keywords:** What are the most important descriptive keywords, popular search terms, unique selling points, and common title patterns/phrases buyers use when searching for and purchasing similar items on eBay? Provide these as a comma-separated list.

                      Format your response strictly as follows, extracting all relevant information. If a piece of information is not found, state "N/A":
                      Price Range: [Typical Price Range]
                      Condition Summary: [Common Condition Summary]
                      Keywords: [Comma-separated list of keywords and title patterns]
                      `;

      const response: GenerateContentResponse = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
        config: {
          tools: [{ googleSearch: {} }],
        },
      });

      const text = response.text.trim();
      const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
      const sources: GroundingSource[] = groundingChunks
        .filter(chunk => chunk.web?.uri)
        .map(chunk => ({
          type: 'googleSearch',
          uri: chunk.web!.uri,
          title: chunk.web!.title,
        }));

      // Parse the structured text response
      const priceRangeMatch = text.match(/Price Range:\s*(.*)/i);
      const conditionSummaryMatch = text.match(/Condition Summary:\s*(.*)/i);
      const keywordsMatch = text.match(/Keywords:\s*(.*)/i);

      const priceRange = priceRangeMatch ? priceRangeMatch[1].trim() : 'N/A';
      const conditionSummary = conditionSummaryMatch ? conditionSummaryMatch[1].trim() : 'N/A';
      const keywords = keywordsMatch ? keywordsMatch[1].split(',').map(kw => kw.trim()).filter(Boolean) : [];

      return {
        priceRange,
        conditionSummary,
        keywords,
        groundingSources: sources,
      };

    } catch (error) {
      console.error('Error fetching eBay grounding data with Gemini:', error);
      throw new Error(`Gemini market research failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  },
};
