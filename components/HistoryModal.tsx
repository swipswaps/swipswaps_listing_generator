import React, { useState, useEffect } from 'react';
import { ListingDraft } from '../types';
import { databaseService } from '../services/databaseService';

interface HistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const HistoryModal: React.FC<HistoryModalProps> = ({ isOpen, onClose }) => {
  const [listings, setListings] = useState<ListingDraft[]>([]);

  useEffect(() => {
    if (isOpen) {
      setListings(databaseService.loadListings());
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleClearHistory = () => {
    if (window.confirm('Are you sure you want to clear all listing history?')) {
      databaseService.clearListings();
      setListings([]);
    }
  };

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-75 dark:bg-gray-900 dark:bg-opacity-80 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-3xl h-full max-h-[90vh] flex flex-col">
        <div className="flex justify-between items-center mb-4 border-b pb-3 border-gray-200 dark:border-gray-700">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Listing History</h2>
          <button
            onClick={onClose}
            className="text-gray-500 dark:text-gray-300 hover:text-gray-700 dark:hover:text-gray-100 transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {listings.length === 0 ? (
          <p className="text-gray-600 dark:text-gray-300 text-center py-8 flex-grow flex items-center justify-center">No listings in history yet. Generate one!</p>
        ) : (
          <div className="flex-grow overflow-y-auto space-y-6 pr-2">
            {listings.map((listing, index) => (
              <div key={index} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-gray-50 dark:bg-gray-700 shadow-sm">
                <h3 className="font-bold text-gray-800 dark:text-gray-100 text-lg mb-2">{listing.suggestedTitle}</h3>
                {listing.imageUrl && (
                  <div className="mb-3">
                    <img src={listing.imageUrl} alt="Item thumbnail" className="max-h-24 rounded-md shadow-sm" />
                  </div>
                )}
                <p className="text-sm text-gray-700 dark:text-gray-200 mb-1"><strong className="text-gray-900 dark:text-gray-100">Category:</strong> {listing.suggestedCategory}</p>
                <p className="text-sm text-gray-700 dark:text-gray-200 mb-1"><strong className="text-gray-900 dark:text-gray-100">Price Range:</strong> {listing.suggestedPriceRange}</p>
                <p className="text-sm text-gray-700 dark:text-gray-200 mb-1"><strong className="text-gray-900 dark:text-gray-100">Condition:</strong> {listing.suggestedCondition}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">Generated: {listing.generatedDate}</p>
              </div>
            ))}
          </div>
        )}

        <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700 flex justify-end">
          {listings.length > 0 && (
            <button
              onClick={handleClearHistory}
              className="px-4 py-2 text-sm font-medium text-red-700 dark:text-red-200 bg-red-100 dark:bg-red-900 rounded-md hover:bg-red-200 dark:hover:bg-red-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 dark:focus:ring-red-400"
            >
              Clear History
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default HistoryModal;