// Fix: Implement the ListingGenerator component.
import React, { useState, useEffect } from 'react';
import { eBayItem, ListingDraft, GroundingSource } from '../types';
import { ebayService } from '../services/ebayService';
import { chatGptService } from '../services/chatGptService';
import { databaseService } from '../services/databaseService';
import { geminiService } from '../services/geminiService'; // Import geminiService for grounding

interface ListingGeneratorProps {
  itemDescription: string;
  itemCategory: string;
  base64Image: string;
  imageUrl: string;
  ebayAppId: string; // Renamed from ebayApiKey to ebayAppId
  chatGptApiKey: string;
  onListingGenerated: (listing: ListingDraft) => void;
}

const ListingGenerator: React.FC<ListingGeneratorProps> = ({
  itemDescription,
  itemCategory,
  imageUrl,
  ebayAppId, // Renamed from ebayApiKey
  chatGptApiKey,
  onListingGenerated,
}) => {
  const [soldListings, setSoldListings] = useState<eBayItem[]>([]);
  const [generatedDraft, setGeneratedDraft] = useState<ListingDraft | null>(null);
  const [isLoadingGrounding, setIsLoadingGrounding] = useState<boolean>(false);
  const [isLoadingSoldListings, setIsLoadingSoldListings] = useState<boolean>(false);
  const [isLoadingChatGpt, setIsLoadingChatGpt] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // States for market data from Gemini grounding
  const [groundingPriceRange, setGroundingPriceRange] = useState<string>('N/A');
  const [groundingConditionSummary, setGroundingConditionSummary] = useState<string>('N/A');
  const [groundingKeywords, setGroundingKeywords] = useState<string[]>([]);
  const [marketTitlePatterns, setMarketTitlePatterns] = useState<string[]>([]);
  const [groundingSources, setGroundingSources] = useState<GroundingSource[]>([]);

  // State for editable fields, initialized after generation
  const [editableTitle, setEditableTitle] = useState('');
  const [editableDescription, setEditableDescription] = useState('');
  const [editableCategory, setEditableCategory] = useState('');
  const [editablePriceRange, setEditablePriceRange] = useState('');
  const [editableCondition, setEditableCondition] = useState('');

  const generateListing = async () => {
    setIsLoadingGrounding(true);
    setIsLoadingSoldListings(false); // Reset other loading states
    setIsLoadingChatGpt(false);
    setError(null);
    setGeneratedDraft(null);
    setSoldListings([]);
    setGroundingPriceRange('N/A');
    setGroundingConditionSummary('N/A');
    setGroundingKeywords([]);
    setMarketTitlePatterns([]);
    setGroundingSources([]);

    try {
      // 1. Perform Market Research (Gemini Grounding)
      const marketData = await geminiService.fetchEbayGroundingData(itemDescription);
      setGroundingPriceRange(marketData.priceRange);
      setGroundingConditionSummary(marketData.conditionSummary);
      setGroundingKeywords(marketData.keywords);
      setMarketTitlePatterns(marketData.marketTitlePatterns);
      setGroundingSources(marketData.groundingSources);
      
      setIsLoadingGrounding(false);
      setIsLoadingSoldListings(true);

      // 2. Fetch Example Sold Listings (eBay Service - now a smart mock informed by grounding)
      const listings = await ebayService.fetchSoldListings(
        itemDescription,
        ebayAppId, // Pass ebayAppId
        marketData.priceRange,
        marketData.keywords,
        marketData.marketTitlePatterns,
      );
      setSoldListings(listings);

      setIsLoadingSoldListings(false);
      setIsLoadingChatGpt(true);

      // 3. Generate listing draft using the chatGptService (LLM) or fallback
      let draft: ListingDraft;
      if (chatGptApiKey && chatGptApiKey.trim() !== '') {
        draft = await chatGptService.generateListingDraft(
          itemDescription,
          itemCategory,
          listings,
          imageUrl,
          chatGptApiKey,
          marketData.priceRange,
          marketData.conditionSummary,
          marketData.keywords,
          marketData.marketTitlePatterns,
          marketData.groundingSources,
        );
      } else {
        // Fallback: Construct draft using Gemini's market data directly
        const primaryItemDescription = itemDescription.split('\n')[0].replace('Item:', '').trim();
        const additionalDetails = itemDescription.split('\n').slice(1).join('\n').trim();

        const defaultTitle = (marketData.marketTitlePatterns && marketData.marketTitlePatterns.length > 0)
          ? marketData.marketTitlePatterns[Math.floor(Math.random() * marketData.marketTitlePatterns.length)].replace('{ITEM}', primaryItemDescription)
          : `${primaryItemDescription} - ${marketData.conditionSummary} - Rare Find!`;

        const defaultDescription = `This is a highly sought-after ${primaryItemDescription}. ${additionalDetails ? `It features: ${additionalDetails}.` : ''} Based on recent market analysis, similar items have sold for ${marketData.priceRange} in ${marketData.conditionSummary} condition. This particular piece is perfect for collectors or enthusiasts. Key selling points include: ${marketData.keywords.join(', ')}. A truly unique opportunity!`;
        
        draft = {
          itemDescription: defaultDescription,
          suggestedTitle: defaultTitle,
          suggestedCategory: itemCategory,
          suggestedPriceRange: marketData.priceRange,
          suggestedCondition: marketData.conditionSummary,
          exampleSoldListings: listings,
          generatedDate: new Date().toLocaleString(),
          imageUrl: imageUrl,
          groundingSources: marketData.groundingSources,
        };
      }

      setGeneratedDraft(draft);
      onListingGenerated(draft);

      // Initialize editable fields with generated draft data
      setEditableTitle(draft.suggestedTitle);
      setEditableDescription(draft.itemDescription);
      setEditableCategory(draft.suggestedCategory);
      setEditablePriceRange(draft.suggestedPriceRange);
      setEditableCondition(draft.suggestedCondition);

      databaseService.saveListing(draft);

    } catch (err) {
      setError(`Listing generation error: ${err instanceof Error ? err.message : String(err)}`);
      console.error(err);
    } finally {
      setIsLoadingGrounding(false);
      setIsLoadingSoldListings(false);
      setIsLoadingChatGpt(false);
    }
  };

  useEffect(() => {
    if (itemDescription && itemCategory) {
      generateListing();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemDescription, itemCategory, ebayAppId, chatGptApiKey]); // Re-run if item/category or API keys change

  const handleSaveEditedListing = () => {
    if (generatedDraft) {
      const updatedListing: ListingDraft = {
        ...generatedDraft,
        suggestedTitle: editableTitle,
        itemDescription: editableDescription,
        suggestedCategory: editableCategory,
        suggestedPriceRange: editablePriceRange,
        suggestedCondition: editableCondition,
      };
      // For simplicity, we'll just save it again.
      databaseService.saveListing(updatedListing);
      setGeneratedDraft(updatedListing); // Update current view
      alert('Listing saved successfully!');
    }
  };

  const isAnyLoading = isLoadingGrounding || isLoadingSoldListings || isLoadingChatGpt;

  return (
    <div className="p-4 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm bg-white dark:bg-gray-800 flex flex-col space-y-4">
      <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-100">eBay Listing Assistant</h2>

      {isAnyLoading && (
        <div className="flex flex-col items-center justify-center p-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 dark:border-blue-400"></div>
          {isLoadingGrounding && <p className="ml-3 text-blue-600 dark:text-blue-400 mt-2">Performing market research with Gemini...</p>}
          {isLoadingSoldListings && <p className="ml-3 text-blue-600 dark:text-blue-400 mt-2">Fetching comparable sold listings...</p>}
          {isLoadingChatGpt && <p className="ml-3 text-blue-600 dark:text-blue-400 mt-2">Generating listing draft...</p>}
        </div>
      )}

      {error && (
        <p className="text-red-500 dark:text-red-400 text-sm mt-2">{error}</p>
      )}

      {!generatedDraft && !isAnyLoading && (
        <div className="text-gray-600 dark:text-gray-300 text-center p-4">
          <p>Item identified. Generating a listing draft and researching sold items...</p>
        </div>
      )}

      {generatedDraft && (
        <div className="space-y-6">
          <div className="p-4 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-700 rounded-md">
            <h3 className="text-lg font-bold text-green-800 dark:text-green-200 mb-2">Generated Listing Draft</h3>
            <div className="space-y-3">
              <div>
                <label htmlFor="editableTitle" className="block text-sm font-medium text-gray-700 dark:text-gray-200">Suggested Title:</label>
                <input
                  type="text"
                  id="editableTitle"
                  className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-100"
                  value={editableTitle}
                  onChange={(e) => setEditableTitle(e.target.value)}
                />
              </div>
              <div>
                <label htmlFor="editableCategory" className="block text-sm font-medium text-gray-700 dark:text-gray-200">Suggested Category:</label>
                <input
                  type="text"
                  id="editableCategory"
                  className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-100"
                  value={editableCategory}
                  onChange={(e) => setEditableCategory(e.target.value)}
                />
              </div>
              <div>
                <label htmlFor="editablePriceRange" className="block text-sm font-medium text-gray-700 dark:text-gray-200">Suggested Price Range:</label>
                <input
                  type="text"
                  id="editablePriceRange"
                  className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-100"
                  value={editablePriceRange}
                  onChange={(e) => setEditablePriceRange(e.target.value)}
                />
              </div>
              <div>
                <label htmlFor="editableCondition" className="block text-sm font-medium text-gray-700 dark:text-gray-200">Suggested Condition:</label>
                <input
                  type="text"
                  id="editableCondition"
                  className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-100"
                  value={editableCondition}
                  onChange={(e) => setEditableCondition(e.target.value)}
                />
              </div>
              <div>
                <label htmlFor="editableDescription" className="block text-sm font-medium text-gray-700 dark:text-gray-200">Item Description:</label>
                <textarea
                  id="editableDescription"
                  rows={6}
                  className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-100"
                  value={editableDescription}
                  onChange={(e) => setEditableDescription(e.target.value)}
                ></textarea>
              </div>
              <button
                onClick={handleSaveEditedListing}
                className="w-full px-4 py-2 bg-purple-600 text-white rounded-md shadow hover:bg-purple-700 transition-colors duration-200 mt-4"
              >
                Save Edited Listing
              </button>
            </div>
          </div>

          {soldListings.length > 0 && (
            <div className="p-4 border border-gray-200 dark:border-gray-700 rounded-md bg-gray-50 dark:bg-gray-700">
              <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100 mb-2">Comparable Sold Listings (Simulated)</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {soldListings.map(item => (
                  <div key={item.itemId} className="flex items-center space-x-3 p-2 border border-gray-200 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800">
                    <img src={item.imageUrl} alt={item.title} className="w-16 h-16 object-cover rounded" />
                    <div>
                      <a href={item.listingUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline font-medium text-sm">
                        {item.title}
                      </a>
                      <p className="text-xs text-gray-600 dark:text-gray-300">Price: {item.price}</p>
                      <p className="text-xs text-gray-600 dark:text-gray-300">Condition: {item.condition}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Sold: {item.soldDate}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {generatedDraft.groundingSources && generatedDraft.groundingSources.length > 0 && (
            <div className="p-4 border border-gray-200 dark:border-gray-700 rounded-md bg-gray-50 dark:bg-gray-700">
              <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100 mb-2">Grounding Sources (from Google Search)</h3>
              <ul className="list-disc pl-5 space-y-1 text-sm text-gray-700 dark:text-gray-200">
                {generatedDraft.groundingSources.map((source, idx) => (
                  <li key={idx}>
                    {source.title ? (
                      <a href={source.uri} target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline">
                        {source.title}
                      </a>
                    ) : (
                      <a href={source.uri} target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline">
                        {source.uri}
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ListingGenerator;