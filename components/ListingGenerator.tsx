import React, { useState, useEffect, useCallback } from 'react';
import { ListingDraft, eBayItem, GroundingSource } from '../types';
import { databaseService } from '../services/databaseService';
import { ebayService } from '../services/ebayService';
import { chatGptService } from '../services/chatGptService';
import { geminiService } from '../services/geminiService'; // Import geminiService for grounding

interface ListingGeneratorProps {
  itemDescription: string;
  itemCategory: string;
  base64Image: string; // Not directly used here, but passed to ListingDraft
  imageUrl: string; // Used for displaying and passing to ListingDraft
  ebayApiKey: string;
  chatGptApiKey: string;
  onListingGenerated: (listing: ListingDraft) => void;
}

const ListingGenerator: React.FC<ListingGeneratorProps> = ({
  itemDescription,
  itemCategory,
  imageUrl,
  ebayApiKey,
  chatGptApiKey,
  onListingGenerated,
}) => {
  const [isLoadingGrounding, setIsLoadingGrounding] = useState<boolean>(false);
  const [isLoadingSoldListings, setIsLoadingSoldListings] = useState<boolean>(false);
  const [isLoadingChatGpt, setIsLoadingChatGpt] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [generatedListing, setGeneratedListing] = useState<ListingDraft | null>(null);

  // States for market grounding data
  const [groundingPriceRange, setGroundingPriceRange] = useState<string>('N/A');
  const [groundingConditionSummary, setGroundingConditionSummary] = useState<string>('N/A');
  const [groundingKeywords, setGroundingKeywords] = useState<string[]>([]);
  const [groundingSources, setGroundingSources] = useState<GroundingSource[]>([]);
  const [fetchedSoldListings, setFetchedSoldListings] = useState<eBayItem[]>([]);


  const generateListingDraft = useCallback(async () => {
    setError(null);
    setGeneratedListing(null);

    try {
      // 1. Perform Market Research (Gemini Grounding)
      setIsLoadingGrounding(true);
      const groundingData = await geminiService.fetchEbayGroundingData(itemDescription);
      setGroundingPriceRange(groundingData.priceRange);
      setGroundingConditionSummary(groundingData.conditionSummary);
      setGroundingKeywords(groundingData.keywords);
      setGroundingSources(groundingData.groundingSources);
      setIsLoadingGrounding(false);

      // 2. Fetch sold listings from eBay (informed by grounding data)
      setIsLoadingSoldListings(true);
      const listings = await ebayService.fetchSoldListings(
        itemDescription,
        ebayApiKey,
        groundingData.priceRange,
        groundingData.keywords
      );
      setFetchedSoldListings(listings);
      setIsLoadingSoldListings(false);

      let draft: ListingDraft;

      // 3. Generate listing draft using ChatGPT (if key available) or fallback
      if (chatGptApiKey) {
        setIsLoadingChatGpt(true);
        draft = await chatGptService.generateListingDraft(
          itemDescription,
          itemCategory,
          listings,
          chatGptApiKey,
          imageUrl,
          groundingData.priceRange,
          groundingData.conditionSummary,
          groundingData.keywords,
          groundingData.groundingSources
        );
        setIsLoadingChatGpt(false);
      } else {
        // Fallback: Manually construct ListingDraft if ChatGPT key is missing
        console.warn("ChatGPT API Key missing. Generating basic listing draft without ChatGPT.");

        const primaryDescription = itemDescription;
        const additionalDetails = groundingData.keywords.length > 0 ? `Key features/search terms: ${groundingData.keywords.join(', ')}.` : '';

        draft = {
          itemDescription: `This is a ${groundingData.conditionSummary.toLowerCase()} ${primaryDescription} for sale. ${additionalDetails}
          Carefully inspected and ready for a new owner. Refer to photos for exact condition.`,
          suggestedTitle: `${primaryDescription} - ${groundingData.keywords[0] || itemCategory} - ${groundingData.conditionSummary.split(' - ')[0] || 'Used'}`,
          suggestedCategory: itemCategory,
          suggestedPriceRange: groundingData.priceRange,
          suggestedCondition: groundingData.conditionSummary.split(' - ')[0] || 'Used', // Take first part like "Used"
          exampleSoldListings: listings,
          generatedDate: new Date().toLocaleDateString(),
          imageUrl: imageUrl,
          groundingSources: groundingData.groundingSources,
        };
      }

      setGeneratedListing(draft);
      databaseService.saveListing(draft); // Save to history
      onListingGenerated(draft); // Notify parent component
    } catch (e) {
      setError(`Failed to generate listing: ${e instanceof Error ? e.message : String(e)}`);
      console.error('Listing generation error:', e);
    } finally {
      setIsLoadingGrounding(false);
      setIsLoadingSoldListings(false);
      setIsLoadingChatGpt(false);
    }
  }, [itemDescription, itemCategory, ebayApiKey, chatGptApiKey, imageUrl, onListingGenerated]);

  useEffect(() => {
    // Trigger generation when itemDescription or itemCategory changes
    // Also re-trigger if API keys change (so the user can switch between ChatGPT / fallback)
    if (itemDescription && itemCategory) {
      generateListingDraft();
    }
  }, [itemDescription, itemCategory, ebayApiKey, chatGptApiKey, generateListingDraft]);

  const isLoading = isLoadingGrounding || isLoadingSoldListings || isLoadingChatGpt;

  return (
    <div className="flex flex-col p-4 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm bg-white dark:bg-gray-800 space-y-4 h-full">
      <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-100">eBay Listing Draft</h2>

      {isLoading && (
        <div className="flex flex-col items-center justify-center space-y-2 text-blue-600 dark:text-blue-400">
          <svg className="animate-spin h-5 w-5 text-current" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          {isLoadingGrounding && <span>Performing market research with Gemini...</span>}
          {!isLoadingGrounding && isLoadingSoldListings && <span>Fetching example eBay listings...</span>}
          {!isLoadingGrounding && !isLoadingSoldListings && isLoadingChatGpt && <span>Generating listing draft with ChatGPT...</span>}
          {!isLoadingGrounding && !isLoadingSoldListings && !isLoadingChatGpt && <span>Generating listing draft...</span>} {/* Fallback if no specific step is loading */}
        </div>
      )}

      {error && (
        <p className="text-red-500 dark:text-red-400 text-sm">{error}</p>
      )}

      {generatedListing && (
        <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-md space-y-3 flex-grow overflow-auto text-gray-800 dark:text-gray-100">
          <h3 className="text-lg font-bold">{generatedListing.suggestedTitle}</h3>
          {generatedListing.imageUrl && (
            <div className="flex justify-center my-3">
              <img src={generatedListing.imageUrl} alt="Generated Listing Item" className="max-h-48 rounded-md shadow-sm border border-gray-200 dark:border-gray-600" />
            </div>
          )}
          <p><strong>Category:</strong> {generatedListing.suggestedCategory}</p>
          <p><strong>Condition:</strong> {generatedListing.suggestedCondition}</p>
          <p><strong>Price Range:</strong> {generatedListing.suggestedPriceRange}</p>
          <div>
            <strong>Description:</strong>
            <p className="whitespace-pre-wrap text-sm">{generatedListing.itemDescription}</p>
          </div>

          {generatedListing.exampleSoldListings && generatedListing.exampleSoldListings.length > 0 && (
            <div className="mt-4">
              <h4 className="font-semibold mb-2">Comparable Sold Listings:</h4>
              <ul className="list-disc list-inside text-sm text-gray-700 dark:text-gray-200 space-y-1">
                {generatedListing.exampleSoldListings.map((item, idx) => (
                  <li key={idx}>
                    <a href={item.listingUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline">
                      {item.title}
                    </a> ({item.price} {item.shippingCost && `+ ${item.shippingCost}`}) - {item.soldDate} ({item.condition})
                  </li>
                ))}
              </ul>
            </div>
          )}
           {generatedListing.groundingSources && generatedListing.groundingSources.length > 0 && (
            <div className="mt-4">
              <h4 className="font-semibold mb-2">Grounding Sources (from Google Search):</h4>
              <ul className="list-disc list-inside text-sm text-gray-700 dark:text-gray-200 space-y-1">
                {generatedListing.groundingSources.map((source, idx) => (
                  <li key={idx} className="flex items-center">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-4 h-4 mr-1 text-gray-500 dark:text-gray-400 flex-shrink-0">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
                    </svg>
                    <a href={source.uri} target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline break-all">
                      {source.title || source.uri}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <p className="text-xs text-gray-600 dark:text-gray-400 mt-2">Generated: {generatedListing.generatedDate}</p>
        </div>
      )}

      {!isLoading && !generatedListing && !error && (
        <div className="text-gray-600 dark:text-gray-300 text-center flex-grow flex items-center justify-center">
          <p>Click "Identify Item with Gemini" to start generating your listing draft.</p>
        </div>
      )}

      {/* Re-generate button for convenience */}
      {!isLoading && (
        <button
          onClick={generateListingDraft}
          className="w-full px-5 py-2 bg-purple-600 text-white rounded-md shadow hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200 mt-auto"
        >
          Re-generate Listing Draft
        </button>
      )}
    </div>
  );
};

export default ListingGenerator;
