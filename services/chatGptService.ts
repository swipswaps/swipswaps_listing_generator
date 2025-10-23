import OpenAI from 'openai';
import { ListingDraft, eBayItem, GroundingSource } from '../types';

export const chatGptService = {
  generateListingDraft: async (
    itemDescription: string,
    itemCategory: string,
    soldListings: eBayItem[],
    chatGptApiKey: string,
    imageUrl: string, // Added to pass to ListingDraft
    marketPriceRange: string,
    marketConditionSummary: string,
    marketKeywords: string[],
    groundingSources: GroundingSource[],
  ): Promise<ListingDraft> => {
    if (!chatGptApiKey) {
      throw new Error("ChatGPT API Key is missing. Please configure it in settings.");
    }

    try {
      const openai = new OpenAI({ apiKey: chatGptApiKey, dangerouslyAllowBrowser: true });

      const soldListingsText = soldListings.map(item =>
        `- ${item.title} (Sold for ${item.price} on ${item.soldDate}, Condition: ${item.condition})`
      ).join('\n');

      const systemPrompt = `You are an expert eBay listing assistant. Your goal is to generate a comprehensive, attractive, and well-priced eBay listing draft based on an item description, market research data, and similar sold listings.
      The output MUST be a JSON object conforming to the following TypeScript interface:

      interface ListingDraft {
        itemDescription: string;
        suggestedTitle: string;
        suggestedCategory: string;
        suggestedPriceRange: string;
        suggestedCondition: string;
        exampleSoldListings: eBayItem[];
        generatedDate: string;
        imageUrl?: string;
        groundingSources?: GroundingSource[];
      }

      For 'suggestedPriceRange', use the provided market price range or infer it from the sold listings (e.g., "$75 - $100 USD").
      For 'suggestedCondition', use the provided market condition summary or infer from the item description and sold listings.
      'itemDescription' in the output should be a detailed, SEO-friendly description suitable for an eBay listing, incorporating the provided market keywords and any unique selling points.
      'suggestedTitle' should be catchy and include important keywords.`;

      const userPrompt = `I need an eBay listing draft for the following item:
      Item identified: ${itemDescription}
      Suggested Category by image: ${itemCategory}

      Market Research Data:
      - Typical Price Range: ${marketPriceRange}
      - Common Condition Summary: ${marketConditionSummary}
      - Key Descriptive Keywords: ${marketKeywords.join(', ')}

      Here are some similar items that recently sold on eBay:
      ${soldListingsText || "No comparable sold listings found."}

      Please generate the ListingDraft JSON. Ensure all fields are populated based on the provided information, prioritizing market research data where available.
      Do not include any other text or formatting, just the JSON object.`;

      const response = await openai.chat.completions.create({
        model: 'gpt-4o-mini', // Using a suitable OpenAI model for this task
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        response_format: { type: 'json_object' },
        temperature: 0.7,
      });

      const jsonResponse = response.choices[0].message?.content;
      if (!jsonResponse) {
        throw new Error("ChatGPT did not return a valid JSON response.");
      }

      const listingDraft: ListingDraft = JSON.parse(jsonResponse);

      // Add fields that ChatGPT wouldn't generate directly or are from other sources
      listingDraft.exampleSoldListings = soldListings;
      listingDraft.generatedDate = new Date().toLocaleDateString();
      listingDraft.imageUrl = imageUrl; // Pass the image URL received from props
      listingDraft.groundingSources = groundingSources; // Pass grounding sources

      return listingDraft;
    } catch (error) {
      console.error('Error generating listing draft with ChatGPT:', error);
      throw new Error(`ChatGPT listing generation failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  },
};
