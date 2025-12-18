import React from 'react';
import { useBaseWidget } from '../hooks/useBaseWidget';
import { BaseWidgetConfig } from '../types';
import { useWidgetTranslation } from '../hooks/useWidgetTranslation';

/**
 * File input widget
 * 
 * Usage in schema:
 * {
 *   "widget": "file",
 *   "widget-type": "input",
 *   "widget-label": "Upload Document",
 *   "widget-id": "document",
 *   "widget-data-path": "form.document",
 *   "widget-data-options": {
 *     "accept": ".pdf,.doc,.docx",
 *     "multiple": false,
 *     "maxSize": 5242880  // 5MB in bytes
 *   }
 * }
 */
interface FileInputWidgetProps {
  config: BaseWidgetConfig;
}

export const FileInputWidget = ({ config }: FileInputWidgetProps) => {
  const {
    value,
    error,
    touched,
    isEnabled,
    onChange,
    onBlur,
    config: widgetConfig,
  } = useBaseWidget({ config });

  const { translate, translateConfig } = useWidgetTranslation();

  const accept = widgetConfig['widget-data-options']?.accept;
  const multiple = widgetConfig['widget-data-options']?.multiple || false;
  const maxSize = widgetConfig['widget-data-options']?.maxSize;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) {
      onChange(null);
      return;
    }

    // Validate file size if specified
    if (maxSize) {
      for (let i = 0; i < files.length; i++) {
        if (files[i].size > maxSize) {
          // You might want to show an error here
          console.error(`File ${files[i].name} exceeds maximum size of ${maxSize} bytes`);
          return;
        }
      }
    }

    if (multiple) {
      onChange(Array.from(files));
    } else {
      onChange(files[0]);
    }
  };

  const displayValue = value
    ? multiple
      ? Array.isArray(value)
        ? value.map((f: File) => f.name).join(', ')
        : ''
      : value instanceof File
      ? value.name
      : String(value)
    : '';

  return (
    <div className="mb-4">
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {translateConfig(widgetConfig['widget-label'])}
        {widgetConfig['widget-required'] && (
          <span className="text-red-500 ml-1">{translate('common.required')}</span>
        )}
      </label>
      <div className="flex items-center space-x-4">
        <label
          className={`cursor-pointer inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 ${
            !isEnabled || widgetConfig['widget-readonly']
              ? 'opacity-50 cursor-not-allowed'
              : ''
          }`}
        >
          <span>{multiple ? translate('common.chooseFiles') : translate('common.chooseFile')}</span>
          <input
            type="file"
            accept={accept}
            multiple={multiple}
            onChange={handleFileChange}
            onBlur={onBlur}
            disabled={!isEnabled || widgetConfig['widget-readonly']}
            className="hidden"
          />
        </label>
        {displayValue && (
          <span className="text-sm text-gray-600">{displayValue}</span>
        )}
      </div>
      {touched && error.length > 0 && (
        <p className="text-red-500 text-sm mt-1">{error[0]}</p>
      )}
      {widgetConfig['widget-data-helptext'] && (
        <p className="text-gray-500 text-sm mt-1">
          {translateConfig(widgetConfig['widget-data-helptext'])}
        </p>
      )}
      {maxSize && (
        <p className="text-gray-400 text-xs mt-1">
          {translate('common.maxFileSize', { size: (maxSize / 1024 / 1024).toFixed(2) })}
        </p>
      )}
    </div>
  );
};
