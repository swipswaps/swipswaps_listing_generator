// Fix: Implement the Gemini service using @google/genai guidelines.
import { GoogleGenAI, Modality, GroundingSource } from '@google/genai'; // Import GroundingSource

/**
 * Converts a Blob (e.g., a File object) to a Base64 encoded string.
 * This is a utility function used by ImageUploader and potentially other services.
 * @param blob The Blob object to convert.
 * @returns A Promise that resolves with the Base64 encoded string.
 */
export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      // The result will be in the format "data:image/jpeg;base64,..."
      // We need to extract only the base64 part.
      const base64String = (reader.result as string).split(',')[1];
      resolve(base64String);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export const geminiService = {
  /**
   * Identifies an item and its category from a base64 encoded image using the Gemini API.
   * @param base64Image The base64 encoded image data.
   * @param mimeType The MIME type of the image (e.g., 'image/png', 'image/jpeg').
   * @returns A string containing the identified item description and category.
   */
  discernItemFromImage: async (base64Image: string, mimeType: string): Promise<string> => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [
          {
            inlineData: {
              data: base64Image,
              mimeType: mimeType,
            },
          },
          // Refined prompt: Emphasize visual characteristics and alphanumeric identifiers from labels.
          { text: 'Analyze this image. Describe the item in detail, including any specific alphanumeric identifiers like model numbers, serial numbers, or product codes visible on labels or the item itself. Then, identify its primary category suitable for an online listing. Format your response exactly as: "Item: [Detailed Description including identifiers]\nCategory: [Primary Category]".' },
        ],
      },
    });

    return response.text;
  },

  /**
   * Fetches market grounding data (price range, condition summary, keywords, title patterns)
   * for an item from eBay "Sold Listings" using Gemini with Google Search grounding.
   * @param query The item description or search term.
   * @returns A Promise resolving to an object containing market data and grounding sources.
   */
  fetchEbayGroundingData: async (query: string): Promise<{
    priceRange: string;
    conditionSummary: string;
    keywords: string[];
    marketTitlePatterns: string[];
    groundingSources: GroundingSource[];
  }> => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const fullQuery = `eBay sold listings for "${query}" pricing, condition, popular keywords, and title examples`;

    try {
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash', // Use gemini-2.5-flash for text tasks with grounding
        contents: fullQuery,
        config: {
          tools: [{ googleSearch: {} }],
        },
      });

      const text = response.text;
      const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];

      // Parse text response for structured data
      let priceRange = 'N/A';
      let conditionSummary = 'N/A';
      let keywords: string[] = [];
      let marketTitlePatterns: string[] = [];

      // Refined prompt in Gemini should lead to more structured text that we can parse.
      // Example parsing logic (might need adjustment based on actual Gemini output):
      const priceMatch = text.match(/(price|average price|sold for|range)\s*[:-]?\s*(\$?\d[\d,\.]*\s*(-|\sto\s|\s+and\s+)?\s*\$?\d[\d,\.]*\s*(USD)?)/i);
      if (priceMatch && priceMatch[2]) {
        priceRange = priceMatch[2].trim();
      } else {
        const singlePriceMatch = text.match(/(average|median)\s*price\s*[:-]?\s*(\$?\d[\d,\.]*\s*(USD)?)/i);
        if (singlePriceMatch && singlePriceMatch[2]) {
          priceRange = singlePriceMatch[2].trim();
        }
      }

      const conditionMatch = text.match(/(common conditions|typical condition|condition summary)\s*[:-]?\s*(.*?)(?=(keywords|title patterns|$))/is);
      if (conditionMatch && conditionMatch[2]) {
        conditionSummary = conditionMatch[2].trim().replace(/\n/g, ' ').replace(/\s{2,}/g, ' ');
      }

      const keywordsMatch = text.match(/(keywords|popular search terms)\s*[:-]?\s*(.*?)(?=(title patterns|condition summary|$))/is);
      if (keywordsMatch && keywordsMatch[2]) {
        keywords = keywordsMatch[2].split(/,|\n|-/).map(k => k.trim()).filter(k => k.length > 2);
      }

      const titleMatch = text.match(/(common title patterns|title examples)\s*[:-]?\s*(.*?)(?=(keywords|condition summary|$))/is);
      if (titleMatch && titleMatch[2]) {
        marketTitlePatterns = titleMatch[2].split(/[\n;]/).map(t => t.trim().replace(/^['"-•]\s*/, '')).filter(t => t.length > 5);
      }


      const mappedGroundingSources: GroundingSource[] = groundingChunks.map((chunk: any) => ({
        type: 'googleSearch',
        uri: chunk.web?.uri || '',
        title: chunk.web?.title || '',
      })).filter((source: GroundingSource) => source.uri); // Filter out any empty URIs

      return {
        priceRange,
        conditionSummary,
        keywords,
        marketTitlePatterns,
        groundingSources: mappedGroundingSources,
      };

    } catch (error) {
      console.error('Error fetching eBay grounding data with Gemini:', error);
      throw new Error(`Error fetching market data: ${error instanceof Error ? error.message : String(error)}`);
    }
  },
};