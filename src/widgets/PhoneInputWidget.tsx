import React from 'react';
import { useBaseWidget } from '../hooks/useBaseWidget';
import { BaseWidgetConfig } from '../types';
import { useWidgetTranslation } from '../hooks/useWidgetTranslation';

/**
 * Phone input widget with formatting
 * 
 * Usage in schema:
 * {
 *   "widget": "phone",
 *   "widget-type": "input",
 *   "widget-label": "Phone",
 *   "widget-id": "phone",
 *   "widget-data-path": "person.phone",
 *   "widget-data-format": {
 *     "pattern": "(XXX) XXX-XXXX"
 *   }
 * }
 */
interface PhoneInputWidgetProps {
  config: BaseWidgetConfig;
}

export const PhoneInputWidget = ({ config }: PhoneInputWidgetProps) => {
  const {
    value,
    formattedValue,
    error,
    touched,
    isEnabled,
    onChange,
    onBlur,
    config: widgetConfig,
  } = useBaseWidget({ config });

  const { translate, translateConfig } = useWidgetTranslation();

  // Use formatted value if available, otherwise raw value
  const displayValue = formattedValue !== undefined && formattedValue !== value 
    ? formattedValue 
    : (value || '');

  // For readonly mode, render as display text
  if (widgetConfig['widget-readonly']) {
    const label = translateConfig(widgetConfig['widget-label']);
    return (
      <div className="mb-[10px] PhoneDisplayWidget flex items-start">
        {label && (
          <div className="text-base text-gray-600 font-medium min-w-[150px] pr-4" style={{ fontFamily: 'Roboto, sans-serif' }}>
            {label}:
          </div>
        )}
        <div className="flex-1">
          <div className="text-base text-gray-900 font-medium">
            {displayValue || '-'}
          </div>
          {widgetConfig['widget-data-helptext'] && (
            <p className="text-gray-500 text-sm mt-1">
              {translateConfig(widgetConfig['widget-data-helptext'])}
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="mb-[10px]">
      <div className="flex items-start">
        <label className="text-base font-medium text-gray-700 min-w-[150px] pr-4 pt-1" style={{ fontFamily: 'Roboto, sans-serif' }}>
          {translateConfig(widgetConfig['widget-label'])}
          {widgetConfig['widget-required'] && (
            <span className="text-red-500 ml-1">*</span>
          )}
        </label>
        <div className="flex-1">
          <input
            type="tel"
            value={displayValue}
            onChange={(e) => onChange(e.target.value)}
            onBlur={onBlur}
            disabled={!isEnabled || widgetConfig['widget-readonly']}
            placeholder={translateConfig(widgetConfig['widget-data-placeholder'])}
            className={`w-[180px] h-[30px] px-3 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
              (touched && error.length > 0) || (widgetConfig['widget-required'] && (!value || value === ''))
                ? 'border-red-500 focus:ring-red-500 focus:border-red-500'
                : 'border-gray-300'
            } ${!isEnabled || widgetConfig['widget-readonly'] ? 'bg-gray-100 cursor-not-allowed' : 'bg-white'}`}
            title={translateConfig(widgetConfig['widget-data-tooltip'])}
          />
          {touched && error.length > 0 && (
            <p className="text-red-500 text-sm mt-1">{error[0]}</p>
          )}
          {widgetConfig['widget-data-helptext'] && (
            <p className="text-gray-500 text-sm mt-1">
              {translateConfig(widgetConfig['widget-data-helptext'])}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};
