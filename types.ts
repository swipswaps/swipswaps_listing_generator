export interface eBayItem {
  itemId: string;
  title: string;
  price: string; // e.g., "US $19.99"
  shippingCost?: string;
  imageUrl: string;
  listingUrl: string;
  condition: string;
  soldDate: string;
}

export interface GroundingSource {
  type: 'googleSearch';
  uri: string;
  title?: string;
}

export interface ListingDraft {
  itemDescription: string;
  suggestedTitle: string;
  suggestedCategory: string;
  suggestedPriceRange: string;
  suggestedCondition: string;
  exampleSoldListings: eBayItem[];
  generatedDate: string;
  imageUrl?: string;
  groundingSources?: GroundingSource[]; // Added for search grounding
}

export interface ApiKeys {
  chatGptApiKey: string;
  ebayApiKey: string;
}