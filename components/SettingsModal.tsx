// Fix: Implement the SettingsModal component to manage API keys.
import React, { useState, useEffect } from 'react';
import { ApiKeys } from '../types';
import { databaseService } from '../services/databaseService';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (keys: ApiKeys) => void;
  currentKeys: ApiKeys;
}

const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose, onSave, currentKeys }) => {
  const [ebayAppId, setEbayAppId] = useState<string>(''); // Renamed from ebayApiKey
  const [chatGptApiKey, setChatGptApiKey] = useState<string>(''); // For the LLM, named chatGptApiKey for consistency

  useEffect(() => {
    if (isOpen) {
      setEbayAppId(currentKeys.ebayAppId); // Use ebayAppId
      setChatGptApiKey(currentKeys.chatGptApiKey);
    }
  }, [isOpen, currentKeys]);

  if (!isOpen) return null;

  const handleSave = () => {
    const newKeys: ApiKeys = { ebayAppId, chatGptApiKey }; // Use ebayAppId
    databaseService.saveApiKeys(newKeys);
    onSave(newKeys); // Propagate saved keys to parent component
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-75 dark:bg-gray-900 dark:bg-opacity-80 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-md">
        <div className="flex justify-between items-center mb-4 border-b pb-3 border-gray-200 dark:border-gray-700">
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

        <div className="space-y-4">
          <div>
            <label htmlFor="ebay-app-id" className="block text-sm font-medium text-gray-700 dark:text-gray-200">
              eBay App ID (Client ID)
            </label>
            <input
              type="text" // App ID is not sensitive like a secret, can be text
              id="ebay-app-id"
              className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-gray-100"
              value={ebayAppId}
              onChange={(e) => setEbayAppId(e.target.value)}
              placeholder="Enter your eBay App ID (Client ID)"
            />
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
              **Important Note for Frontend-Only Apps:** For security reasons, direct, real-time fetching of "Sold Listings" from eBay's API (which requires your `Cert ID`/`Client Secret` and OAuth) is **not securely possible** in a purely frontend application like this. Your `Cert ID (Client Secret)` should **never** be exposed in client-side code.
            </p>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              The `App ID (Client ID)` entered here will *not* make direct API calls. Instead, its presence will enable a more sophisticated and realistic **mock data generation** for "Comparable Sold Listings," which will be intelligently informed by real-time market research conducted by Gemini with Google Search grounding.
            </p>
             <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              (`Dev ID` and `Cert ID`/`Client Secret` are typically used in secure backend integrations.)
            </p>
          </div>

          <div>
            <label htmlFor="chatgpt-api-key" className="block text-sm font-medium text-gray-700 dark:text-gray-200">
              LLM API Key (e.g., ChatGPT/Gemini Pro)
            </label>
            <input
              type="password" // Use password type for API keys
              id="chatgpt-api-key"
              className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-gray-100"
              value={chatGptApiKey}
              onChange={(e) => setChatGptApiKey(e.target.value)}
              placeholder="Enter your LLM API key"
            />
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
              Used for generating listing drafts. (Mocked for this demo or uses fallback if no key.)
            </p>
          </div>
        </div>

        <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700 flex justify-end space-x-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-gray-700 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;