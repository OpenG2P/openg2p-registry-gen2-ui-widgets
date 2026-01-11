import React from 'react';
import { useBaseWidget } from '../hooks/useBaseWidget';
import { BaseWidgetConfig } from '../types';
import { useWidgetTranslation } from '../hooks/useWidgetTranslation';

/**
 * Select/Dropdown widget with data source support
 * 
 * Usage in schema:
 * {
 *   "widget": "select",
 *   "widget-type": "input",
 *   "widget-label": "Country",
 *   "widget-id": "country",
 *   "widget-data-path": "address.country",
 *   "widget-data-source": {
 *     "type": "static" | "api" | "schema",
 *     ...
 *   }
 * }
 */
interface SelectWidgetProps {
  config: BaseWidgetConfig;
}

export const SelectWidget = ({ config }: SelectWidgetProps) => {
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

  const { translate, translateConfig } = useWidgetTranslation();

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
          <select
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            onBlur={onBlur}
            disabled={!isEnabled || loading || widgetConfig['widget-readonly']}
            className={`w-[180px] h-[30px] px-3 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
              (touched && error.length > 0) || (widgetConfig['widget-required'] && (!value || value === ''))
                ? 'border-red-500 focus:ring-red-500 focus:border-red-500'
                : 'border-gray-300'
            } ${!isEnabled || loading || widgetConfig['widget-readonly'] ? 'bg-gray-100 cursor-not-allowed' : 'bg-white'}`}
            title={translateConfig(widgetConfig['widget-data-tooltip'])}
          >
            <option value="">{translate('common.select')}</option>
            {dataSourceOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          {loading && (
            <p className="text-sm text-gray-500 mt-1">{translate('common.loadingOptions')}</p>
          )}
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
