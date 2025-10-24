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
  base64Image?: string; // Storing base64 image data
  mimeType?: string; // Storing mime type for base64 image
  groundingSources?: GroundingSource[]; // Added for search grounding
}

export interface ApiKeys {
  chatGptApiKey: string;
  ebayAppId: string; // New: Stores the eBay App ID (Client ID)
  ebayClientSecret: string; // New: Stores the eBay Client Secret
  ebayOAuthToken: string; // New: Stores the generated OAuth Application Access Token (Bearer Token)
}