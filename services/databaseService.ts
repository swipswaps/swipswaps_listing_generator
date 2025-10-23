import { ApiKeys, ListingDraft } from '../types';

const API_KEYS_STORAGE_KEY = 'api_keys';
const LISTINGS_STORAGE_KEY = 'generated_listings';

export const databaseService = {
  saveApiKeys: (keys: ApiKeys): void => {
    try {
      localStorage.setItem(API_KEYS_STORAGE_KEY, JSON.stringify(keys));
    } catch (error) {
      console.error('Error saving API keys to localStorage:', error);
    }
  },

  loadApiKeys: (): ApiKeys => {
    try {
      const storedKeys = localStorage.getItem(API_KEYS_STORAGE_KEY);
      // Ensure the structure matches the new ApiKeys interface if old data exists
      const parsedKeys = storedKeys ? JSON.parse(storedKeys) : { chatGptApiKey: '', ebayAppId: '' };
      // Handle potential legacy `ebayApiKey` in localStorage by mapping it to `ebayAppId`
      if (parsedKeys.ebayApiKey !== undefined && parsedKeys.ebayAppId === undefined) {
          parsedKeys.ebayAppId = parsedKeys.ebayApiKey;
          delete parsedKeys.ebayApiKey;
      }
      return parsedKeys;
    } catch (error) {
      console.error('Error loading API keys from localStorage:', error);
      return { chatGptApiKey: '', ebayAppId: '' };
    }
  },

  saveListing: (listing: ListingDraft): void => {
    try {
      const existingListings = databaseService.loadListings();
      existingListings.unshift(listing); // Add to the beginning
      localStorage.setItem(LISTINGS_STORAGE_KEY, JSON.stringify(existingListings));
    } catch (error) {
      console.error('Error saving listing to localStorage:', error);
    }
  },

  loadListings: (): ListingDraft[] => {
    try {
      const storedListings = localStorage.getItem(LISTINGS_STORAGE_KEY);
      return storedListings ? JSON.parse(storedListings) : [];
    } catch (error) {
      console.error('Error loading listings from localStorage:', error);
      return [];
    }
  },

  clearListings: (): void => {
    try {
      localStorage.removeItem(LISTINGS_STORAGE_KEY);
    } catch (error) {
      console.error('Error clearing listings from localStorage:', error);
    }
  },
};