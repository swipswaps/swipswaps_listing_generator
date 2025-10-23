import React, { useState, useEffect, useCallback } from 'react';
import ImageUploader from './components/ImageUploader';
import ListingGenerator from './components/ListingGenerator';
import SettingsModal from './components/SettingsModal';
import HistoryModal from './components/HistoryModal';
import { geminiService } from './services/geminiService';
import { ebayService } from './services/ebayService'; // Added import
import { chatGptService } from './services/chatGptService'; // Added import
import { databaseService } from './services/databaseService';
import { ApiKeys, ListingDraft } from './types';

const App: React.FC = () => {
  const [selectedBase64Image, setSelectedBase64Image] = useState<string | null>(null);
  const [selectedMimeType, setSelectedMimeType] = useState<string | null>(null);
  const [selectedImageUrl, setSelectedImageUrl] = useState<string | null>(null);
  const [itemDescriptionFromGemini, setItemDescriptionFromGemini] = useState<string | null>(null);
  const [itemCategoryFromGemini, setItemCategoryFromGemini] = useState<string | null>(null);
  const [isLoadingGemini, setIsLoadingGemini] = useState<boolean>(false);
  const [geminiError, setGeminiError] = useState<string | null>(null);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState<boolean>(false);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState<boolean>(false);
  const [apiKeys, setApiKeys] = useState<ApiKeys>(databaseService.loadApiKeys());
  const [currentListing, setCurrentListing] = useState<ListingDraft | null>(null);

  // Dark mode state and persistence
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const savedTheme = localStorage.getItem('theme');
      return savedTheme === 'dark' || (!savedTheme && window.matchMedia('(prefers-color-scheme: dark)').matches);
    }
    return false; // Default to light if not in browser environment
  });

  useEffect(() => {
    // Apply dark class to html element
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [isDarkMode]);

  useEffect(() => {
    // Load API keys on initial render
    setApiKeys(databaseService.loadApiKeys());
  }, []);

  const handleImageSelected = useCallback((base64Image: string, mimeType: string, imageUrl: string) => {
    setSelectedBase64Image(base64Image);
    setSelectedMimeType(mimeType);
    setSelectedImageUrl(imageUrl);
    setItemDescriptionFromGemini(null); // Clear previous description
    setItemCategoryFromGemini(null);
    setCurrentListing(null); // Clear previous listing
    setGeminiError(null);
  }, []);

  const discernItem = useCallback(async () => {
    if (!selectedBase64Image || !selectedMimeType) {
      setGeminiError('Please upload an image first.');
      return;
    }

    setIsLoadingGemini(true);
    setGeminiError(null);
    setItemDescriptionFromGemini(null);
    setItemCategoryFromGemini(null);
    setCurrentListing(null); // Clear listing when re-identifying

    try {
      const result = await geminiService.discernItemFromImage(selectedBase64Image, selectedMimeType);
      const descriptionMatch = result.match(/Item:\s*(.*)\n/);
      const categoryMatch = result.match(/Category:\s*(.*)/);

      if (descriptionMatch && categoryMatch) {
        setItemDescriptionFromGemini(descriptionMatch[1].trim());
        setItemCategoryFromGemini(categoryMatch[1].trim());
      } else {
        setGeminiError('Could not parse Gemini\'s response into description and category.');
        console.error('Gemini response format issue:', result);
      }
    } catch (error) {
      setGeminiError(`Failed to identify item with Gemini: ${error instanceof Error ? error.message : String(error)}`);
      console.error(error);
    } finally {
      setIsLoadingGemini(false);
    }
  }, [selectedBase64Image, selectedMimeType]);

  const handleListingGenerated = useCallback((listing: ListingDraft) => {
    setCurrentListing(listing);
  }, []);

  const handleSaveApiKeys = useCallback((newKeys: ApiKeys) => {
    setApiKeys(newKeys);
    // If an item was already identified, trigger re-generation with new keys
    if (itemDescriptionFromGemini && itemCategoryFromGemini && selectedImageUrl && selectedBase64Image) {
      setCurrentListing(null); // Reset to show loading for new generation
    }
  }, [itemDescriptionFromGemini, itemCategoryFromGemini, selectedImageUrl, selectedBase64Image]);

  return (
    <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-xl w-full max-w-4xl min-h-[80vh] flex flex-col space-y-8 text-gray-900 dark:text-gray-100">
      <header className="flex justify-between items-center pb-4 border-b border-gray-200 dark:border-gray-700">
        <h1 className="text-3xl font-extrabold text-gray-900 dark:text-white">
          <span className="text-purple-600 dark:text-purple-400">Item Scout</span> & Listing Assistant
        </h1>
        <div className="flex space-x-3 items-center">
          <button
            onClick={() => setIsDarkMode(!isDarkMode)}
            className="p-2 rounded-full bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-100 hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors duration-200"
            title={isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          >
            {isDarkMode ? (
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.364-.386l1.591-1.591M3 12H5.25m-.386-6.364l1.591 1.591M12 12a9 9 0 110 18 9 9 0 010-18z" />
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21.752 15.002A9.718 9.718 0 0112 21.75c-3.617 0-6.945-1.847-8.86-4.998V12a9.718 9.718 0 0116.381-7.752M12 7.5V12h4.5" />
              </svg>
            )}
          </button>
          <button
            onClick={() => setIsHistoryModalOpen(true)}
            className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-100 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors duration-200 text-sm font-medium"
            title="View Listing History"
          >
            History
          </button>
          <button
            onClick={() => setIsSettingsModalOpen(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors duration-200 text-sm font-medium"
            title="Manage API Keys"
          >
            Settings
          </button>
        </div>
      </header>

      <section className="grid grid-cols-1 md:grid-cols-2 gap-8 flex-grow">
        <div className="flex flex-col space-y-6">
          <ImageUploader onImageSelected={handleImageSelected} isLoading={isLoadingGemini} />

          <div className="p-4 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm bg-white dark:bg-gray-800">
            <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-100 mb-3">Item Identification</h2>
            <button
              onClick={discernItem}
              disabled={!selectedBase64Image || isLoadingGemini}
              className="w-full px-5 py-2 bg-blue-600 text-white rounded-md shadow hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
            >
              {isLoadingGemini ? 'Identifying...' : 'Identify Item with Gemini'}
            </button>
            {geminiError && (
              <p className="text-red-500 dark:text-red-400 text-sm mt-2">{geminiError}</p>
            )}
            {itemDescriptionFromGemini && (
              <div className="mt-4 p-3 bg-green-50 dark:bg-green-950 text-green-800 dark:text-green-200 border border-green-200 dark:border-green-700 rounded-md">
                <p className="font-medium">Item identified!</p>
                <p className="text-sm">{itemDescriptionFromGemini}</p>
                <p className="text-sm">Category: {itemCategoryFromGemini}</p>
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-col space-y-6">
          {itemDescriptionFromGemini && itemCategoryFromGemini && selectedBase64Image && selectedImageUrl ? (
            <ListingGenerator
              itemDescription={itemDescriptionFromGemini}
              itemCategory={itemCategoryFromGemini}
              base64Image={selectedBase64Image}
              imageUrl={selectedImageUrl}
              ebayApiKey={apiKeys.ebayApiKey}
              chatGptApiKey={apiKeys.chatGptApiKey}
              onListingGenerated={handleListingGenerated}
            />
          ) : (
            <div className="p-4 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 text-center flex-grow flex items-center justify-center">
              <p>Upload an image and identify the item to generate an eBay listing draft.</p>
            </div>
          )}
        </div>
      </section>

      <SettingsModal
        isOpen={isSettingsModalOpen}
        onClose={() => setIsSettingsModalOpen(false)}
        onSave={handleSaveApiKeys}
        currentKeys={apiKeys}
      />

      <HistoryModal
        isOpen={isHistoryModalOpen}
        onClose={() => setIsHistoryModalOpen(false)}
      />
    </div>
  );
};

export default App;