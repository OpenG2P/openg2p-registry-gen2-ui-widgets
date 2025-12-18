import React from 'react';
import { useBaseWidget } from '../hooks/useBaseWidget';
import { BaseWidgetConfig } from '../types';
import { useWidgetTranslation } from '../hooks/useWidgetTranslation';

/**
 * Currency input widget with formatting
 * 
 * Usage in schema:
 * {
 *   "widget": "currency",
 *   "widget-type": "input",
 *   "widget-label": "Salary",
 *   "widget-id": "salary",
 *   "widget-data-path": "person.salary",
 *   "widget-data-format": {
 *     "currency": "USD",
 *     "locale": "en-US",
 *     "decimals": 2
 *   }
 * }
 */
interface CurrencyInputWidgetProps {
  config: BaseWidgetConfig;
}

export const CurrencyInputWidget = ({ config }: CurrencyInputWidgetProps) => {
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

  // For input, use raw numeric value; formatted value is for display only
  const numericValue = typeof value === 'number' ? value : (value ? parseFloat(String(value)) : '');

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputValue = e.target.value.replace(/[^0-9.]/g, '');
    if (inputValue === '') {
      onChange('');
    } else {
      const numValue = parseFloat(inputValue);
      if (!isNaN(numValue)) {
        onChange(numValue);
      }
    }
  };

  return (
    <div className="mb-4">
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {translateConfig(widgetConfig['widget-label'])}
        {widgetConfig['widget-required'] && (
          <span className="text-red-500 ml-1">{translate('common.required')}</span>
        )}
      </label>
      <div className="relative">
        <input
          type="text"
          inputMode="decimal"
          value={numericValue}
          onChange={handleChange}
          onBlur={onBlur}
          disabled={!isEnabled || widgetConfig['widget-readonly']}
          placeholder={translateConfig(widgetConfig['widget-data-placeholder'])}
          className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
            touched && error.length > 0
              ? 'border-red-500 focus:ring-red-500 focus:border-red-500'
              : 'border-gray-300'
          } ${!isEnabled || widgetConfig['widget-readonly'] ? 'bg-gray-100 cursor-not-allowed' : 'bg-white'}`}
          title={translateConfig(widgetConfig['widget-data-tooltip'])}
        />
        {formattedValue && formattedValue !== String(value) && (
          <span className="absolute right-3 top-2 text-gray-500 text-sm">
            {formattedValue}
          </span>
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
    </div>
  );
};
