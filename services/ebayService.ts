import { eBayItem } from '../types';

export const ebayService = {
  fetchSoldListings: async (query: string, ebayApiKey: string, marketPriceRange: string = 'N/A', marketKeywords: string[] = []): Promise<eBayItem[]> => {
    if (!ebayApiKey) {
      console.warn("eBay API Key is missing. Cannot fetch sold listings.");
      // Return a very basic set of mocks if no key, just to avoid breaking UI
      return [
        {
          itemId: 'mock1',
          title: `Generic ${query} Item (No eBay API Key)`,
          price: 'US $75.00',
          shippingCost: 'US $10.00',
          imageUrl: 'https://via.placeholder.com/200x150.png?text=No+Key',
          listingUrl: '#',
          condition: 'Used',
          soldDate: '2023-01-01',
        },
      ];
    }

    console.log(`Fetching sold listings for "${query}" using eBay API key: ${ebayApiKey.substring(0, 5)}...`);

    // Simulate API call delay
    await new Promise(resolve => setTimeout(resolve, 1500));

    let minPrice = 50;
    let maxPrice = 150;
    const priceRangeMatch = marketPriceRange.match(/\$([\d\.]+) - \$([\d\.]+)/);
    if (priceRangeMatch && priceRangeMatch[1] && priceRangeMatch[2]) {
      minPrice = parseFloat(priceRangeMatch[1]);
      maxPrice = parseFloat(priceRangeMatch[2]);
    }

    const generateRandomPrice = () => {
      const price = minPrice + Math.random() * (maxPrice - minPrice);
      return `US $${price.toFixed(2)}`;
    };

    const enhanceTitle = (baseTitle: string, keywords: string[]) => {
      if (keywords.length === 0) return baseTitle;
      // Pick a few random keywords to add
      const selectedKeywords = keywords.sort(() => 0.5 - Math.random()).slice(0, Math.min(2, keywords.length));
      return `${baseTitle} - ${selectedKeywords.join(' ')}`;
    };

    // Mock data for demonstration purposes, now informed by market data
    const mockListings: eBayItem[] = [
      {
        itemId: '1234567890',
        title: enhanceTitle(`Used ${query} - Good Condition`, marketKeywords),
        price: generateRandomPrice(),
        shippingCost: 'US $10.00',
        imageUrl: 'https://i.ebayimg.com/images/g/ABC/s-l200.jpg', // Placeholder image
        listingUrl: 'https://www.ebay.com/itm/1234567890',
        condition: 'Used',
        soldDate: '2023-10-26',
      },
      {
        itemId: '0987654321',
        title: enhanceTitle(`New ${query} - Sealed`, marketKeywords),
        price: generateRandomPrice(),
        shippingCost: 'Free shipping',
        imageUrl: 'https://i.ebayimg.com/images/g/DEF/s-l200.jpg', // Placeholder image
        listingUrl: 'https://www.ebay.com/itm/0987654321',
        condition: 'New',
        soldDate: '2023-10-25',
      },
      {
        itemId: '1122334455',
        title: enhanceTitle(`Vintage ${query} - Minor Wear`, marketKeywords),
        price: generateRandomPrice(),
        shippingCost: 'US $12.50',
        imageUrl: 'https://i.ebayimg.com/images/g/GHI/s-l200.jpg', // Placeholder image
        listingUrl: 'https://www.ebay.com/itm/1122334455',
        condition: 'Used',
        soldDate: '2023-10-24',
      },
      {
        itemId: '5544332211',
        title: enhanceTitle(`Tested ${query} - Working`, marketKeywords),
        price: generateRandomPrice(),
        shippingCost: 'US $8.00',
        imageUrl: 'https://i.ebayimg.com/images/g/JKL/s-l200.jpg', // Placeholder image
        listingUrl: 'https://www.ebay.com/itm/5544332211',
        condition: 'Used',
        soldDate: '2023-10-23',
      },
    ];

    // Filter mock listings based on query for a slightly more realistic feel
    const filteredListings = mockListings.filter(item =>
      item.title.toLowerCase().includes(query.toLowerCase())
    );

    return filteredListings;
  },
};
