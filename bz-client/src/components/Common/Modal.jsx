import React from 'react';
import { RxCross2 } from 'react-icons/rx';

const Modal = ({ 
  isOpen, 
  onClose, 
  title, 
  children, 
  onConfirm, 
  onCancel,
  confirmText = "Confirm",
  cancelText = "Cancel",
  type = "default" // default, danger, success
}) => {
  if (!isOpen) return null;

  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const getButtonStyles = () => {
    switch (type) {
      case 'danger':
        return {
          confirm: 'bg-red-600 hover:bg-red-700 text-white',
          cancel: 'bg-gray-600 hover:bg-gray-700 text-white'
        };
      case 'success':
        return {
          confirm: 'bg-green-600 hover:bg-green-700 text-white',
          cancel: 'bg-gray-600 hover:bg-gray-700 text-white'
        };
      default:
        return {
          confirm: 'bg-blue-600 hover:bg-blue-700 text-white',
          cancel: 'bg-gray-600 hover:bg-gray-700 text-white'
        };
    }
  };

  const buttonStyles = getButtonStyles();

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
      onClick={handleOverlayClick}
    >
      <div className="bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4 relative">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors"
        >
          <RxCross2 size={20} />
        </button>

        {/* Title */}
        {title && (
          <h2 className="text-xl font-semibold text-white mb-4 pr-8">
            {title}
          </h2>
        )}

        {/* Content */}
        <div className="text-gray-300 mb-6">
          {children}
        </div>

        {/* Action buttons */}
        {(onConfirm || onCancel) && (
          <div className="flex gap-3 justify-end">
            {onCancel && (
              <button
                onClick={onCancel}
                className={`px-4 py-2 rounded-md font-medium transition-colors ${buttonStyles.cancel}`}
              >
                {cancelText}
              </button>
            )}
            {onConfirm && (
              <button
                onClick={onConfirm}
                className={`px-4 py-2 rounded-md font-medium transition-colors ${buttonStyles.confirm}`}
              >
                {confirmText}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default Modal;