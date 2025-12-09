import React from 'react';
import { useBaseWidget } from '../hooks/useBaseWidget';
import { BaseWidgetConfig } from '../types';

/**
 * Checkbox widget - supports single checkbox or multiple checkboxes
 * 
 * Usage in schema (single checkbox):
 * {
 *   "widget": "checkbox",
 *   "widget-type": "input",
 *   "widget-label": "I agree to terms",
 *   "widget-id": "agree",
 *   "widget-data-path": "form.agree"
 * }
 * 
 * Usage in schema (multiple checkboxes):
 * {
 *   "widget": "checkbox",
 *   "widget-type": "input",
 *   "widget-label": "Interests",
 *   "widget-id": "interests",
 *   "widget-data-path": "person.interests",
 *   "widget-data-source": {
 *     "type": "static",
 *     "options": [
 *       { "value": "sports", "label": "Sports" },
 *       { "value": "music", "label": "Music" }
 *     ]
 *   }
 * }
 */
export const CheckboxWidget: React.FC<{ config: BaseWidgetConfig }> = ({ config }) => {
  const {
    value,
    error,
    touched,
    isEnabled,
    onChange,
    onBlur,
    dataSourceOptions,
    loading,
    config: widgetConfig,
  } = useBaseWidget({ config });

  const hasDataSource = !!widgetConfig['widget-data-source'];
  const orientation = widgetConfig['widget-orientation'] || 'vertical';

  // Single checkbox (no data source)
  if (!hasDataSource) {
    const isChecked = Boolean(value);
    
    return (
      <div className="mb-4">
        <label className="flex items-center cursor-pointer">
          <input
            type="checkbox"
            checked={isChecked}
            onChange={(e) => onChange(e.target.checked)}
            onBlur={onBlur}
            disabled={!isEnabled || widgetConfig['widget-readonly']}
            className="mr-2 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
          />
          <span className="text-sm font-medium text-gray-700">
            {widgetConfig['widget-label']}
            {widgetConfig['widget-required'] && (
              <span className="text-red-500 ml-1">*</span>
            )}
          </span>
        </label>
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
  }

  // Multiple checkboxes (with data source)
  const selectedValues = Array.isArray(value) ? value : (value ? [value] : []);

  const handleCheckboxChange = (optionValue: string, checked: boolean) => {
    if (checked) {
      onChange([...selectedValues, optionValue]);
    } else {
      onChange(selectedValues.filter((v: string) => v !== optionValue));
    }
  };

  return (
    <div className="mb-4">
      <label className="block text-sm font-medium text-gray-700 mb-2">
        {widgetConfig['widget-label']}
        {widgetConfig['widget-required'] && (
          <span className="text-red-500 ml-1">*</span>
        )}
      </label>
      <div
        className={`flex ${orientation === 'horizontal' ? 'flex-row space-x-4' : 'flex-col space-y-2'}`}
        onBlur={onBlur}
      >
        {loading ? (
          <p className="text-sm text-gray-500">Loading...</p>
        ) : (
          dataSourceOptions.map((option) => (
            <label
              key={option.value}
              className={`flex items-center cursor-pointer ${
                !isEnabled || widgetConfig['widget-readonly'] ? 'opacity-50 cursor-not-allowed' : ''
              }`}
            >
              <input
                type="checkbox"
                value={option.value}
                checked={selectedValues.includes(option.value)}
                onChange={(e) => handleCheckboxChange(option.value, e.target.checked)}
                disabled={!isEnabled || widgetConfig['widget-readonly']}
                className="mr-2 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <span className="text-sm text-gray-700">{option.label}</span>
            </label>
          ))
        )}
      </div>
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
