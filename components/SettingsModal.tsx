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
  const [chatGptApiKey, setChatGptApiKey] = useState<string>(currentKeys.chatGptApiKey);
  const [ebayApiKey, setEbayApiKey] = useState<string>(currentKeys.ebayApiKey);

  useEffect(() => {
    // Update state when currentKeys prop changes (e.g., when modal opens with fresh data)
    setChatGptApiKey(currentKeys.chatGptApiKey);
    setEbayApiKey(currentKeys.ebayApiKey);
  }, [currentKeys]);

  if (!isOpen) return null;

  const handleSave = () => {
    const newKeys: ApiKeys = { chatGptApiKey, ebayApiKey };
    databaseService.saveApiKeys(newKeys);
    onSave(newKeys);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-75 dark:bg-gray-900 dark:bg-opacity-80 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-md">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-4">API Key Settings</h2>

        <p className="text-sm text-gray-700 dark:text-gray-300 mb-4">
          Provide your optional API keys for ChatGPT and eBay.
          <br />
          <strong className="text-red-600 dark:text-red-400">Note:</strong> The Gemini API key is loaded automatically from `process.env.API_KEY` and cannot be entered here.
        </p>

        <div className="mb-4">
          <label htmlFor="chatGptApiKey" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            ChatGPT API Key (Optional)
          </label>
          <input
            id="chatGptApiKey"
            type="password"
            value={chatGptApiKey}
            onChange={(e) => setChatGptApiKey(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            placeholder="sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
          />
        </div>

        <div className="mb-6">
          <label htmlFor="ebayApiKey" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            eBay API Key (Optional)
          </label>
          <input
            id="ebayApiKey"
            type="password"
            value={ebayApiKey}
            onChange={(e) => setEbayApiKey(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            placeholder="Your eBay Developer Key"
          />
        </div>

        <div className="flex justify-end space-x-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 bg-gray-200 dark:bg-gray-700 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            Save Keys
          </button>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;