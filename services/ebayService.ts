// Fix: Implement the eBay service to fetch sold listings.
import { eBayItem } from '../types';

/**
 * Helper to parse various price range formats from Gemini's output.
 * Examples: "$50 - $100", "around $75", "120 USD"
 * @param priceRangeString
 * @returns { min: number, max: number, avg: number }
 */
const parsePriceRange = (priceRangeString: string): { min: number, max: number, avg: number } => {
  const numbers = priceRangeString.match(/\$?\d[\d,\.]*/g)?.map(n => parseFloat(n.replace(/[^0-9.]/g, ''))).filter(n => !isNaN(n));

  if (!numbers || numbers.length === 0) {
    return { min: 30, max: 150, avg: 90 }; // Default fallback
  }

  if (numbers.length === 1) {
    const price = numbers[0];
    return { min: price * 0.8, max: price * 1.2, avg: price }; // Create a range around a single price
  }

  const min = Math.min(...numbers);
  const max = Math.max(...numbers);
  const avg = (min + max) / 2;
  return { min, max, avg };
};

export const ebayService = {
  /**
   * Fetches **mock** sold listings from eBay based on a query and market data.
   * This function simulates querying the eBay API by generating intelligent mock data.
   * Direct, real-time fetching of eBay "Sold Listings" from a frontend-only app is not
   * securely feasible due to OAuth 2.0 requirements for Client Secret protection.
   *
   * @param query The item description or search term.
   * @param ebayAppId The eBay App ID (Client ID). Its presence enables more realistic mock data.
   * @param marketPriceRange The price range string from Gemini's grounding data (e.g., "$50 - $100").
   * @param marketKeywords Keywords from Gemini's grounding data.
   * @param marketTitlePatterns Common title patterns from Gemini's grounding data.
   * @returns A Promise that resolves with an array of eBayItem.
   */
  fetchSoldListings: async (
    query: string,
    ebayAppId: string, // Renamed from ebayApiKey to ebayAppId
    marketPriceRange: string,
    marketKeywords: string[],
    marketTitlePatterns: string[],
  ): Promise<eBayItem[]> => {
    await new Promise(resolve => setTimeout(resolve, 1500)); // Simulate API call delay

    const useAdvancedMocks = ebayAppId && ebayAppId.trim() !== '';

    if (!useAdvancedMocks) {
      console.warn("eBay App ID is missing. Using generic mock data for sold listings.");
      return [
        {
          itemId: 'gen_9999',
          title: `Generic item similar to "${query}"`,
          price: 'US $49.99',
          shippingCost: 'US $7.99',
          imageUrl: 'https://via.placeholder.com/100x100?text=Generic+Item',
          listingUrl: 'https://www.ebay.com/',
          condition: 'Used',
          soldDate: '2024-01-01',
        },
      ];
    }

    const { min: parsedMinPrice, max: parsedMaxPrice, avg: parsedAvgPrice } = parsePriceRange(marketPriceRange);

    const generateRandomPrice = (basePrice: number): string => {
      const deviation = basePrice * 0.15; // +/- 15% from average
      let price = basePrice + (Math.random() * deviation * 2 - deviation);
      price = Math.max(parsedMinPrice * 0.9, price); // Ensure it's not too low
      price = Math.min(parsedMaxPrice * 1.1, price); // Ensure it's not too high
      return `US $${price.toFixed(2)}`;
    };

    const generateRandomTitle = (baseQuery: string): string => {
        let title = baseQuery;
        const keywordsToUse = [...marketKeywords, ...baseQuery.split(' ').filter(w => w.length > 3)].slice(0, 3);
        const patternsToUse = marketTitlePatterns.length > 0 ? marketTitlePatterns : [
            `Vintage {ITEM} Rare!`,
            `{ITEM} Used Good Condition`,
            `Tested {ITEM} Works Great`,
            `New {ITEM} In Box`
        ];

        if (keywordsToUse.length > 0) {
            title = keywordsToUse.join(' ') + ' ' + title;
        }

        const randomPattern = patternsToUse[Math.floor(Math.random() * patternsToUse.length)];
        title = randomPattern.replace('{ITEM}', title);
        title = title.replace(/\s{2,}/g, ' ').trim(); // Clean up extra spaces
        return title.length > 80 ? title.substring(0, 77) + '...' : title;
    };

    const conditions = ['Used', 'Used - Good', 'Used - Excellent', 'New', 'New - Open Box'];
    const randomCondition = conditions[Math.floor(Math.random() * conditions.length)];

    const mockListings: eBayItem[] = [];
    for (let i = 0; i < 3; i++) { // Generate 3 realistic mock listings
      mockListings.push({
        itemId: `mock_${Date.now()}_${i}`,
        title: generateRandomTitle(query),
        price: generateRandomPrice(parsedAvgPrice),
        shippingCost: `US $${(5 + Math.random() * 10).toFixed(2)}`,
        imageUrl: `https://via.placeholder.com/100x100?text=Sold+${query.split(' ')[0]}_${i + 1}`,
        listingUrl: `https://www.ebay.com/itm/mock_${Date.now()}_${i}`,
        condition: randomCondition,
        soldDate: new Date(Date.now() - Math.floor(Math.random() * 30 * 24 * 60 * 60 * 1000)).toISOString().split('T')[0], // Last 30 days
      });
    }

    return mockListings;
  },
};