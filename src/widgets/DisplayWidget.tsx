import React from 'react';
import { useBaseWidget } from '../hooks/useBaseWidget';
import { BaseWidgetConfig } from '../types';
import { useWidgetTranslation } from '../hooks/useWidgetTranslation';

/**
 * Display widget for readonly text display
 * Used for displaying information in a card layout
 */
interface DisplayWidgetProps {
  config: BaseWidgetConfig;
}

export const DisplayWidget = ({ config }: DisplayWidgetProps) => {
  const {
    value,
    formattedValue,
    config: widgetConfig,
  } = useBaseWidget({ config });

  const { translateConfig } = useWidgetTranslation();

  // Use formatted value if available, otherwise raw value
  const displayValue = formattedValue !== undefined ? formattedValue : (value || '');
  const label = translateConfig(widgetConfig['widget-label']);

  // If no label, render as paragraph text
  if (!label || label.trim() === '') {
    return (
      <div className="mb-3 text-base text-gray-700">
        {displayValue}
      </div>
    );
  }

  // With label, render as key-value pair
  return (
    <div className="mb-[10px] flex flex-col sm:flex-row sm:items-start">
      <div className="text-base text-gray-600 font-medium md:min-w-[120px] sm:pr-4 mb-1 sm:mb-0" style={{ fontFamily: 'Roboto, sans-serif' }}>
        {label}:
      </div>
      <div className="flex-1 text-base text-gray-900 font-medium">
        {displayValue}
      </div>
    </div>
  );
};
