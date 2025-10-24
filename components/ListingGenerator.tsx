import React, { useState, useEffect, useCallback } from 'react';
import { eBayItem, ListingDraft, GroundingSource, ApiKeys } from '../types';
import { chatGptService } from '../services/chatGptService';
import { ebayService } from '../services/ebayService';
import { databaseService } from '../services/databaseService';

interface ListingGeneratorProps {
  itemDescription: string;
  itemCategory: string;
  base64Image: string;
  mimeType: string;
  ebayOAuthToken: string;
  chatGptApiKey: string;
  onListingGenerated: (listing: ListingDraft) => void;
  onUpdateApiKeys: (keys: ApiKeys) => void; // New prop to update API keys in parent
}

const ListingGenerator: React.FC<ListingGeneratorProps> = ({
  itemDescription,
  itemCategory,
  base64Image,
  mimeType,
  ebayOAuthToken,
  chatGptApiKey,
  onListingGenerated,
  onUpdateApiKeys, // Destructure new prop
}) => {
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [listingDraft, setListingDraft] = useState<ListingDraft | null>(null);

  // Local state for eBay credentials when the token is missing
  const [localEbayAppId, setLocalEbayAppId] = useState<string>(() => databaseService.loadApiKeys().ebayAppId);
  const [localEbayClientSecret, setLocalEbayClientSecret] = useState<string>(() => databaseService.loadApiKeys().ebayClientSecret);
  const [localEbayOAuthToken, setLocalEbayOAuthToken] = useState<string>(ebayOAuthToken);
  const [isLoadingLocalToken, setIsLoadingLocalToken] = useState<boolean>(false);
  const [localTokenGenerationError, setLocalTokenGenerationError] = useState<string | null>(null);
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);

  // Keep local token state in sync with prop if it changes externally
  useEffect(() => {
    setLocalEbayOAuthToken(ebayOAuthToken);
  }, [ebayOAuthToken]);

  const generateListing = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    setListingDraft(null);
    setLocalTokenGenerationError(null); // Clear local token error

    if (!ebayOAuthToken && !localEbayOAuthToken) {
      // If no token is available from props or local state, display the input form.
      setIsLoading(false);
      return;
    }
    if (!chatGptApiKey) {
      setError("ChatGPT API Key is missing. Please configure it in Settings to generate listings.");
      setIsLoading(false);
      return;
    }

    try {
      // Use the token from props or the locally generated one
      const tokenToUse = ebayOAuthToken || localEbayOAuthToken;

      // Step 1: Search for sold listings on eBay
      const soldListings: eBayItem[] = await ebayService.searchSoldListings(itemDescription, tokenToUse);

      // Step 2: Get market data from sold listings
      const { marketPriceRange, marketConditionSummary, marketKeywords } = ebayService.getMarketData(soldListings);

      // Step 3: Generate listing draft using ChatGPT
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
        base64Image,
        mimeType,
        marketPriceRange,
        marketConditionSummary,
        marketKeywords,
        groundingSources,
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
  }, [itemDescription, itemCategory, base64Image, mimeType, ebayOAuthToken, localEbayOAuthToken, chatGptApiKey, onListingGenerated]);

  useEffect(() => {
    if (itemDescription && itemCategory && base64Image) {
      // Only call generateListing if a token is present, otherwise show input fields
      if (ebayOAuthToken || localEbayOAuthToken) {
        generateListing();
      } else {
        setIsLoading(false); // Stop loading if token is missing to show inputs
        setError(null); // Clear generic error to show specific input form
      }
    }
  }, [itemDescription, itemCategory, base64Image, mimeType, ebayOAuthToken, localEbayOAuthToken, chatGptApiKey, generateListing]);

  // Handlers for local eBay credential inputs
  const handleLocalChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    if (name === 'localEbayAppId') setLocalEbayAppId(value);
    else if (name === 'localEbayClientSecret') setLocalEbayClientSecret(value);
    else if (name === 'localEbayOAuthToken') setLocalEbayOAuthToken(value);
  };

  const handleGenerateLocalEbayToken = async () => {
    setIsLoadingLocalToken(true);
    setLocalTokenGenerationError(null);
    try {
      const token = await ebayService.generateAccessToken(localEbayAppId, localEbayClientSecret);
      setLocalEbayOAuthToken(token);
      setLocalTokenGenerationError(null); // Clear any previous errors on success
      // Save these locally entered keys immediately so they persist if the user navigates away or closes
      databaseService.saveApiKeys({
        chatGptApiKey, // Keep existing ChatGPT key
        ebayAppId: localEbayAppId,
        ebayClientSecret: localEbayClientSecret,
        ebayOAuthToken: token, // Save the newly generated token
      });
    } catch (err: any) {
      console.error('Failed to generate eBay token locally:', err);
      setLocalTokenGenerationError(`Error generating eBay token: ${err.message || String(err)}`);
    } finally {
      setIsLoadingLocalToken(false);
    }
  };

  const generateCurlCommandContent = useCallback(() => {
    if (!localEbayAppId || !localEbayClientSecret) {
      return 'Please enter your eBay App ID and Client Secret above to generate the curl command.';
    }
    const encodedCredentials = btoa(`${localEbayAppId}:${localEbayClientSecret}`);
    const scope = 'https%3A%2F%2Fapi.ebay.com%2Foauth%2Fapi_scope%2Fbuy.browse'; 
    return `curl -X POST 'https://api.ebay.com/identity/v1/oauth2/token' \\
  -H 'Content-Type: application/x-www-form-urlencoded' \\
  -H 'Authorization: Basic ${encodedCredentials}' \\
  -d 'grant_type=client_credentials&scope=${scope}'`;
  }, [localEbayAppId, localEbayClientSecret]);

  const handleCopyCurlCommand = async () => {
    try {
      await navigator.clipboard.writeText(generateCurlCommandContent());
      setCopyFeedback('Copied!');
      setTimeout(() => setCopyFeedback(null), 2000);
    } catch (err) {
      console.error('Failed to copy text:', err);
      setCopyFeedback('Failed to copy.');
    }
  };

  const handleSaveLocalKeysAndRetry = () => {
    if (!localEbayOAuthToken) {
      setLocalTokenGenerationError("eBay OAuth Access Token is required to proceed.");
      return;
    }
    // Update parent's API keys state
    onUpdateApiKeys({
      chatGptApiKey, // Keep existing ChatGPT key
      ebayAppId: localEbayAppId,
      ebayClientSecret: localEbayClientSecret,
      ebayOAuthToken: localEbayOAuthToken,
    });
    // The useEffect will re-run when ebayOAuthToken prop updates from onUpdateApiKeys.
  };


  if (isLoading) {
    return (
      <div className="p-4 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm bg-white dark:bg-gray-800 text-center flex-grow flex flex-col items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 dark:border-blue-400 mb-3"></div>
        <p className="text-blue-600 dark:text-blue-400 text-lg font-medium">Generating eBay Listing Draft...</p>
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">This may take a moment as we gather market data and craft the description.</p>
      </div>
    );
  }

  // Display credential input form if eBay OAuth token is missing
  if (!ebayOAuthToken && !localEbayOAuthToken) {
    return (
      <div className="p-4 border border-red-300 dark:border-red-600 rounded-lg shadow-sm bg-red-50 dark:bg-red-900 flex-grow flex flex-col">
        <h2 className="text-xl font-semibold text-red-800 dark:text-red-200 mb-3">eBay OAuth Token Missing!</h2>
        <p className="text-red-700 dark:text-red-300 mb-4">
          Please provide your eBay API credentials to fetch market data and generate a listing.
        </p>

        <div className="space-y-4 mb-4">
          <div>
            <label htmlFor="localEbayAppId" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              eBay App ID (Client ID):
            </label>
            <input
              type="text"
              id="localEbayAppId"
              name="localEbayAppId"
              value={localEbayAppId}
              onChange={handleLocalChange}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              placeholder="Your eBay App ID"
            />
          </div>

          <div>
            <label htmlFor="localEbayClientSecret" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              eBay Client Secret (Cert ID):
            </label>
            <input
              type="password"
              id="localEbayClientSecret"
              name="localEbayClientSecret"
              value={localEbayClientSecret}
              onChange={handleLocalChange}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              placeholder="Your eBay Client Secret"
            />
          </div>

          <div className="mt-4">
              <label htmlFor="localEbayOAuthToken" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                eBay OAuth Application Access Token (Bearer Token):
              </label>
              <input
                type="text"
                id="localEbayOAuthToken"
                name="localEbayOAuthToken"
                value={localEbayOAuthToken}
                onChange={handleLocalChange}
                className={`mt-1 block w-full px-3 py-2 border rounded-md shadow-sm sm:text-sm 
                            ${!localEbayOAuthToken
                                ? 'bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-blue-500 focus:border-blue-500 border-gray-300 dark:border-gray-600'
                                : 'bg-gray-100 dark:bg-gray-600 text-gray-900 dark:text-gray-100 cursor-text border-gray-300 dark:border-gray-600'}`}
                placeholder="Token will appear here or can be pasted manually"
              />
              <button
                onClick={handleGenerateLocalEbayToken}
                disabled={isLoadingLocalToken || !localEbayAppId || !localEbayClientSecret}
                className="mt-2 w-full px-4 py-2 bg-purple-600 text-white rounded-md shadow hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isLoadingLocalToken ? 'Generating Token...' : 'Generate eBay Access Token'}
              </button>
              {localTokenGenerationError && (
                <p className="mt-2 text-red-500 dark:text-red-400 text-sm">{localTokenGenerationError}</p>
              )}
            </div>
            <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
              The generated token is typically valid for 2 hours.
            </p>
        </div>

        <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-2">Manual Token Generation (Curl Command)</h3>
          <p className="text-sm text-gray-700 dark:text-gray-200 mb-3">
            You can also generate the token manually using this `curl` command if the above button fails (e.g., due to CORS).
            Then paste the <code>"access_token"</code> from the response into the field above.
          </p>
          <div className="relative">
            <textarea
              readOnly
              value={generateCurlCommandContent()}
              className="w-full max-w-full font-mono text-xs p-2 bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md resize-y overflow-auto text-gray-900 dark:text-gray-100 custom-scrollbar"
              rows={6}
              placeholder="Fill in App ID and Client Secret above to see the curl command."
            />
            <button
              onClick={handleCopyCurlCommand}
              className="absolute top-2 right-2 p-1 px-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
              title="Copy to clipboard"
              disabled={!localEbayAppId || !localEbayClientSecret}
            >
              {copyFeedback || 'Copy'}
            </button>
          </div>
        </div>

        <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700 flex justify-end">
          <button
            onClick={handleSaveLocalKeysAndRetry}
            disabled={!localEbayOAuthToken || isLoadingLocalToken}
            className="px-4 py-2 bg-blue-600 text-white rounded-md shadow hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Save Token & Retry
          </button>
        </div>
      </div>
    );
  }

  // Display generic error if it's not a missing eBay OAuth token error
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
        {listingDraft.base64Image && listingDraft.mimeType && (
          <div className="mb-4 flex justify-center">
            <img src={`data:${listingDraft.mimeType};base64,${listingDraft.base64Image}`} alt="Item for listing" className="max-h-48 rounded-md shadow-md object-contain" />
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