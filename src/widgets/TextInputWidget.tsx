import React from 'react';
import { useBaseWidget } from '../hooks/useBaseWidget';
import { BaseWidgetConfig } from '../types';
import { useWidgetTranslation } from '../hooks/useWidgetTranslation';

/**
 * Generic text input widget
 * Supports all text-based inputs via configuration (text, email, password, number, tel, url, etc.)
 * 
 * Usage in schema:
 * {
 *   "widget": "text",
 *   "widget-type": "input",
 *   "widget-label": "Field Label",
 *   "widget-id": "fieldId",
 *   "widget-data-path": "person.name",
 *   "widget-data-format": {
 *     "inputType": "email"  // Optional: "text" | "email" | "password" | "number" | "tel" | "url" | "search"
 *   },
 *   "widget-required": true,
 *   "widget-data-validation": { ... }
 * }
 */
interface TextInputWidgetProps {
  config: BaseWidgetConfig;
}

export const TextInputWidget = ({ config }: TextInputWidgetProps) => {
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

  // Determine input type from configuration or default to 'text'
  const getInputType = () => {
    const inputType = widgetConfig['widget-data-format']?.inputType || 'text';
    // Handle currency as number type
    if (widgetConfig['widget-data-format']?.currency) {
      return 'number';
    }
    return inputType;
  };

  // Handle currency formatting
  const handleCurrencyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (widgetConfig['widget-data-format']?.currency) {
      const inputValue = e.target.value.replace(/[^0-9.]/g, '');
      if (inputValue === '') {
        onChange('');
      } else {
        const numValue = parseFloat(inputValue);
        if (!isNaN(numValue)) {
          onChange(numValue);
        }
      }
    } else {
      onChange(e.target.value);
    }
  };

  // For currency, use raw numeric value; for others, use formatted value if available
  const displayValue = widgetConfig['widget-data-format']?.currency
    ? (typeof value === 'number' ? value : (value ? parseFloat(String(value)) : ''))
    : (formattedValue !== undefined ? formattedValue : (value || ''));

  // For readonly mode, render as display text instead of input
  if (widgetConfig['widget-readonly']) {
    const label = translateConfig(widgetConfig['widget-label']);
    return (
      <div className="mb-3">
        {label && (
          <div className="text-sm text-gray-600 mb-1">
            {label}:
          </div>
        )}
        <div className="text-base text-gray-900 font-medium">
          {displayValue}
        </div>
        {widgetConfig['widget-data-helptext'] && (
          <p className="text-gray-500 text-sm mt-1">
            {translateConfig(widgetConfig['widget-data-helptext'])}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="mb-4">
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {translateConfig(widgetConfig['widget-label'])}
        {widgetConfig['widget-required'] && (
          <span className="text-red-500 ml-1">{translate('common.required')}</span>
        )}
      </label>
      <input
        type={getInputType()}
        value={displayValue}
        onChange={widgetConfig['widget-data-format']?.currency ? handleCurrencyChange : (e) => onChange(e.target.value)}
        onBlur={onBlur}
        disabled={!isEnabled || widgetConfig['widget-readonly']}
        placeholder={translateConfig(widgetConfig['widget-data-placeholder'])}
        inputMode={widgetConfig['widget-data-format']?.currency ? 'decimal' : undefined}
        className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
          touched && error.length > 0
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
  );
};
