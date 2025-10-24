import { GoogleGenAI, Modality } from '@google/genai';

// Utility function to convert a Blob (e.g., File) to a Base64 string.
export const blobToBase64 = (blob: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      // The result will be in the format "data:image/jpeg;base64,..."
      // We only need the base64 part, so we split and take the second element.
      const base64String = (reader.result as string).split(',')[1];
      resolve(base64String);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

export const geminiService = {
  /**
   * Identifies an item from a base64 encoded image using the Gemini API.
   * @param base64Image The base64 encoded image data.
   * @param mimeType The MIME type of the image (e.g., 'image/jpeg', 'image/png').
   * @returns A string containing the identified item description and category.
   */
  discernItemFromImage: async (base64Image: string, mimeType: string): Promise<string> => {
    // --- START BROWSER CONSOLE DIAGNOSTIC LOG (for `services/geminiService.ts`) ---
    console.log('--- Browser Console Debugging (geminiService.ts) ---');
    const apiKeyFromEnv = process.env.API_KEY;
    console.log('process.env.API_KEY (raw):', apiKeyFromEnv);
    console.log('typeof process.env.API_KEY:', typeof apiKeyFromEnv);
    // Attempt to slice/mask a portion if it's a string and has sufficient length
    console.log('process.env.API_KEY (masked/full):', typeof apiKeyFromEnv === 'string' && apiKeyFromEnv.length > 10
      ? apiKeyFromEnv.substring(0, 5) + '...' + apiKeyFromEnv.substring(apiKeyFromEnv.length - 5)
      : apiKeyFromEnv
    );
    console.log('--- End Browser Console Debugging ---');
    // --- END BROWSER CONSOLE DIAGNOSTIC LOG ---

    // Defensive check: Ensure API key is actually present and valid-looking
    if (!apiKeyFromEnv || typeof apiKeyFromEnv !== 'string' || apiKeyFromEnv.length < 10) {
      const errorMessage = "Gemini API Key is missing or invalid. Please check your .env.local file and vite.config.ts configuration.";
      console.error(errorMessage, "Current API Key Value:", apiKeyFromEnv);
      throw new Error(errorMessage);
    }

    // As per @google/genai coding guidelines, API_KEY must be obtained exclusively from process.env.API_KEY.
    const ai = new GoogleGenAI({ apiKey: apiKeyFromEnv }); // Use the variable to ensure we log what's used

    try {
      // Call generateContent with the gemini-2.5-flash-image model for image understanding.
      // The model 'gemini-2.5-flash-image' is suitable for general image generation and editing tasks,
      // and can also understand image content for tasks like item identification.
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
            {
              text: 'Identify the item in this image. Provide a concise description of the item and suggest a suitable eBay category. Format your response as: Item: [description]\nCategory: [category]',
            },
          ],
        },
        // For image identification, we expect a text response.
        config: {
          responseModalities: [Modality.TEXT],
        },
      });

      // Extract the text output from the GenerateContentResponse object.
      const text = response.text;
      if (!text) {
        throw new Error("Gemini did not return a valid text response for item identification.");
      }
      return text;
    } catch (error) {
      console.error('Error identifying item with Gemini:', error);
      throw new Error(`Gemini item identification failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  },
};