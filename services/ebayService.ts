import { eBayItem } from '../types';

// In a real application, this would involve server-side calls to eBay's APIs (e.g., Finding API for completed listings).
// Direct client-side calls are generally not feasible due to CORS and API key security.
export const ebayService = {
  fetchSoldItems: async (query: string, ebayApiKey?: string): Promise<eBayItem[]> => {
    console.log(`Simulating eBay "Sold Items" search for: "${query}"`);
    if (ebayApiKey) {
      console.log(`Using eBay API Key: ${ebayApiKey.substring(0, 5)}...`);
      // In a real app, you'd send this key to your backend proxy for eBay API calls.
    }

    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 1500));

    // Generate mock data based on the query
    const mockItems: eBayItem[] = [
      {
        itemId: '1234567890',
        title: `Used ${query} in excellent condition`,
        price: 'US $199.99',
        shippingCost: 'US $10.00',
        imageUrl: `https://picsum.photos/200/200?random=1&seed=${query.length}`,
        listingUrl: `https://www.ebay.com/itm/1234567890`,
        condition: 'Used',
        soldDate: 'Oct 26, 2024',
      },
      {
        itemId: '0987654321',
        title: `New ${query} - unopened box`,
        price: 'US $249.00',
        shippingCost: 'Free shipping',
        imageUrl: `https://picsum.photos/200/200?random=2&seed=${query.length}`,
        listingUrl: `https://www.ebay.com/itm/0987654321`,
        condition: 'New',
        soldDate: 'Oct 20, 2024',
      },
      {
        itemId: '1122334455',
        title: `${query} with minor scratches, fully functional`,
        price: 'US $150.50',
        shippingCost: 'US $12.50',
        imageUrl: `https://picsum.photos/200/200?random=3&seed=${query.length}`,
        listingUrl: `https://www.ebay.com/itm/1122334455`,
        condition: 'Used - Good',
        soldDate: 'Oct 15, 2024',
      },
    ];

    return mockItems;
  },
};
