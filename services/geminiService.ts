import { GoogleGenAI, Modality, GenerateContentResponse } from '@google/genai';
import { GroundingSource } from '../types';

// Helper function to convert Blob to Base64
export const blobToBase64 = (blob: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      resolve(result.split(',')[1]); // Extract base64 part
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

export const geminiService = {
  discernItemFromImage: async (base64Image: string, mimeType: string): Promise<string> => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

    try {
      const response: GenerateContentResponse = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: {
          parts: [
            {
              inlineData: {
                data: base64Image,
                mimeType: mimeType,
              },
            },
            {
              text: `Analyze the image and provide a concise, factual description of the main item visible.
              Focus on key characteristics, brand (if visible), color, and any distinguishing features that would be useful for selling the item.
              Crucially, identify and extract any specific alphanumeric identifiers such as model numbers, serial numbers, product codes, or other unique labels found on the item or its packaging. Prioritize these for accurate identification.
              Also, suggest a general category for this item.
              Format your response as a JSON object with 'description' and 'category' fields ONLY.`,
            },
          ],
        },
      });

      const responseText = response.text.trim();
      // Sometimes the model returns markdown code block, try to parse it
      const jsonString = responseText.startsWith('```json') && responseText.endsWith('```')
        ? responseText.substring(7, responseText.length - 3).trim()
        : responseText;

      const parsedResponse = JSON.parse(jsonString);
      return `Item: ${parsedResponse.description}\nCategory: ${parsedResponse.category}`;
    } catch (error) {
      console.error('Error discerning item with Gemini:', error);
      throw new Error(`Failed to discern item: ${error instanceof Error ? error.message : String(error)}`);
    }
  },

  fetchEbayGroundingData: async (
    query: string
  ): Promise<{ priceRange: string; conditionSummary: string; keywords: string[]; groundingSources: GroundingSource[] }> => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

    try {
      const response: GenerateContentResponse = await ai.models.generateContent({
        model: "gemini-2.5-flash", // Using gemini-2.5-flash for search grounding
        contents: `Perform a Google Search for recent eBay "Sold Listings" for "${query}".
          Based on the search results, summarize the following:
          1. Typical price range (e.g., "$50 - $100").
          2. Common conditions of sold items (e.g., "Mostly used, good condition").
          3. Key descriptive keywords, popular search terms, and unique selling points (list up to 5, comma-separated) that buyers commonly use when searching for and purchasing similar items on eBay.

          Format your response clearly, for example:
          Price Range: [Your price range]
          Condition Summary: [Your condition summary]
          Keywords: [keyword1, keyword2, keyword3]`,
        config: {
          tools: [{ googleSearch: {} }], // Enable Google Search grounding
        },
      });

      const responseText = response.text.trim();
      console.log("Grounding response text:", responseText);

      // Parse the structured text output
      const priceRangeMatch = responseText.match(/Price Range:\s*(.*)/i);
      const conditionSummaryMatch = responseText.match(/Condition Summary:\s*(.*)/i);
      const keywordsMatch = responseText.match(/Keywords:\s*(.*)/i);

      const priceRange = priceRangeMatch ? priceRangeMatch[1].trim() : 'N/A';
      const conditionSummary = conditionSummaryMatch ? conditionSummaryMatch[1].trim() : 'N/A';
      const keywords = keywordsMatch ? keywordsMatch[1].split(',').map(k => k.trim()).filter(k => k) : [];

      const groundingSources: GroundingSource[] = [];
      if (response.candidates?.[0]?.groundingMetadata?.groundingChunks) {
        const uniqueUris = new Set<string>();
        for (const chunk of response.candidates[0].groundingMetadata.groundingChunks) {
          if (chunk.web?.uri && !uniqueUris.has(chunk.web.uri)) {
            groundingSources.push({
              type: 'googleSearch',
              uri: chunk.web.uri,
              title: chunk.web.title,
            });
            uniqueUris.add(chunk.web.uri);
          }
        }
      }

      return { priceRange, conditionSummary, keywords, groundingSources };

    } catch (error) {
      console.error('Error fetching eBay grounding data with Gemini:', error);
      throw new Error(`Failed to get market data: ${error instanceof Error ? error.message : String(error)}`);
    }
  },
};