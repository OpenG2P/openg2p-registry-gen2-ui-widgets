import React, { useMemo, useCallback } from 'react';
import { useBaseWidget } from '../hooks/useBaseWidget';
import { BaseWidgetConfig, BooleanRepresentation, BooleanControlType } from '../types';
import { useWidgetTranslation } from '../hooks/useWidgetTranslation';

/**
 * Boolean widget with advanced features
 * 
 * Features:
 * - Boolean representation (true/false, yes/no, on/off, custom labels)
 * - Control type (checkbox, radio buttons, toggle/switch)
 * - Default value (true, false, unset/null)
 * - Required vs optional
 * - Layout options (horizontal/vertical)
 * 
 * Usage in schema:
 * {
 *   "widget": "boolean",
 *   "widget-type": "input",
 *   "widget-label": "Is Married",
 *   "widget-id": "married",
 *   "widget-data-path": "person.married",
 *   "widget-data-default": false,
 *   "widget-data-format": {
 *     "booleanRepresentation": "yes-no",
 *     "booleanControlType": "radio",
 *     "allowUnset": true
 *   },
 *   "widget-data-validation": {},
 *   "widget-required": false,
 *   "widget-orientation": "horizontal"
 * }
 */
interface BooleanWidgetProps {
  config: BaseWidgetConfig;
}

export const BooleanWidget = ({ config }: BooleanWidgetProps) => {
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

  const formatConfig = widgetConfig['widget-data-format'];
  const representation = formatConfig?.booleanRepresentation || 'true-false';
  const controlType = formatConfig?.booleanControlType || 'checkbox';
  const allowUnset = formatConfig?.allowUnset ?? (widgetConfig['widget-required'] ? false : true);
  const orientation = widgetConfig['widget-orientation'] || 'horizontal';

  // Get labels based on representation
  const getLabels = useCallback((): { trueLabel: string; falseLabel: string } => {
    if (representation === 'custom') {
      return {
        trueLabel: translateConfig(formatConfig?.booleanTrueLabel || 'Yes'),
        falseLabel: translateConfig(formatConfig?.booleanFalseLabel || 'No'),
      };
    }

    const labels: Record<BooleanRepresentation, { trueLabel: string; falseLabel: string }> = {
      'true-false': { trueLabel: 'True', falseLabel: 'False' },
      'yes-no': { trueLabel: 'Yes', falseLabel: 'No' },
      'on-off': { trueLabel: 'On', falseLabel: 'Off' },
      'custom': { trueLabel: 'Yes', falseLabel: 'No' }, // Fallback
    };

    return labels[representation];
  }, [representation, formatConfig, translateConfig]);

  const { trueLabel, falseLabel } = getLabels();

  // Determine current value (handle null/undefined)
  const currentValue = useMemo(() => {
    if (value === null || value === undefined) {
      return null;
    }
    return Boolean(value);
  }, [value]);

  // Handle value change
  const handleChange = useCallback((newValue: boolean | null) => {
    onChange(newValue);
  }, [onChange]);

  // Handle checkbox change
  const handleCheckboxChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const checked = e.target.checked;
    if (allowUnset && !checked && currentValue === true) {
      // If allowUnset and unchecking, set to null
      handleChange(null);
    } else {
      handleChange(checked);
    }
  }, [allowUnset, currentValue, handleChange]);

  // Handle radio change
  const handleRadioChange = useCallback((selectedValue: boolean | null) => {
    handleChange(selectedValue);
  }, [handleChange]);

  // For readonly mode, render as display text
  if (widgetConfig['widget-readonly']) {
    const label = translateConfig(widgetConfig['widget-label']);
    let displayValue = '';
    
    if (currentValue === null) {
      displayValue = '-';
    } else if (currentValue === true) {
      displayValue = trueLabel;
    } else {
      displayValue = falseLabel;
    }

    return (
      <div className="mb-[10px] BooleanDisplayWidget flex flex-col sm:flex-row sm:items-start">
        {label && (
          <div className="text-base text-gray-600 font-medium md:min-w-[120px] sm:pr-4 mb-1 sm:mb-0" style={{ fontFamily: 'Roboto, sans-serif' }}>
            {label}:
          </div>
        )}
        <div className="flex-1">
          <div className="text-base text-gray-900 font-medium">
            {displayValue}
          </div>
          {/* {widgetConfig['widget-data-helptext'] && (
            <p className="text-gray-500 text-sm mt-1">
              {translateConfig(widgetConfig['widget-data-helptext'])}
            </p>
          )} */}
        </div>
      </div>
    );
  }

  // Render based on control type
  if (controlType === 'checkbox') {
    return (
      <div className="mb-[10px]">
        <div className="flex flex-col sm:flex-row sm:items-start">
          <label className="text-base font-medium text-gray-700 md:min-w-[120px] sm:pr-4 sm:pt-1 mb-1 sm:mb-0" style={{ fontFamily: 'Roboto, sans-serif' }}>
            {translateConfig(widgetConfig['widget-label'])}
            {widgetConfig['widget-required'] && (
              <span className="text-red-500 ml-1">*</span>
            )}
          </label>
          <div className="flex-1 min-w-0">
            <label className="flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={currentValue === true}
                onChange={handleCheckboxChange}
                onBlur={onBlur}
                disabled={!isEnabled || widgetConfig['widget-readonly']}
                className="mr-2 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <span className="text-sm text-gray-700">
                {currentValue === true ? trueLabel : (currentValue === false ? falseLabel : '-')}
              </span>
            </label>
            {touched && error.length > 0 && (
              <p className="text-red-500 text-sm mt-1">{error[0]}</p>
            )}
            {/* {widgetConfig['widget-data-helptext'] && (
              <p className="text-gray-500 text-sm mt-1">
                {translateConfig(widgetConfig['widget-data-helptext'])}
              </p>
            )} */}
          </div>
        </div>
      </div>
    );
  }

  if (controlType === 'radio') {
    const containerClass = orientation === 'horizontal' 
      ? 'flex flex-row space-x-4' 
      : 'flex flex-col space-y-2';

    return (
      <div className="mb-[10px]">
        <div className="flex flex-col sm:flex-row sm:items-start">
          <label className="text-base font-medium text-gray-700 md:min-w-[120px] sm:pr-4 sm:pt-1 mb-1 sm:mb-0" style={{ fontFamily: 'Roboto, sans-serif' }}>
            {translateConfig(widgetConfig['widget-label'])}
            {widgetConfig['widget-required'] && (
              <span className="text-red-500 ml-1">*</span>
            )}
          </label>
          <div className="flex-1 min-w-0">
            <div className={containerClass} onBlur={onBlur}>
              {allowUnset && (
                <label className={`flex items-center cursor-pointer ${
                  !isEnabled || widgetConfig['widget-readonly'] ? 'opacity-50 cursor-not-allowed' : ''
                }`}>
                  <input
                    type="radio"
                    name={widgetConfig['widget-id']}
                    checked={currentValue === null}
                    onChange={() => handleRadioChange(null)}
                    disabled={!isEnabled || widgetConfig['widget-readonly']}
                    className="mr-2 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                  />
                  <span className="text-sm text-gray-700">-</span>
                </label>
              )}
              <label className={`flex items-center cursor-pointer ${
                !isEnabled || widgetConfig['widget-readonly'] ? 'opacity-50 cursor-not-allowed' : ''
              }`}>
                <input
                  type="radio"
                  name={widgetConfig['widget-id']}
                  checked={currentValue === true}
                  onChange={() => handleRadioChange(true)}
                  disabled={!isEnabled || widgetConfig['widget-readonly']}
                  className="mr-2 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                />
                <span className="text-sm text-gray-700">{trueLabel}</span>
              </label>
              <label className={`flex items-center cursor-pointer ${
                !isEnabled || widgetConfig['widget-readonly'] ? 'opacity-50 cursor-not-allowed' : ''
              }`}>
                <input
                  type="radio"
                  name={widgetConfig['widget-id']}
                  checked={currentValue === false}
                  onChange={() => handleRadioChange(false)}
                  disabled={!isEnabled || widgetConfig['widget-readonly']}
                  className="mr-2 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                />
                <span className="text-sm text-gray-700">{falseLabel}</span>
              </label>
            </div>
            {touched && error.length > 0 && (
              <p className="text-red-500 text-sm mt-1">{error[0]}</p>
            )}
            {/* {widgetConfig['widget-data-helptext'] && (
              <p className="text-gray-500 text-sm mt-1">
                {translateConfig(widgetConfig['widget-data-helptext'])}
              </p>
            )} */}
          </div>
        </div>
      </div>
    );
  }

  // Toggle/switch control type
  return (
    <div className="mb-[10px]">
      <div className="flex flex-col sm:flex-row sm:items-start">
        <label className="text-base font-medium text-gray-700 sm:min-w-[150px] sm:pr-4 sm:pt-1 mb-1 sm:mb-0" style={{ fontFamily: 'Roboto, sans-serif' }}>
          {translateConfig(widgetConfig['widget-label'])}
          {widgetConfig['widget-required'] && (
            <span className="text-red-500 ml-1">*</span>
          )}
        </label>
        <div className="flex-1 min-w-0">
          <div className="flex items-center space-x-3" onBlur={onBlur}>
            {allowUnset && (
              <button
                type="button"
                onClick={() => handleChange(null)}
                disabled={!isEnabled || widgetConfig['widget-readonly']}
                className={`px-3 py-1 text-sm border ${
                  currentValue === null
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-gray-700 border-gray-300'
                } ${!isEnabled || widgetConfig['widget-readonly'] ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-50'}`}
                style={{ borderRadius: '15px' }}
              >
                -
              </button>
            )}
            <button
              type="button"
              onClick={() => handleChange(true)}
              disabled={!isEnabled || widgetConfig['widget-readonly']}
              className={`px-3 py-1 text-sm border ${
                currentValue === true
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-gray-700 border-gray-300'
              } ${!isEnabled || widgetConfig['widget-readonly'] ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-50'}`}
              style={{ borderRadius: '15px' }}
            >
              {trueLabel}
            </button>
            <button
              type="button"
              onClick={() => handleChange(false)}
              disabled={!isEnabled || widgetConfig['widget-readonly']}
              className={`px-3 py-1 text-sm border ${
                currentValue === false
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-gray-700 border-gray-300'
              } ${!isEnabled || widgetConfig['widget-readonly'] ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-50'}`}
              style={{ borderRadius: '15px' }}
            >
              {falseLabel}
            </button>
          </div>
          {touched && error.length > 0 && (
            <p className="text-red-500 text-sm mt-1">{error[0]}</p>
          )}
          {/* {widgetConfig['widget-data-helptext'] && (
            <p className="text-gray-500 text-sm mt-1">
              {translateConfig(widgetConfig['widget-data-helptext'])}
            </p>
          )} */}
        </div>
      </div>
    </div>
  );
};
