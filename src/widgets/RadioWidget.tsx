import React from 'react';
import { useBaseWidget } from '../hooks/useBaseWidget';
import { BaseWidgetConfig } from '../types';

/**
 * Radio button widget
 * 
 * Usage in schema:
 * {
 *   "widget": "radio",
 *   "widget-type": "input",
 *   "widget-label": "Gender",
 *   "widget-id": "gender",
 *   "widget-data-path": "person.gender",
 *   "widget-data-source": {
 *     "type": "static",
 *     "options": [
 *       { "value": "male", "label": "Male" },
 *       { "value": "female", "label": "Female" }
 *     ]
 *   }
 * }
 */
interface RadioWidgetProps {
  config: BaseWidgetConfig;
}

export const RadioWidget = ({ config }: RadioWidgetProps) => {
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

  const orientation = widgetConfig['widget-orientation'] || 'vertical';

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
                type="radio"
                name={widgetConfig['widget-id']}
                value={option.value}
                checked={value === option.value}
                onChange={(e) => onChange(e.target.value)}
                disabled={!isEnabled || widgetConfig['widget-readonly']}
                className="mr-2 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
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
