import React, { useState } from 'react';
import { useBaseWidget } from '../hooks/useBaseWidget';
import { BaseWidgetConfig } from '../types';
import { WidgetRenderer } from '../components/WidgetRenderer';

/**
 * Simple table widget for structured data
 * 
 * Usage in schema:
 * {
 *   "widget": "simple-table",
 *   "widget-type": "table",
 *   "widget-label": "Education History",
 *   "widget-id": "educationHistory",
 *   "widget-data-path": "education.history",
 *   "widget-data-columns": [
 *     {
 *       "column-key": "degree",
 *       "widget-label": "Degree",
 *       "widget": "text",
 *       "widget-data-path": "degree"
 *     }
 *   ],
 *   "widget-data-operations": {
 *     "add": true,
 *     "remove": true,
 *     "edit": true
 *   }
 * }
 */
export const SimpleTableWidget: React.FC<{ config: BaseWidgetConfig }> = ({ config }) => {
  const {
    value,
    error,
    touched,
    isEnabled,
    onChange,
    config: widgetConfig,
  } = useBaseWidget({ config });

  const rows: any[] = Array.isArray(value) ? value : [];
  const columns = widgetConfig['widget-data-columns'] || [];
  const operations = widgetConfig['widget-data-operations'] || {};
  const isReadonly = widgetConfig['widget-readonly'] || false;

  const addRow = () => {
    const newRow: Record<string, any> = {};
    columns.forEach((col) => {
      newRow[col['column-key']] = '';
    });
    onChange([...rows, newRow]);
  };

  const removeRow = (index: number) => {
    const newRows = rows.filter((_, i) => i !== index);
    onChange(newRows);
  };

  const updateCell = (rowIndex: number, columnKey: string, newValue: any) => {
    const newRows = [...rows];
    if (!newRows[rowIndex]) {
      newRows[rowIndex] = {};
    }
    newRows[rowIndex][columnKey] = newValue;
    onChange(newRows);
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
            onClick={addRow}
            className="px-3 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            Add Row
          </button>
        )}
      </div>
      
      {rows.length === 0 ? (
        <div className="text-gray-500 text-sm py-4 text-center border border-gray-300 rounded">
          No data. {operations.add && !isReadonly && 'Click "Add Row" to add an entry.'}
        </div>
      ) : (
        <div className="overflow-x-auto border border-gray-300 rounded">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                {columns.map((col) => (
                  <th
                    key={col['column-key']}
                    className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                  >
                    {col['widget-label']}
                  </th>
                ))}
                {operations.remove && !isReadonly && (
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {rows.map((row, rowIndex) => (
                <tr key={rowIndex}>
                  {columns.map((col) => {
                    const columnKey = col['column-key'];
                    const cellValue = row[columnKey];
                    
                    // Create a widget config for the cell
                    const widgetType = col['widget-type'];
                    const validWidgetType: 'input' | 'layout' | 'table' | 'group' = 
                      (widgetType === 'input' || widgetType === 'layout' || widgetType === 'table' || widgetType === 'group')
                        ? widgetType
                        : 'input';
                    
                    const cellConfig: BaseWidgetConfig = {
                      widget: col.widget || 'text',
                      'widget-type': validWidgetType,
                      'widget-id': `${widgetConfig['widget-id']}-row-${rowIndex}-col-${columnKey}`,
                      'widget-data-path': col['widget-data-path'],
                      'widget-label': '',
                      'widget-readonly': isReadonly || !operations.edit,
                    };

                    return (
                      <td key={columnKey} className="px-4 py-3 whitespace-nowrap">
                        <input
                          type="text"
                          value={cellValue || ''}
                          onChange={(e) => updateCell(rowIndex, columnKey, e.target.value)}
                          disabled={isReadonly || !operations.edit || !isEnabled}
                          className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                        />
                      </td>
                    );
                  })}
                  {operations.remove && !isReadonly && (
                    <td className="px-4 py-3 whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => removeRow(rowIndex)}
                        disabled={!isEnabled}
                        className="text-red-600 hover:text-red-800 text-sm"
                      >
                        Remove
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
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
