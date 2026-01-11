import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { useBaseWidget } from '../hooks/useBaseWidget';
import { BaseWidgetConfig } from '../types';
import { WidgetRenderer } from '../components/WidgetRenderer';
import { useWidgetTranslation } from '../hooks/useWidgetTranslation';
import { useWidgetContext } from '../components/WidgetProvider';
import { formatValue } from '../utils/formatting';
import { getValueByPath, setValueByPath } from '../utils/pathUtils';
import { setValue, resetWidget } from '../store/widgetSlice';

/**
 * Table widget with record-level inline editing
 * 
 * Usage in schema:
 * {
 *   "widget": "table",
 *   "widget-type": "table",
 *   "widget-label": "Education History",
 *   "widget-id": "educationHistory",
 *   "widget-data-path": "education.history",
 *   "widget-data-columns": [
 *     {
 *       "column-key": "degree",
 *       "widget-label": "Degree",
 *       "widget": "text",
 *       "widget-type": "input",
 *       "widget-data-path": "degree",
 *       "widget-data-format": {...}
 *     },
 *     {
 *       "column-key": "year",
 *       "widget-label": "Year",
 *       "widget": "number",
 *       "widget-type": "input",
 *       "widget-data-path": "year"
 *     }
 *   ],
 *   "widget-data-operations": {
 *     "add": true,
 *     "remove": true,
 *     "edit": true
 *   },
 *   "widget-data-api": {
 *     "add": { "url": "/api/records", "method": "POST" },
 *     "edit": { "url": "/api/records/{id}", "method": "PUT" },
 *     "delete": { "url": "/api/records/{id}", "method": "DELETE" }
 *   }
 * }
 */
interface TableWidgetProps {
  config: BaseWidgetConfig;
}

interface EditingState {
  rowIndex: number;
  originalValue: any;
  currentValue: any;
}

interface ConfirmationState {
  show: boolean;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export const TableWidget = ({ config }: TableWidgetProps) => {
  const {
    value,
    error,
    touched,
    isEnabled,
    onChange,
    config: widgetConfig,
  } = useBaseWidget({ config });

  const { translate, translateConfig } = useWidgetTranslation();
  const { apiAdapter } = useWidgetContext();
  const dispatch = useDispatch();

  const rows: any[] = Array.isArray(value) ? value : [];
  const columns = widgetConfig['widget-data-columns'] || [];
  const operations = widgetConfig['widget-data-operations'] || {};
  const apiConfig = widgetConfig['widget-data-api'] || {};
  const isReadonly = widgetConfig['widget-readonly'] || false;

  // State for editing
  const [editingState, setEditingState] = useState<EditingState | null>(null);
  const [loadingRowIndex, setLoadingRowIndex] = useState<number | null>(null);
  const [confirmationState, setConfirmationState] = useState<ConfirmationState | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [newRowData, setNewRowData] = useState<any>(null);

  // Check if any row is being edited
  const isAnyRowEditing = editingState !== null || isAdding;

  // Show confirmation dialog
  const showConfirmation = useCallback((message: string, onConfirm: () => void, onCancel: () => void) => {
    setConfirmationState({
      show: true,
      message,
      onConfirm: () => {
        setConfirmationState(null);
        onConfirm();
      },
      onCancel: () => {
        setConfirmationState(null);
        onCancel();
      },
    });
  }, []);

  // Cancel current edit
  const cancelEdit = useCallback(() => {
    if (editingState) {
      // Revert to original value
      const newRows = [...rows];
      newRows[editingState.rowIndex] = editingState.originalValue;
      onChange(newRows);
      
      // Clear widget values from Redux for this row's cells
      columns.forEach((col) => {
        const cellWidgetId = `${widgetConfig['widget-id']}-row-${editingState.rowIndex}-col-${col['column-key']}`;
        dispatch(resetWidget(cellWidgetId));
      });
    }
    if (isAdding) {
      // Clear widget values from Redux for new row's cells
      columns.forEach((col) => {
        const cellWidgetId = `${widgetConfig['widget-id']}-row-${rows.length}-col-${col['column-key']}`;
        dispatch(resetWidget(cellWidgetId));
      });
    }
    setEditingState(null);
    setIsAdding(false);
    setNewRowData(null);
  }, [editingState, rows, onChange, columns, widgetConfig, isAdding, dispatch]);

  // Start editing a row
  const startEdit = useCallback((rowIndex: number) => {
    if (isAnyRowEditing) {
      showConfirmation(
        translate('table.unsavedChanges') || 'You have unsaved changes. Do you want to discard them?',
        () => {
          cancelEdit();
          const row = rows[rowIndex];
          setEditingState({
            rowIndex,
            originalValue: { ...row },
            currentValue: { ...row },
          });
        },
        () => {
          // Do nothing, keep current edit
        }
      );
    } else {
      const row = rows[rowIndex];
      setEditingState({
        rowIndex,
        originalValue: { ...row },
        currentValue: { ...row },
      });
    }
  }, [isAnyRowEditing, rows, showConfirmation, cancelEdit, translate]);

  // Update cell value during edit
  const updateCellValue = useCallback((columnKey: string, newValue: any) => {
    if (editingState) {
      setEditingState({
        ...editingState,
        currentValue: {
          ...editingState.currentValue,
          [columnKey]: newValue,
        },
      });
    } else if (isAdding && newRowData) {
      setNewRowData({
        ...newRowData,
        [columnKey]: newValue,
      });
    }
  }, [editingState, isAdding, newRowData]);

  // Save edited row
  const saveEdit = useCallback(async () => {
    if (!editingState) return;

    const rowData = editingState.currentValue;
    const rowIndex = editingState.rowIndex;
    setLoadingRowIndex(rowIndex);

    try {
      // If API config exists, make API call
      if (apiAdapter && apiConfig.edit) {
        const editConfig = apiConfig.edit;
        let url = editConfig.url || '';
        
        // Replace {id} placeholder if present
        if (rowData.id !== undefined) {
          url = url.replace('{id}', rowData.id);
        }

        await apiAdapter(url, {
          method: editConfig.method || 'PUT',
          headers: editConfig.headers || { 'Content-Type': 'application/json' },
          body: rowData,
        });
      }

      // Update local state
      const newRows = [...rows];
      newRows[rowIndex] = rowData;
      onChange(newRows);

      setEditingState(null);
    } catch (error) {
      console.error('Error saving record:', error);
      // Show error message (could be enhanced with toast/notification)
      alert(translate('table.saveError') || 'Failed to save record. Please try again.');
    } finally {
      setLoadingRowIndex(null);
    }
  }, [editingState, rows, onChange, apiAdapter, apiConfig, translate]);

  // Add new row
  const startAdd = useCallback(() => {
    if (isAnyRowEditing) {
      showConfirmation(
        translate('table.unsavedChanges') || 'You have unsaved changes. Do you want to discard them?',
        () => {
          cancelEdit();
          const emptyRow: any = {};
          columns.forEach((col) => {
            emptyRow[col['column-key']] = col['widget-data-default'] || '';
          });
          setIsAdding(true);
          setNewRowData(emptyRow);
        },
        () => {
          // Do nothing, keep current edit
        }
      );
    } else {
      const emptyRow: any = {};
      columns.forEach((col) => {
        emptyRow[col['column-key']] = col['widget-data-default'] || '';
      });
      setIsAdding(true);
      setNewRowData(emptyRow);
    }
  }, [isAnyRowEditing, columns, showConfirmation, cancelEdit, translate]);

  // Save new row
  const saveAdd = useCallback(async () => {
    if (!isAdding || !newRowData) return;

    setLoadingRowIndex(-1); // Use -1 to indicate new row

    try {
      let savedRow = { ...newRowData };

      // If API config exists, make API call
      if (apiAdapter && apiConfig.add) {
        const addConfig = apiConfig.add;
        const response = await apiAdapter(addConfig.url || '', {
          method: addConfig.method || 'POST',
          headers: addConfig.headers || { 'Content-Type': 'application/json' },
          body: newRowData,
        });
        
        // Use response data if available (might contain generated ID)
        if (response && typeof response === 'object') {
          savedRow = { ...savedRow, ...response };
        }
      }

      // Add to local state
      onChange([...rows, savedRow]);

      setIsAdding(false);
      setNewRowData(null);
    } catch (error) {
      console.error('Error adding record:', error);
      alert(translate('table.addError') || 'Failed to add record. Please try again.');
    } finally {
      setLoadingRowIndex(null);
    }
  }, [isAdding, newRowData, rows, onChange, apiAdapter, apiConfig, translate]);

  // Delete row
  const deleteRow = useCallback(async (rowIndex: number) => {
    if (isAnyRowEditing) {
      showConfirmation(
        translate('table.unsavedChanges') || 'You have unsaved changes. Do you want to discard them?',
        () => {
          cancelEdit();
          performDelete(rowIndex);
        },
        () => {
          // Do nothing, keep current edit
        }
      );
    } else {
      performDelete(rowIndex);
    }
  }, [isAnyRowEditing, showConfirmation, cancelEdit, translate]);

  const performDelete = useCallback(async (rowIndex: number) => {
    const row = rows[rowIndex];
    setLoadingRowIndex(rowIndex);

    try {
      // If API config exists, make API call
      if (apiAdapter && apiConfig.delete) {
        const deleteConfig = apiConfig.delete;
        let url = deleteConfig.url || '';
        
        // Replace {id} placeholder if present
        if (row.id !== undefined) {
          url = url.replace('{id}', row.id);
        }

        await apiAdapter(url, {
          method: deleteConfig.method || 'DELETE',
          headers: deleteConfig.headers || {},
        });
      }

      // Remove from local state
      const newRows = rows.filter((_, i) => i !== rowIndex);
      onChange(newRows);
    } catch (error) {
      console.error('Error deleting record:', error);
      alert(translate('table.deleteError') || 'Failed to delete record. Please try again.');
    } finally {
      setLoadingRowIndex(null);
    }
  }, [rows, onChange, apiAdapter, apiConfig, translate]);

  // Get cell value (from editing state or row data)
  const getCellValue = useCallback((rowIndex: number, columnKey: string) => {
    if (editingState && editingState.rowIndex === rowIndex) {
      return editingState.currentValue[columnKey];
    }
    if (isAdding && rowIndex === rows.length) {
      return newRowData?.[columnKey];
    }
    return rows[rowIndex]?.[columnKey];
  }, [editingState, isAdding, rows, newRowData]);

  // Get formatted display value for a cell
  const getDisplayValue = useCallback((rowIndex: number, column: any) => {
    const columnKey = column['column-key'];
    const cellValue = getCellValue(rowIndex, columnKey);
    
    if (cellValue === null || cellValue === undefined || cellValue === '') {
      return '-';
    }

    // Use formatValue if format config exists
    if (column['widget-data-format']) {
      return formatValue(cellValue, column['widget-data-format'], column.widget);
    }

    return cellValue?.toString() || '-';
  }, [getCellValue]);

  // Check if row is being edited
  const isRowEditing = useCallback((rowIndex: number) => {
    return editingState?.rowIndex === rowIndex || (isAdding && rowIndex === rows.length);
  }, [editingState, isAdding, rows.length]);

  // Set cell widget value in Redux when entering edit mode
  useEffect(() => {
    if (editingState) {
      columns.forEach((col) => {
        const columnKey = col['column-key'];
        const cellWidgetId = `${widgetConfig['widget-id']}-row-${editingState.rowIndex}-col-${columnKey}`;
        const cellValue = editingState.currentValue[columnKey];
        const defaultValue = cellValue !== undefined ? cellValue : (col['widget-data-default'] ?? '');
        // Set value in Redux store
        dispatch(setValue({ widgetId: cellWidgetId, value: defaultValue }));
      });
    }
  }, [editingState, columns, widgetConfig, dispatch]);

  useEffect(() => {
    if (isAdding && newRowData) {
      columns.forEach((col) => {
        const columnKey = col['column-key'];
        const cellWidgetId = `${widgetConfig['widget-id']}-row-${rows.length}-col-${columnKey}`;
        const cellValue = newRowData[columnKey];
        const defaultValue = cellValue !== undefined ? cellValue : (col['widget-data-default'] ?? '');
        // Set value in Redux store for new row
        dispatch(setValue({ widgetId: cellWidgetId, value: defaultValue }));
      });
    }
  }, [isAdding, newRowData, columns, widgetConfig, rows.length, dispatch]);

  // Render cell content (widget in edit mode, formatted value in view mode)
  const renderCell = useCallback((rowIndex: number, column: any) => {
    const columnKey = column['column-key'];
    const isEditing = isRowEditing(rowIndex);
    const cellValue = getCellValue(rowIndex, columnKey);
    if (isEditing) {
      // Render widget in edit mode
      // Use widget-id as the storage key (no data-path) so it stores in Redux by widget-id
      const cellWidgetId = `${widgetConfig['widget-id']}-row-${rowIndex}-col-${columnKey}`;
      const cellConfig: BaseWidgetConfig = {
        ...column,
        'widget-id': cellWidgetId,
        'widget-readonly': false,
        'widget-data-path': undefined, // No data path - widget will use widget-id as key
        'widget-data-default': cellValue !== undefined ? cellValue : (column['widget-data-default'] ?? ''),
        // Ensure widget and widget-type are set
        widget: column.widget || 'text',
        'widget-type': column['widget-type'] || 'input',
      };

      return (
        <div className="min-w-[120px]">
          <WidgetRenderer
            config={cellConfig}
            schemaData={{
              [cellWidgetId]: cellValue !== undefined ? cellValue : (column['widget-data-default'] ?? ''),
            }}
            onValueChange={(widgetId, newValue) => {
              updateCellValue(columnKey, newValue);
            }}
          />
        </div>
      );
    } else {
      // Display formatted value in view mode
      return (
        <div className="text-sm text-gray-900">
          {getDisplayValue(rowIndex, column)}
        </div>
      );
    }
  }, [isRowEditing, getCellValue, getDisplayValue, widgetConfig, updateCellValue]);

  const tableWidgetId = `table-widget-${widgetConfig['widget-id']}`;
  // Get column span from config (1, 2, 3, etc.) - defaults to 2 if not specified
  const columnSpan = widgetConfig['widget-column-span'] || 2;
  const minWidth = columnSpan * 200; // Each column is 200px

  return (
    <>
      <style>{`
        /* Table widget styling - width based on column span */
        .${tableWidgetId} {
          width: 100%;
          min-width: ${minWidth}px;
          flex: 1 1 ${minWidth}px; /* Grow to fill available space in flex layout */
        }
        
        /* Target the widget-container parent when it contains a table widget */
        .widget-container[data-widget-id="${widgetConfig['widget-id']}"] {
          min-width: ${minWidth}px;
          flex: 1 1 ${minWidth}px;
          width: 100%;
        }
        
        /* In horizontal panels, make table widget span specified columns */
        .panel-horizontal .widget-container[data-widget-id="${widgetConfig['widget-id']}"],
        [data-panel-orientation="horizontal"] .widget-container[data-widget-id="${widgetConfig['widget-id']}"] {
          grid-column: span ${columnSpan};
        }
        
        /* When table is the only widget in horizontal panel, take full width */
        .panel-horizontal > div:only-child .widget-container[data-widget-id="${widgetConfig['widget-id']}"],
        [data-panel-orientation="horizontal"] > div:only-child .widget-container[data-widget-id="${widgetConfig['widget-id']}"] {
          grid-column: 1 / -1; /* Span all columns in grid */
          width: 100%;
          flex: 1 1 100%;
        }
      `}</style>
      <div className={`mb-4 table-widget-container ${tableWidgetId}`}>
        {/* Confirmation Dialog */}
      {confirmationState?.show && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-4">
              {translate('table.confirm') || 'Confirm Action'}
            </h3>
            <p className="text-gray-700 mb-6">
              {confirmationState.message}
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={confirmationState.onCancel}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-200 rounded hover:bg-gray-300"
              >
                {translate('common.cancel') || 'Cancel'}
              </button>
              <button
                onClick={confirmationState.onConfirm}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded hover:bg-blue-700"
              >
                {translate('table.discard') || 'Discard & Continue'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Table Header */}
      {operations.add && !isReadonly && isEnabled && (
        <div className="flex justify-end mb-2">
          <button
            type="button"
            onClick={startAdd}
            disabled={loadingRowIndex !== null}
            className="px-3 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {translate('table.addRecord') || 'Add New Record'}
          </button>
        </div>
      )}

      {rows.length === 0 && !isAdding ? (
        <div className="text-gray-500 text-sm py-4 text-center border border-gray-300 rounded">
          {translate('table.noData') || 'No records available.'}
          {operations.add && !isReadonly && ` ${translate('table.clickToAdd') || 'Click "Add New Record" to add one.'}`}
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
                    {translateConfig(col['widget-label'])}
                  </th>
                ))}
                {((operations.edit || operations.remove) && !isReadonly) || isAnyRowEditing ? (
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {translate('common.actions') || 'Actions'}
                  </th>
                ) : null}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {rows.map((row, rowIndex) => {
                const isEditing = isRowEditing(rowIndex);
                const isLoading = loadingRowIndex === rowIndex;
                return (
                  <tr
                    key={rowIndex}
                    className={isEditing ? 'bg-blue-50' : isLoading ? 'opacity-50' : ''}
                  >
                    {columns.map((col) => (
                      <td key={col['column-key']} className="px-4 py-3 whitespace-nowrap">
                        {renderCell(rowIndex, col)}
                      </td>
                    ))}
                    {((operations.edit || operations.remove) && !isReadonly) || isEditing ? (
                      <td className="px-4 py-3 whitespace-nowrap" style={{ minWidth: '120px' }}>
                        {isEditing ? (
                          <div className="flex flex-row gap-2 items-center" style={{ width: '100%' }}>
                            <button
                              type="button"
                              onClick={saveEdit}
                              disabled={isLoading}
                              className="px-3 py-1 text-xs font-medium rounded hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap flex-shrink-0"
                              style={{ 
                                display: 'inline-block', 
                                minWidth: '60px',
                                backgroundColor: '#16a34a', // green-600
                                color: '#ffffff', // white text
                                border: 'none'
                              }}
                            >
                              Save
                            </button>
                            <button
                              type="button"
                              onClick={cancelEdit}
                              disabled={isLoading}
                              className="px-3 py-1 text-xs font-medium bg-gray-200 text-gray-700 rounded hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap flex-shrink-0"
                              style={{ display: 'inline-block', minWidth: '60px' }}
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <div className="flex gap-2">
                            {operations.edit && (
                              <button
                                type="button"
                                onClick={() => startEdit(rowIndex)}
                                disabled={isAnyRowEditing || isLoading}
                                className="px-3 py-1 text-xs text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                {translate('common.edit') || 'Edit'}
                              </button>
                            )}
                            {operations.remove && (
                              <button
                                type="button"
                                onClick={() => deleteRow(rowIndex)}
                                disabled={isAnyRowEditing || isLoading}
                                className="px-3 py-1 text-xs text-red-600 hover:text-red-800 hover:bg-red-50 rounded disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                {translate('common.remove') || 'Delete'}
                              </button>
                            )}
                          </div>
                        )}
                      </td>
                    ) : null}
                  </tr>
                );
              })}

              {/* New row being added */}
              {isAdding && newRowData && (
                <tr className="bg-blue-50">
                  {columns.map((col) => (
                    <td key={col['column-key']} className="px-4 py-3 whitespace-nowrap">
                      {renderCell(rows.length, col)}
                    </td>
                  ))}
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={saveAdd}
                        disabled={loadingRowIndex === -1}
                        className="px-3 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
                      >
                        {translate('common.save') || 'Save'}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setIsAdding(false);
                          setNewRowData(null);
                        }}
                        disabled={loadingRowIndex === -1}
                        className="px-3 py-1 text-xs bg-gray-200 text-gray-700 rounded hover:bg-gray-300 disabled:opacity-50"
                      >
                        {translate('common.cancel') || 'Cancel'}
                      </button>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Error and Help Text */}
      {touched && error.length > 0 && (
        <p className="text-red-500 text-sm mt-1">{error[0]}</p>
      )}
      {widgetConfig['widget-data-helptext'] && (
        <p className="text-gray-500 text-sm mt-1">
          {translateConfig(widgetConfig['widget-data-helptext'])}
        </p>
      )}
      </div>
    </>
  );
};
