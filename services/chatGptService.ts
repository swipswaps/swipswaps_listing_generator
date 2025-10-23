// Fix: Implement the ChatGPT (or a generic LLM) service for generating listing drafts.
import { eBayItem, ListingDraft, GroundingSource } from '../types';

export const chatGptService = {
  /**
   * Generates a mock eBay listing draft based on an item description, category, and example sold listings.
   * In a real application, this would involve sending a prompt to an LLM like Gemini Pro.
   * @param itemDescription The description of the item.
   * @param itemCategory The suggested category for the item.
   * @param exampleSoldListings An array of eBayItem to use as examples for pricing and details.
   * @param imageUrl An optional image URL for the listing.
   * @param chatGptApiKey The API key for the LLM.
   * @param marketPriceRange The price range string from Gemini's grounding data.
   * @param marketConditionSummary The condition summary from Gemini's grounding data.
   * @param marketKeywords Keywords from Gemini's grounding data.
   * @param marketTitlePatterns Common title patterns from Gemini's grounding data.
   * @param groundingSources Grounding sources from Gemini.
   * @returns A Promise that resolves with a ListingDraft object.
   */
  generateListingDraft: async (
    itemDescription: string,
    itemCategory: string,
    exampleSoldListings: eBayItem[],
    imageUrl?: string,
    chatGptApiKey?: string,
    marketPriceRange?: string,
    marketConditionSummary?: string,
    marketKeywords?: string[],
    marketTitlePatterns?: string[],
    groundingSources?: GroundingSource[],
  ): Promise<ListingDraft> => {
    // Simulate API call delay
    await new Promise(resolve => setTimeout(resolve, 2000));

    if (!chatGptApiKey) {
      console.warn("LLM (ChatGPT/Gemini Pro) API Key is missing. Using internal fallback logic.");
      // Fallback logic when no LLM key is provided
      const priceText = marketPriceRange || 'US $XX.XX - $YY.YY';
      const conditionText = marketConditionSummary || 'Used - Good';
      const keywordsString = (marketKeywords && marketKeywords.length > 0) ? marketKeywords.join(', ') : 'collectible, rare';
      const titlePattern = (marketTitlePatterns && marketTitlePatterns.length > 0) ? marketTitlePatterns[0].replace('{ITEM}', itemDescription) : `Awesome ${itemDescription} - Great Find!`;

      return {
        itemDescription: `This is a highly sought-after ${itemDescription}. Based on recent market analysis, similar items have sold in ${conditionText} condition. This particular piece is perfect for collectors or enthusiasts. Key features include: [Add specific features from itemDescription here]. Incorporate keywords like: ${keywordsString}. A truly unique opportunity!`,
        suggestedTitle: titlePattern,
        suggestedCategory: itemCategory,
        suggestedPriceRange: priceText,
        suggestedCondition: conditionText,
        exampleSoldListings: exampleSoldListings,
        generatedDate: new Date().toLocaleString(),
        imageUrl: imageUrl,
        groundingSources: groundingSources,
      };
    }

    // --- Real LLM API call (mocked for this demo) ---
    // If we were using an actual LLM, the prompt would be constructed like this:
    const soldListingsInfo = exampleSoldListings.map(item =>
      `Title: ${item.title}, Price: ${item.price}, Condition: ${item.condition}, Sold: ${item.soldDate}`
    ).join('\n');

    const prompt = `You are an expert eBay listing assistant. Create a compelling eBay listing draft.
    
    Item Identified: ${itemDescription}
    Suggested Primary Category: ${itemCategory}
    
    Market Data from eBay Sold Listings:
    - Recent Price Range: ${marketPriceRange || 'Not available'}
    - Common Conditions: ${marketConditionSummary || 'Not available'}
    - Popular Keywords: ${marketKeywords?.join(', ') || 'Not available'}
    - Common Title Patterns: ${marketTitlePatterns?.join('; ') || 'Not available'}
    
    Example Similar Sold Listings (for additional context):
    ${soldListingsInfo || 'No examples provided.'}

    Consider the following:
    - Craft a catchy and descriptive title (max 80 characters) incorporating popular keywords and patterns.
    - Write a detailed item description highlighting key features, its condition (from market data if possible), any unique aspects, and why a buyer would want it.
    - Provide a suggested price range based on the market data.
    - Provide a suggested condition.
    
    Output your response as a JSON object with the following keys:
    {
      "suggestedTitle": "string",
      "itemDescription": "string",
      "suggestedPriceRange": "string",
      "suggestedCondition": "string"
    }
    `;

    // Mock API call response
    const priceSuggestions = exampleSoldListings.map(item => parseFloat(item.price.replace(/[^0-9.]/g, ''))).filter(n => !isNaN(n));
    const avgPrice = priceSuggestions.length > 0 ? (priceSuggestions.reduce((a, b) => a + b, 0) / priceSuggestions.length).toFixed(2) : 'N/A';
    const minPrice = priceSuggestions.length > 0 ? Math.min(...priceSuggestions).toFixed(2) : 'N/A';
    const maxPrice = priceSuggestions.length > 0 ? Math.max(...priceSuggestions).toFixed(2) : 'N/A';

    const conditions = Array.from(new Set(exampleSoldListings.map(item => item.condition)));
    const finalSuggestedCondition = marketConditionSummary || (conditions.length > 0 ? conditions[0] : 'Used');

    const finalSuggestedTitle = (marketTitlePatterns && marketTitlePatterns.length > 0)
        ? marketTitlePatterns[Math.floor(Math.random() * marketTitlePatterns.length)].replace('{ITEM}', itemDescription)
        : `🌟 RARE! ${itemDescription.toUpperCase()} - ${finalSuggestedCondition} Condition!`;

    const finalItemDescription = `This is a premium ${itemDescription}. Based on market trends, similar items sell well in ${finalSuggestedCondition} condition. This draft includes details to help it stand out. It has been well-maintained and is in excellent working order, perfect for collectors or everyday use. Minor cosmetic wear consistent with age, but fully functional. Key selling points: ${(marketKeywords || []).join(', ')}. Don't miss this opportunity!`;

    return {
      itemDescription: finalItemDescription,
      suggestedTitle: finalSuggestedTitle,
      suggestedCategory: itemCategory,
      suggestedPriceRange: marketPriceRange || (priceSuggestions.length > 0 ? `US $${minPrice} - $${maxPrice} (Avg: $${avgPrice})` : 'US $XX.XX - $YY.YY'),
      suggestedCondition: finalSuggestedCondition,
      exampleSoldListings: exampleSoldListings,
      generatedDate: new Date().toLocaleString(),
      imageUrl: imageUrl,
      groundingSources: groundingSources,
    };
  },
};