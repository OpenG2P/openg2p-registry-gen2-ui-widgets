import React from 'react';
import { useBaseWidget } from '../hooks/useBaseWidget';
import { BaseWidgetConfig } from '../types';
import { WidgetRenderer } from '../components/WidgetRenderer';

/**
 * Array widget for simple repeating values
 * 
 * Usage in schema:
 * {
 *   "widget": "array-widget",
 *   "widget-type": "group",
 *   "widget-label": "Skills",
 *   "widget-id": "skills",
 *   "widget-data-path": "person.skills",
 *   "widget-item": {
 *     "widget": "text",
 *     "widget-type": "input",
 *     "widget-label": "Skill"
 *   },
 *   "widget-data-add-label": "Add Skill",
 *   "widget-data-operations": {
 *     "add": true,
 *     "remove": true
 *   }
 * }
 */
export const ArrayWidget: React.FC<{ config: BaseWidgetConfig }> = ({ config }) => {
  const {
    value,
    error,
    touched,
    isEnabled,
    onChange,
    config: widgetConfig,
  } = useBaseWidget({ config });

  const items: any[] = Array.isArray(value) ? value : [];
  const itemConfig = widgetConfig['widget-item'];
  const operations = widgetConfig['widget-data-operations'] || {};
  const addLabel = widgetConfig['widget-data-add-label'] || 'Add Item';
  const isReadonly = widgetConfig['widget-readonly'] || false;

  if (!itemConfig) {
    console.warn('ArrayWidget: widget-item configuration is required');
    return null;
  }

  const addItem = () => {
    const defaultValue = itemConfig['widget-data-default'] || '';
    onChange([...items, defaultValue]);
  };

  const removeItem = (index: number) => {
    const newItems = items.filter((_, i) => i !== index);
    onChange(newItems);
  };

  const updateItem = (index: number, newValue: any) => {
    const newItems = [...items];
    newItems[index] = newValue;
    onChange(newItems);
  };

  return (
    <div className="mb-4">
      <div className="flex justify-between items-center mb-2">
        <label className="block text-sm font-medium text-gray-700">
          {widgetConfig['widget-label']}
          {widgetConfig['widget-required'] && (
            <span className="text-red-500 ml-1">*</span>
          )}
        </label>
        {operations.add && !isReadonly && isEnabled && (
          <button
            type="button"
            onClick={addItem}
            className="px-3 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            {addLabel}
          </button>
        )}
      </div>

      {items.length === 0 ? (
        <div className="text-gray-500 text-sm py-4 text-center border border-gray-300 rounded">
          No items. {operations.add && !isReadonly && `Click "${addLabel}" to add one.`}
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((itemValue, index) => {
            const itemWidgetConfig: BaseWidgetConfig = {
              ...itemConfig,
              'widget-id': `${widgetConfig['widget-id']}-item-${index}`,
              'widget-readonly': isReadonly || !operations.edit,
            };

            return (
              <div
                key={index}
                className="flex items-center gap-2 p-2 border border-gray-300 rounded"
              >
                <div className="flex-1">
                  <input
                    type="text"
                    value={itemValue || ''}
                    onChange={(e) => updateItem(index, e.target.value)}
                    disabled={isReadonly || !operations.edit || !isEnabled}
                    placeholder={itemConfig['widget-data-placeholder'] || itemConfig['widget-label']}
                    className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                {operations.remove && !isReadonly && (
                  <button
                    type="button"
                    onClick={() => removeItem(index)}
                    disabled={!isEnabled}
                    className="px-3 py-2 text-red-600 hover:text-red-800 hover:bg-red-50 rounded"
                  >
                    Remove
                  </button>
                )}
              </div>
            );
          })}
        </div>
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
