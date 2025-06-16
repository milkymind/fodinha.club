import React, { useState } from 'react';

interface BugReportModalProps {
  gameId?: string;
  playerId?: number;
  isOpen: boolean;
  onClose: () => void;
}

interface BugReportData {
  bugDescription: string;
  gameId?: string;
  playerId?: number;
  userAgent: string;
  timestamp: string;
}

const BugReportModal: React.FC<BugReportModalProps> = ({ gameId, playerId, isOpen, onClose }) => {
  const [bugDescription, setBugDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState<'success' | 'error' | ''>('');

  const closeModal = () => {
    onClose();
    setBugDescription('');
    setMessage('');
    setMessageType('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!bugDescription.trim()) {
      setMessage('Bug description is required');
      setMessageType('error');
      return;
    }

    setIsSubmitting(true);
    setMessage('Sending bug report...');
    setMessageType('');

    const bugReportData: BugReportData = {
      bugDescription: bugDescription.trim(),
      gameId,
      playerId,
      userAgent: navigator.userAgent,
      timestamp: new Date().toISOString(),
    };

    try {
      const response = await fetch('/api/report-bug', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(bugReportData),
      });

      if (response.ok) {
        setMessage('Bug report sent successfully! Thank you for helping us improve the game.');
        setMessageType('success');
        
        // Auto-close modal after 2 seconds on success
        setTimeout(() => {
          closeModal();
        }, 2000);
      } else {
        const errorData = await response.json();
        setMessage(errorData.error || 'Failed to send bug report. Please try again.');
        setMessageType('error');
      }
    } catch (error) {
      console.error('Error submitting bug report:', error);
      setMessage('Network error. Please check your connection and try again.');
      setMessageType('error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Don't render anything if modal is not open
  if (!isOpen) {
    return null;
  }

  return (
    <>
      {/* Modal Overlay */}
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
        <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
          {/* Modal Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-200">
            <h2 className="text-xl font-semibold text-gray-900">Report a Bug</h2>
            <button
              onClick={closeModal}
              className="text-gray-400 hover:text-gray-600 transition-colors"
              aria-label="Close modal"
            >
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>

          {/* Modal Body */}
          <form onSubmit={handleSubmit} className="p-6">
            {/* Bug Description Field */}
            <div className="mb-6">
              <label
                htmlFor="bugDescription"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                Bug Description <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                id="bugDescription"
                value={bugDescription}
                onChange={(e) => setBugDescription(e.target.value)}
                placeholder="Briefly describe the issue you encountered..."
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500"
                required
                disabled={isSubmitting}
              />
            </div>

            {/* Message Display Area */}
            {message && (
              <div
                className={`mb-4 p-3 rounded-md text-sm ${
                  messageType === 'success'
                    ? 'bg-green-50 text-green-800 border border-green-200'
                    : messageType === 'error'
                    ? 'bg-red-50 text-red-800 border border-red-200'
                    : 'bg-blue-50 text-blue-800 border border-blue-200'
                }`}
              >
                {message}
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={closeModal}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-500 transition-colors"
                disabled={isSubmitting}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 text-sm font-medium text-white bg-red-500 border border-transparent rounded-md hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                disabled={isSubmitting || !bugDescription.trim()}
              >
                {isSubmitting ? (
                  <span className="flex items-center">
                    <svg
                      className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      ></circle>
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      ></path>
                    </svg>
                    Sending...
                  </span>
                ) : (
                  'Submit Report'
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
};

export default BugReportModal; 