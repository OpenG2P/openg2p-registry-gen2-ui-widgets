import React from 'react';
import { useBaseWidget } from '../hooks/useBaseWidget';
import { BaseWidgetConfig } from '../types';

/**
 * Date input widget
 * 
 * Usage in schema:
 * {
 *   "widget": "date",
 *   "widget-type": "input",
 *   "widget-label": "Date of Birth",
 *   "widget-id": "dob",
 *   "widget-data-path": "person.dob",
 *   "widget-data-format": {
 *     "dateFormat": "DD/MM/YYYY"
 *   }
 * }
 */
interface DateInputWidgetProps {
  config: BaseWidgetConfig;
}

export const DateInputWidget = ({ config }: DateInputWidgetProps) => {
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

  // Convert value to date input format (YYYY-MM-DD)
  const getDateValue = () => {
    if (!value) return '';
    if (typeof value === 'string') {
      // Try to parse the date string
      const date = new Date(value);
      if (!isNaN(date.getTime())) {
        return date.toISOString().split('T')[0];
      }
      return value;
    }
    if (value instanceof Date) {
      return value.toISOString().split('T')[0];
    }
    return '';
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const dateValue = e.target.value;
    if (dateValue) {
      onChange(new Date(dateValue).toISOString());
    } else {
      onChange('');
    }
  };

  return (
    <div className="mb-4">
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {widgetConfig['widget-label']}
        {widgetConfig['widget-required'] && (
          <span className="text-red-500 ml-1">*</span>
        )}
      </label>
      <input
        type="date"
        value={getDateValue()}
        onChange={handleChange}
        onBlur={onBlur}
        disabled={!isEnabled || widgetConfig['widget-readonly']}
        min={widgetConfig['widget-data-options']?.minDate}
        max={widgetConfig['widget-data-options']?.maxDate === 'today' 
          ? new Date().toISOString().split('T')[0]
          : widgetConfig['widget-data-options']?.maxDate}
        className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
          touched && error.length > 0
            ? 'border-red-500 focus:ring-red-500 focus:border-red-500'
            : 'border-gray-300'
        } ${!isEnabled || widgetConfig['widget-readonly'] ? 'bg-gray-100 cursor-not-allowed' : 'bg-white'}`}
        title={widgetConfig['widget-data-tooltip']}
      />
      {formattedValue && formattedValue !== value && (
        <p className="text-gray-500 text-sm mt-1">Formatted: {formattedValue}</p>
      )}
      {touched && error.length > 0 && (
        <p className="text-red-500 text-sm mt-1">{error[0]}</p>
      )}
      {widgetConfig['widget-data-helptext'] && (
        <p className="text-gray-500 text-sm mt-1">
          {widgetConfig['widget-data-helptext']}
        </p>
      )}
    </div>
  );
};
