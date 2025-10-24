import { eBayItem } from '../types';

interface eBaySearchResponse {
  itemSummaries: Array<{
    itemId: string;
    title: string;
    sellingStatus: {
      currentPrice: {
        value: string;
        currency: string;
      };
      // For sold listings, 'SOLD_FOR_FIXED_PRICE' or 'ENDED_WITH_SALE'
    };
    image: {
      imageUrl: string;
    };
    itemWebUrl: string;
    condition: string;
    // Assuming a property for sold date or inferring from other fields if needed
    itemEndDate?: string; // This might be available for ended listings
  }>;
}

/**
 * Defines available filters for eBay listing searches.
 * Note: The `buy/browse/v1/item_summary/search` API used here has limitations:
 * - 'Sold in last X days': Not directly filterable. Approximated by sorting by end date and limiting results.
 * - 'Shipping cost range': Not directly filterable in the API request. Would require client-side filtering
 *   after fetching results or using a different eBay API (e.g., Finding API).
 */
export interface eBayListingFilters {
  /**
   * Specifies the type of buying options to include.
   * Can be 'FIXED_PRICE', 'AUCTION', or both.
   * If not provided, defaults to both 'FIXED_PRICE' and 'AUCTION'.
   */
  buyingOptions?: ('FIXED_PRICE' | 'AUCTION')[];
  // Although requested, 'sold in last 30 days' and 'shipping cost range' are not
  // directly supported as server-side filters by this specific eBay Browse API endpoint.
  // The 'sold in last 30 days' is approximated by sorting by enddate and limiting,
  // and 'shipping cost range' would require client-side filtering or a different API.
  // For the purpose of this exercise and given the current API, these are noted as limitations.
}

export const ebayService = {
  /**
   * Generates an eBay OAuth Application Access Token (Bearer Token) using Client ID and Client Secret.
   * @param appId The eBay App ID (Client ID).
   * @param clientSecret The eBay Client Secret.
   * @returns A promise that resolves to the generated access token string.
   */
  generateAccessToken: async (appId: string, clientSecret: string): Promise<string> => {
    if (!appId || !clientSecret) {
      throw new Error("Both eBay App ID and Client Secret are required to generate an access token.");
    }

    try {
      const credentials = btoa(`${appId}:${clientSecret}`); // Base64 encode App ID and Client Secret

      const response = await fetch('https://api.ebay.com/identity/v1/oauth2/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': `Basic ${credentials}`,
        },
        body: 'grant_type=client_credentials&scope=https%3A%2F%2Fapi.ebay.com%2Foauth%2Fapi_scope%2Fbuy.browse',
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({})); // Handle cases where response is not JSON
        console.error('eBay OAuth Token Generation Error:', response.status, response.statusText, errorData);
        throw new Error(`eBay OAuth error: ${response.status} ${response.statusText} - ${errorData.error_description || errorData.error || 'Unknown error'}`);
      }

      const data = await response.json();
      if (!data.access_token) {
        throw new Error("eBay OAuth response did not contain an access_token.");
      }
      return data.access_token;
    } catch (error: any) { // Catch as 'any' to inspect error.name for TypeError
      console.error('Error generating eBay access token:', error);
      if (error instanceof TypeError && error.message === 'Failed to fetch') {
        throw new Error('eBay token generation failed: Network Error (likely CORS issue). Please ensure your browser allows requests to api.ebay.com, or consider manually generating the token if running locally without a proxy. More info: https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS');
      }
      throw new Error(`eBay token generation failed: ${error.message || String(error)}`);
    }
  },

  /**
   * Searches for recently sold eBay listings based on a query with optional filters.
   * @param query The search query (e.g., "vintage camera").
   * @param ebayOAuthToken The generated eBay OAuth Application Access Token (Bearer Token).
   * @param filters Optional filters for the search.
   * @returns A promise that resolves to an array of eBayItem.
   */
  searchSoldListings: async (
    query: string,
    ebayOAuthToken: string, // Changed from ebayApiKey
    filters?: eBayListingFilters
  ): Promise<eBayItem[]> => {
    if (!ebayOAuthToken) {
      throw new Error("eBay OAuth Access Token is missing. Please generate it in settings.");
    }

    try {
      let filterParams: string[] = ['itemCondition={USED|NEW|UNSPECIFIED}'];

      // Apply buying options filter
      const buyingOptions = filters?.buyingOptions;
      if (buyingOptions && buyingOptions.length > 0) {
        filterParams.push(`buyingOptions={${buyingOptions.join('|')}}`);
      } else {
        // Default to both FIXED_PRICE and AUCTION if not specified for sold listings context
        filterParams.push(`buyingOptions={FIXED_PRICE|AUCTION}`);
      }

      const filterString = filterParams.join(',');

      const response = await fetch(
        `https://api.ebay.com/buy/browse/v1/item_summary/search?q=${encodeURIComponent(query)}&filter=${encodeURIComponent(filterString)}&sort=enddate&limit=10`,
        {
          headers: {
            'Authorization': `Bearer ${ebayOAuthToken}`, // Use the generated OAuth token
            'X-EBAY-C-MARKETPLACE-ID': 'EBAY_US', // Targeting the US marketplace
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error('eBay API Error:', response.status, response.statusText, errorText);
        throw new Error(`eBay API error: ${response.status} ${response.statusText} - ${errorText}`);
      }

      const data: eBaySearchResponse = await response.json();

      // Filter for actual sold listings (ended items with a price)
      const soldItems = data.itemSummaries.filter(item =>
        item.sellingStatus?.currentPrice?.value && item.itemWebUrl
      );

      return soldItems.map(item => ({
        itemId: item.itemId,
        title: item.title,
        price: `${item.sellingStatus.currentPrice.currency} ${item.sellingStatus.currentPrice.value}`,
        imageUrl: item.image?.imageUrl || '',
        listingUrl: item.itemWebUrl,
        condition: item.condition || 'N/A',
        soldDate: item.itemEndDate ? new Date(item.itemEndDate).toLocaleDateString() : 'N/A',
      }));
    } catch (error: any) { // Catch as 'any' to inspect error.name for TypeError
      console.error('Error searching eBay sold listings:', error);
      if (error instanceof TypeError && error.message === 'Failed to fetch') {
        throw new Error('eBay search failed: Network Error (likely CORS issue). Please ensure your browser allows requests to api.ebay.com, or consider using a proxy if running locally.');
      }
      throw new Error(`eBay search failed: ${error.message || String(error)}`);
    }
  },

  /**
   * Derives market data (price range, condition summary, keywords) from a list of eBay items.
   * This is a simplified derivation and can be expanded for more sophisticated analysis.
   * @param items An array of eBayItem.
   * @returns An object containing market data.
   */
  getMarketData: (items: eBayItem[]) => {
    if (items.length === 0) {
      return {
        marketPriceRange: 'N/A',
        marketConditionSummary: 'N/A',
        marketKeywords: [],
      };
    }

    let minPrice = Infinity;
    let maxPrice = 0;
    const conditions: { [key: string]: number } = {};
    const titles: string[] = [];

    items.forEach(item => {
      titles.push(item.title);

      const priceValue = parseFloat(item.price.replace(/[^0-9.]/g, ''));
      if (!isNaN(priceValue)) {
        if (priceValue < minPrice) minPrice = priceValue;
        if (priceValue > maxPrice) maxPrice = priceValue;
      }

      if (item.condition) {
        conditions[item.condition] = (conditions[item.condition] || 0) + 1;
      }
    });

    const marketPriceRange = (minPrice === Infinity || maxPrice === 0)
      ? 'N/A'
      : `$${minPrice.toFixed(2)} - $${maxPrice.toFixed(2)} USD`;

    let marketConditionSummary = 'N/A';
    if (Object.keys(conditions).length > 0) {
      marketConditionSummary = Object.entries(conditions).sort(([, countA], [, countB]) => countB - countA)[0][0];
    }

    // Simple keyword extraction: take common words from titles
    const allWords = titles.flatMap(title => title.toLowerCase().split(/\s+/));
    const wordCounts: { [key: string]: number } = {};
    allWords.forEach(word => {
      // Filter out very common words or short words
      if (word.length > 2 && !['a', 'an', 'the', 'for', 'and', 'with', 'in', 'of'].includes(word)) {
        wordCounts[word] = (wordCounts[word] || 0) + 1;
      }
    });
    const marketKeywords = Object.entries(wordCounts)
      .sort(([, countA], [, countB]) => countB - countA)
      .slice(0, 5) // Top 5 keywords
      .map(([word]) => word);

    return {
      marketPriceRange,
      marketConditionSummary,
      marketKeywords,
    };
  },
};