import React, { useState, useEffect } from 'react';
import { eBayItem, ListingDraft, GroundingSource } from '../types';
import { chatGptService } from '../services/chatGptService';
import { ebayService } from '../services/ebayService';
import { databaseService } from '../services/databaseService';

interface ListingGeneratorProps {
  itemDescription: string;
  itemCategory: string;
  base64Image: string;
  imageUrl: string;
  ebayApiKey: string;
  chatGptApiKey: string;
  onListingGenerated: (listing: ListingDraft) => void;
}

const ListingGenerator: React.FC<ListingGeneratorProps> = ({
  itemDescription,
  itemCategory,
  base64Image,
  imageUrl,
  ebayApiKey,
  chatGptApiKey,
  onListingGenerated,
}) => {
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [listingDraft, setListingDraft] = useState<ListingDraft | null>(null);

  useEffect(() => {
    const generateListing = async () => {
      setIsLoading(true);
      setError(null);
      setListingDraft(null);

      try {
        // Step 1: Search for sold listings on eBay
        const soldListings: eBayItem[] = await ebayService.searchSoldListings(itemDescription, ebayApiKey);

        // Step 2: Get market data from sold listings
        const { marketPriceRange, marketConditionSummary, marketKeywords } = ebayService.getMarketData(soldListings);

        // Step 3: Generate listing draft using ChatGPT
        // Note: For search grounding, we are only using eBay search results here,
        // so the grounding sources will reflect those eBay listings.
        const groundingSources: GroundingSource[] = soldListings.map(item => ({
          type: 'googleSearch', // Using googleSearch type for general external web results, although it's eBay here.
          uri: item.listingUrl,
          title: item.title,
        }));


        const draft = await chatGptService.generateListingDraft(
          itemDescription,
          itemCategory,
          soldListings,
          chatGptApiKey,
          imageUrl,
          marketPriceRange,
          marketConditionSummary,
          marketKeywords,
          groundingSources, // Pass grounding sources to chatGptService
        );

        setListingDraft(draft);
        databaseService.saveListing(draft); // Save the generated listing
        onListingGenerated(draft);
      } catch (err) {
        setError(`Failed to generate listing: ${err instanceof Error ? err.message : String(err)}`);
        console.error('Listing generation error:', err);
      } finally {
        setIsLoading(false);
      }
    };

    if (itemDescription && itemCategory && base64Image) {
      generateListing();
    }
  }, [itemDescription, itemCategory, base64Image, imageUrl, ebayApiKey, chatGptApiKey, onListingGenerated]);

  if (isLoading) {
    return (
      <div className="p-4 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm bg-white dark:bg-gray-800 text-center flex-grow flex flex-col items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 dark:border-blue-400 mb-3"></div>
        <p className="text-blue-600 dark:text-blue-400 text-lg font-medium">Generating eBay Listing Draft...</p>
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">This may take a moment as we gather market data and craft the description.</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 border border-red-300 dark:border-red-600 rounded-lg shadow-sm bg-red-50 dark:bg-red-900 text-red-800 dark:text-red-200 flex-grow flex items-center justify-center">
        <p className="font-medium">Error: {error}</p>
      </div>
    );
  }

  if (!listingDraft) {
    return (
      <div className="p-4 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 text-center flex-grow flex items-center justify-center">
        <p>Your listing draft will appear here after identification.</p>
      </div>
    );
  }

  return (
    <div className="p-4 border border-green-300 dark:border-green-600 rounded-lg shadow-sm bg-green-50 dark:bg-green-950 flex-grow flex flex-col">
      <h2 className="text-xl font-semibold text-green-800 dark:text-green-200 mb-3">Generated Listing Draft</h2>

      <div className="flex-grow overflow-y-auto pr-2 custom-scrollbar">
        {listingDraft.imageUrl && (
          <div className="mb-4 flex justify-center">
            <img src={listingDraft.imageUrl} alt="Item for listing" className="max-h-48 rounded-md shadow-md object-contain" />
          </div>
        )}

        <div className="mb-4">
          <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-1">Suggested Title:</h3>
          <p className="text-gray-800 dark:text-gray-200">{listingDraft.suggestedTitle}</p>
        </div>

        <div className="mb-4">
          <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-1">Item Description:</h3>
          <p className="text-gray-800 dark:text-gray-200 whitespace-pre-wrap">{listingDraft.itemDescription}</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-1">Suggested Category:</h3>
            <p className="text-gray-800 dark:text-gray-200">{listingDraft.suggestedCategory}</p>
          </div>
          <div>
            <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-1">Suggested Price Range:</h3>
            <p className="text-gray-800 dark:text-gray-200">{listingDraft.suggestedPriceRange}</p>
          </div>
          <div>
            <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-1">Suggested Condition:</h3>
            <p className="text-gray-800 dark:text-gray-200">{listingDraft.suggestedCondition}</p>
          </div>
        </div>

        {listingDraft.exampleSoldListings && listingDraft.exampleSoldListings.length > 0 && (
          <div className="mb-4">
            <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-2">Example Sold Listings:</h3>
            <ul className="list-disc list-inside text-gray-700 dark:text-gray-300 space-y-1">
              {listingDraft.exampleSoldListings.map((item, index) => (
                <li key={index} className="text-sm">
                  <a href={item.listingUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline">
                    {item.title}
                  </a>{' '}
                  - Sold for {item.price} on {item.soldDate} (Condition: {item.condition})
                </li>
              ))}
            </ul>
          </div>
        )}

        {listingDraft.groundingSources && listingDraft.groundingSources.length > 0 && (
          <div className="mt-4 border-t border-gray-200 dark:border-gray-700 pt-4">
            <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-2">Sources:</h3>
            <ul className="list-disc list-inside text-gray-700 dark:text-gray-300 space-y-1">
              {listingDraft.groundingSources.map((source, index) => (
                <li key={index} className="text-sm">
                  {source.type === 'googleSearch' && (
                    <a href={source.uri} target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline">
                      {source.title || source.uri}
                    </a>
                  )}
                </li>
              ))}
            </ul>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
              Note: The listed sources provided context for generating this draft.
            </p>
          </div>
        )}

        <p className="text-xs text-gray-500 dark:text-gray-400 mt-4">
          Generated on: {listingDraft.generatedDate}
        </p>
      </div>
    </div>
  );
};

export default ListingGenerator;