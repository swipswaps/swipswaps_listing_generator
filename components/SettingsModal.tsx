import React, { useState, useEffect, useCallback } from 'react';
import { ApiKeys } from '../types';
import { ebayService } from '../services/ebayService';
import { databaseService } from '../services/databaseService'; // Import databaseService

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (keys: ApiKeys) => void;
  currentKeys: ApiKeys;
}

const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose, onSave, currentKeys }) => {
  const [localKeys, setLocalKeys] = useState<ApiKeys>(currentKeys);
  const [isLoadingToken, setIsLoadingToken] = useState<boolean>(false);
  const [tokenGenerationError, setTokenGenerationError] = useState<string | null>(null);
  const [manualTokenSectionVisible, setManualTokenSectionVisible] = useState(false); // State for manual section visibility
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);

  // Update localKeys when currentKeys prop changes (e.g., when modal opens or parent updates keys)
  useEffect(() => {
    setLocalKeys(currentKeys);
  }, [currentKeys]);

  if (!isOpen) return null;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setLocalKeys(prevKeys => ({ ...prevKeys, [name]: value }));
  };

  const handleGenerateEbayToken = async () => {
    setIsLoadingToken(true);
    setTokenGenerationError(null);
    try {
      const token = await ebayService.generateAccessToken(localKeys.ebayAppId, localKeys.ebayClientSecret);
      setLocalKeys(prevKeys => ({ ...prevKeys, ebayOAuthToken: token }));
      alert('eBay OAuth Token generated successfully!');
      // Also save to localStorage immediately after generation in settings
      databaseService.saveApiKeys({ ...localKeys, ebayOAuthToken: token });
    } catch (error: any) {
      console.error('Failed to generate eBay token:', error);
      setTokenGenerationError(`Error generating eBay token: ${error.message || String(error)}`);
    } finally {
      setIsLoadingToken(false);
    }
  };

  const handleSave = () => {
    onSave(localKeys);
    onClose();
  };

  const generateCurlCommandContent = useCallback(() => {
    if (!localKeys.ebayAppId || !localKeys.ebayClientSecret) {
      return 'Please enter your eBay App ID and Client Secret above to generate the curl command.';
    }
    const encodedCredentials = btoa(`${localKeys.ebayAppId}:${localKeys.ebayClientSecret}`);
    // Using the specific scope for buy.browse API, as used in ebayService.ts
    const scope = 'https%3A%2F%2Fapi.ebay.com%2Foauth%2Fapi_scope%2Fbuy.browse'; 

    return `curl -X POST 'https://api.ebay.com/identity/v1/oauth2/token' \\
  -H 'Content-Type: application/x-www-form-urlencoded' \\
  -H 'Authorization: Basic ${encodedCredentials}' \\
  -d 'grant_type=client_credentials&scope=${scope}'`;
  }, [localKeys.ebayAppId, localKeys.ebayClientSecret]);

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

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-75 dark:bg-gray-900 dark:bg-opacity-80 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-lg flex flex-col max-h-[95vh]">
        <div className="flex justify-between items-center mb-4 border-b pb-3 border-gray-200 dark:border-gray-700 flex-shrink-0">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Settings</h2>
          <button
            onClick={onClose}
            className="text-gray-500 dark:text-gray-300 hover:text-gray-700 dark:hover:text-gray-100 transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="space-y-4 mb-6 flex-grow overflow-y-auto pr-2 custom-scrollbar">
          <div>
            <label htmlFor="chatGptApiKey" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              ChatGPT API Key:
            </label>
            <input
              type="password"
              id="chatGptApiKey"
              name="chatGptApiKey"
              value={localKeys.chatGptApiKey}
              onChange={handleChange}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              placeholder="sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
            />
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Get your key from{' '}
              <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline">
                OpenAI Platform
              </a>.
            </p>
          </div>

          <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-2">eBay API Settings (for market data)</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
              To fetch sold listing data from eBay, you need to provide your eBay App ID (Client ID) and Client Secret to generate an OAuth Application Access Token.
              <br/>
              Get your keys from{' '}
              <a href="https://developer.ebay.com/my/keys" target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline">
                eBay Developer Program
              </a>.
            </p>

            <div>
              <label htmlFor="ebayAppId" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                eBay App ID (Client ID):
              </label>
              <input
                type="text"
                id="ebayAppId"
                name="ebayAppId"
                value={localKeys.ebayAppId}
                onChange={handleChange}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                placeholder="Your eBay App ID"
              />
            </div>

            <div className="mt-4">
              <label htmlFor="ebayClientSecret" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                eBay Client Secret:
              </label>
              <input
                type="password"
                id="ebayClientSecret"
                name="ebayClientSecret"
                value={localKeys.ebayClientSecret}
                onChange={handleChange}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                placeholder="Your eBay Client Secret"
              />
            </div>

            <div className="mt-4">
              <label htmlFor="ebayOAuthToken" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                eBay OAuth Application Access Token (Bearer Token):
              </label>
              <input
                type="text" // Changed to text for easier pasting
                id="ebayOAuthToken"
                name="ebayOAuthToken"
                value={localKeys.ebayOAuthToken}
                onChange={handleChange}
                // Editable when empty or when there's a token generation error, otherwise read-only
                readOnly={!!localKeys.ebayOAuthToken && !tokenGenerationError} 
                className={`mt-1 block w-full px-3 py-2 border rounded-md shadow-sm sm:text-sm 
                            ${!!localKeys.ebayOAuthToken && !tokenGenerationError
                                ? 'bg-gray-100 dark:bg-gray-600 text-gray-900 dark:text-gray-100 cursor-not-allowed border-gray-300 dark:border-gray-600'
                                : 'bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-blue-500 focus:border-blue-500 border-gray-300 dark:border-gray-600'}`}
                placeholder="Token will appear here or can be pasted manually"
              />
              <button
                onClick={handleGenerateEbayToken}
                disabled={isLoadingToken || !localKeys.ebayAppId || !localKeys.ebayClientSecret}
                className="mt-2 w-full px-4 py-2 bg-purple-600 text-white rounded-md shadow hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isLoadingToken ? 'Generating Token...' : 'Generate eBay Access Token'}
              </button>
              {tokenGenerationError && (
                <p className="mt-2 text-red-500 dark:text-red-400 text-sm">{tokenGenerationError}</p>
              )}
            </div>
            <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
              The generated token is typically valid for 2 hours. You may need to regenerate it for extended sessions.
            </p>

            {/* Alternative: Manually Generate Token Section */}
            <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
              <button
                onClick={() => setManualTokenSectionVisible(!manualTokenSectionVisible)}
                className="flex items-center text-blue-600 dark:text-blue-400 hover:underline text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 rounded-md p-1 -ml-1"
                aria-expanded={manualTokenSectionVisible}
                aria-controls="manual-token-section"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth="1.5"
                  stroke="currentColor"
                  className={`w-4 h-4 mr-2 transition-transform duration-200 ${manualTokenSectionVisible ? 'rotate-90' : ''}`}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                </svg>
                Alternative: Manually Generate Token (for CORS issues)
              </button>

              {manualTokenSectionVisible && (
                <div id="manual-token-section" className="mt-4 p-4 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-md space-y-3">
                  <p className="text-sm text-gray-700 dark:text-gray-200">
                    If the "Generate eBay Access Token" button fails (e.g., due to browser CORS issues during local development),
                    you can generate the token manually using the `curl` command below.
                  </p>
                  <p className="text-sm font-medium text-gray-800 dark:text-gray-100">
                    <span className="font-bold">Step 1:</span> Copy the command below (requires App ID and Client Secret to be filled).
                  </p>
                  <div className="relative">
                    <textarea
                      readOnly
                      value={generateCurlCommandContent()}
                      className="w-full max-w-full font-mono text-xs p-2 bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md resize-y overflow-auto text-gray-900 dark:text-gray-100 custom-scrollbar"
                      rows={10} // Ensure enough rows to prevent truncation
                      placeholder="Fill in App ID and Client Secret above to see the curl command."
                    />
                    <button
                      onClick={handleCopyCurlCommand}
                      className="absolute top-2 right-2 p-1 px-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
                      title="Copy to clipboard"
                      disabled={!localKeys.ebayAppId || !localKeys.ebayClientSecret}
                    >
                      {copyFeedback || 'Copy'}
                    </button>
                  </div>
                  <p className="text-sm font-medium text-gray-800 dark:text-gray-100">
                    <span className="font-bold">Step 2:</span> Run the command in your terminal.
                  </p>
                  <p className="text-sm text-gray-700 dark:text-gray-200">
                    Look for the <code>"access_token"</code> value in the JSON response.
                  </p>
                  <p className="text-sm font-medium text-gray-800 dark:text-gray-100">
                    <span className="font-bold">Step 3:</span> Paste the <code>"access_token"</code> into the "eBay OAuth Application Access Token (Bearer Token)" field above.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700 flex justify-end space-x-3 flex-shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-100 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 bg-blue-600 text-white rounded-md shadow hover:bg-blue-700 transition-colors"
          >
            Save Settings
          </button>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;