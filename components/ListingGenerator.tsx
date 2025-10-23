import React, { useState, useEffect, useCallback } from 'react';
import { ListingDraft, eBayItem, GroundingSource } from '../types';
import { ebayService } from '../services/ebayService';
import { chatGptService } from '../services/chatGptService';
import { databaseService } from '../services/databaseService';
import { geminiService } from '../services/geminiService'; // Import new service

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
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [listingDraft, setListingDraft] = useState<ListingDraft | null>(null);

  const generateListing = useCallback(async () => {
    if (!itemDescription) return;

    setLoading(true);
    setError(null);
    setListingDraft(null);

    try {
      // 1. Fetch Sold Items from eBay (mocked)
      // This is kept for the existing exampleSoldListings display.
      const soldItems: eBayItem[] = await ebayService.fetchSoldItems(itemDescription, ebayApiKey);

      // 2. Fetch eBay grounding data using Gemini with Google Search
      const searchGroundingQuery = `${itemDescription} ${itemCategory} eBay sold listings`;
      const groundingData = await geminiService.fetchEbayGroundingData(searchGroundingQuery);
      
      let suggestedPriceRange = groundingData.priceRange;
      let suggestedCondition = groundingData.conditionSummary;

      // Fallback if grounding data is 'N/A' but we have mock sold items
      if (suggestedPriceRange === 'N/A' && soldItems.length > 0) {
        const prices = soldItems.map(item => parseFloat(item.price.replace(/[^0-9.-]+/g, ""))).filter(p => !isNaN(p));
        const minPrice = prices.length ? Math.min(...prices) : 0;
        const maxPrice = prices.length ? Math.max(...prices) : 0;
        suggestedPriceRange = prices.length
          ? `$${minPrice.toFixed(2)} - $${maxPrice.toFixed(2)}`
          : 'N/A (no comparable sales found)';
      }
      if (suggestedCondition === 'N/A' && soldItems.length > 0) {
        suggestedCondition = soldItems[0].condition; // A simple heuristic
      }


      // 3. Refine description/title with ChatGPT (if key provided)
      let suggestedTitle = `[Your Item] - ${itemDescription.split('\n')[0].replace('Item: ', '').trim()}`;
      let detailedDescription = itemDescription;

      if (chatGptApiKey) {
        const refined = await chatGptService.refineListingDescription(itemDescription, itemCategory, chatGptApiKey);
        suggestedTitle = refined.title;
        detailedDescription = refined.detailedDescription;
      } else {
        // Enhance default title/description with keywords from grounding data
        const itemDescriptionLines = itemDescription.split('\n');
        const primaryItemDescription = itemDescriptionLines[0].replace('Item: ', '').trim();
        const additionalDetails = itemDescriptionLines.slice(1).join('\n').trim().replace('Category: ', '').trim();
        const keywordsForTitle = groundingData.keywords.length > 0 ? ` ${groundingData.keywords.slice(0, 2).join(' ')}` : '';
        const keywordsForDescription = groundingData.keywords.length > 0 ? ` Consider using terms like: ${groundingData.keywords.join(', ')}.` : '';

        suggestedTitle = `🔥 ${primaryItemDescription}${keywordsForTitle} - ${itemCategory} Listing!`;
        detailedDescription = `Get ready to list this fantastic ${primaryItemDescription} - a must-have ${itemCategory}!
        ${additionalDetails ? `Key details include: ${additionalDetails}. ` : ''}
        Based on our thorough market research of eBay sold listings, similar items typically sell in ${suggestedCondition.toLowerCase()} condition.
        This item is ready for a new owner and priced competitively.
        To attract more buyers and ensure a successful sale, craft your listing using descriptive keywords such as: ${groundingData.keywords.join(', ')}.`;
      }

      const newListing: ListingDraft = {
        itemDescription: detailedDescription,
        suggestedTitle: suggestedTitle,
        suggestedCategory: itemCategory,
        suggestedPriceRange: suggestedPriceRange,
        suggestedCondition: suggestedCondition,
        exampleSoldListings: soldItems,
        generatedDate: new Date().toLocaleString(),
        imageUrl: imageUrl,
        groundingSources: groundingData.groundingSources, // Add grounding sources
      };

      setListingDraft(newListing);
      onListingGenerated(newListing); // Notify parent
      databaseService.saveListing(newListing);

    } catch (e) {
      setError(`Failed to generate listing: ${e instanceof Error ? e.message : String(e)}`);
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [itemDescription, itemCategory, ebayApiKey, chatGptApiKey, imageUrl, onListingGenerated]);

  useEffect(() => {
    generateListing();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemDescription, itemCategory, ebayApiKey, chatGptApiKey]); // Regenerate if item or keys change

  return (
    <div className="p-4 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm bg-white dark:bg-gray-800 space-y-6">
      <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-100">Generated eBay Listing Draft</h2>

      {loading && (
        <div className="flex flex-col items-center justify-center p-8 bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-200 rounded-md">
          <svg className="animate-spin h-8 w-8 text-blue-500 dark:text-blue-300 mb-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <p className="font-medium">Generating your listing and performing market research...</p>
          <p className="text-sm mt-1">This might take a moment.</p>
        </div>
      )}

      {error && (
        <div className="p-4 bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-200 border border-red-300 dark:border-red-700 rounded-md">
          <p className="font-semibold">Error:</p>
          <p>{error}</p>
        </div>
      )}

      {listingDraft && (
        <div className="space-y-6">
          <div className="border border-indigo-300 dark:border-indigo-700 rounded-lg p-4 bg-indigo-50 dark:bg-indigo-950 text-gray-800 dark:text-gray-100">
            <h3 className="text-lg font-bold text-indigo-800 dark:text-indigo-200 mb-2">Your Draft Listing</h3>
            {listingDraft.imageUrl && (
              <div className="mb-4">
                <img src={listingDraft.imageUrl} alt="Item to list" className="max-h-48 mx-auto rounded-md shadow-md" />
              </div>
            )}
            <p className="mb-2"><strong className="text-indigo-700 dark:text-indigo-300">Suggested Title:</strong> {listingDraft.suggestedTitle}</p>
            <p className="mb-2"><strong className="text-indigo-700 dark:text-indigo-300">Suggested Category:</strong> {listingDraft.suggestedCategory}</p>
            <p className="mb-2"><strong className="text-indigo-700 dark:text-indigo-300">Suggested Price Range:</strong> {listingDraft.suggestedPriceRange} <span className="text-xs text-gray-600 dark:text-gray-400">(Based on eBay research)</span></p>
            <p className="mb-2"><strong className="text-indigo-700 dark:text-indigo-300">Suggested Condition:</strong> {listingDraft.suggestedCondition} <span className="text-xs text-gray-600 dark:text-gray-400">(Based on eBay research)</span></p>
            <p className="mb-2"><strong className="text-indigo-700 dark:text-indigo-300">Description:</strong> {listingDraft.itemDescription}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">Generated on: {listingDraft.generatedDate}</p>
          </div>

          {listingDraft.groundingSources && listingDraft.groundingSources.length > 0 && (
            <div className="mt-6 border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-gray-50 dark:bg-gray-700">
              <h3 className="text-md font-semibold text-gray-800 dark:text-gray-100 mb-2">eBay Research Sources</h3>
              <p className="text-sm text-gray-600 dark:text-gray-300 mb-3">Information above is grounded by the following online sources:</p>
              <ul className="list-disc pl-5 space-y-1 text-sm text-blue-700 dark:text-blue-300">
                {listingDraft.groundingSources.map((source, index) => (
                  <li key={index} className="flex items-start">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-4 h-4 mr-2 flex-shrink-0 mt-[2px]">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.36-1.36l1.758-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
                    </svg>
                    <a href={source.uri} target="_blank" rel="noopener noreferrer" className="hover:underline">
                      {source.title || source.uri}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="mt-6">
            <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-4">Example eBay Sold Listings</h3>
            {listingDraft.exampleSoldListings.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {listingDraft.exampleSoldListings.map((item) => (
                  <a href={item.listingUrl} target="_blank" rel="noopener noreferrer" key={item.itemId} className="block p-3 border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm hover:shadow-md transition-shadow duration-200 bg-gray-50 dark:bg-gray-700">
                    <img src={item.imageUrl} alt={item.title} className="w-full h-32 object-cover rounded-md mb-2" />
                    <h4 className="font-medium text-gray-800 dark:text-gray-100 truncate">{item.title}</h4>
                    <p className="text-sm text-green-700 dark:text-green-300 font-bold">{item.price}</p>
                    {item.shippingCost && <p className="text-xs text-gray-600 dark:text-gray-400">Shipping: {item.shippingCost}</p>}
                    <p className="text-xs text-gray-600 dark:text-gray-400">Condition: {item.condition}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-500">Sold: {item.soldDate}</p>
                  </a>
                ))}
              </div>
            ) : (
              <p className="text-gray-600 dark:text-gray-300">No comparable sold listings found for this item.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ListingGenerator;