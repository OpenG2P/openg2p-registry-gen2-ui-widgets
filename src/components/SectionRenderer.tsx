import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useStore, useDispatch, useSelector } from 'react-redux';
import { setValues } from '../store/widgetSlice';
import { WidgetRootState } from '../store';
import { SectionConfig, PanelConfig, SupportingDocumentConfig } from '../types';
import { UseBaseWidgetOptions } from '../hooks/useBaseWidget';
import { PanelRenderer } from './PanelRenderer';
import { useWidgetTranslation } from '../hooks/useWidgetTranslation';
import { getValueByPath, setWidgetValue, setValueByPath } from '../utils/pathUtils';
import { useWidgetContext } from './WidgetProvider';
import { FileInputWidget } from '../widgets/FileInputWidget';
import { SectionMode } from './SectionsContainer';
import { namespaceSectionConfig } from '../utils/schemaNamespace';

// Track section changes for change request creation
export interface SectionChanges {
  section_id: string;
  records: unknown[];
  files?: unknown[];
}

export interface SectionRendererProps {
  section: SectionConfig;
  dataSourceRequestHandler?: UseBaseWidgetOptions['dataSourceRequestHandler'];
  schemaData?: UseBaseWidgetOptions['schemaData'];
  onValueChange?: UseBaseWidgetOptions['onValueChange'];
  gridColumnSpan?: number; // Number of grid columns this section should span
  onSectionSave?: (changes: SectionChanges) => Promise<void> | void;
  hideEditButton?: boolean; // Hide the edit button band below the section
  mode?: SectionMode; // Display mode: 'RegistryView' (default) or 'CRView'
  namespace?: string; // Optional namespace prefix for widget IDs (ensures uniqueness when same section is rendered multiple times)
  // CRView data is read from schemaData with keys: createdBy, createdDate, approvedBy, approvedDate
}


/**
 * Renders a section with its panels
 * 
 * Layout behavior:
 * - Section width is based on max 3 panels (or more on high resolution)
 * - Panels wrap when they exceed available width
 * - Sections can sit side-by-side if there's space
 */
export const SectionRenderer = ({
  section,
  dataSourceRequestHandler: propDataSourceRequestHandler,
  schemaData,
  onValueChange,
  gridColumnSpan,
  onSectionSave,
  hideEditButton = false,
  mode = 'RegistryView',
  namespace,
}: SectionRendererProps) => {
  const { translateConfig, translate } = useWidgetTranslation();
  const { schemaData: contextSchemaData, dataSourceRequestHandler: contextDataSourceRequestHandler } = useWidgetContext();
  const store = useStore();
  const dispatch = useDispatch();
  
  // Use prop handler if provided, otherwise fall back to context
  const dataSourceRequestHandler = propDataSourceRequestHandler || contextDataSourceRequestHandler;

  // Get CRView data from schemaData (prefer prop over context, then Redux store)
  const currentSchemaData = schemaData || contextSchemaData || {};
  const storeValues = useSelector((state: WidgetRootState) => state.widget?.values || {});

  // Namespace the section if namespace is provided
  // This ensures unique widget IDs when the same section is rendered multiple times
  const namespacedSection = useMemo(() => {
    if (namespace) {
      return namespaceSectionConfig(section, namespace);
    }
    return section;
  }, [section, namespace]);

  // Create namespaced schemaData if namespace is provided
  // This ensures widgets can read initial values from schemaData at namespaced paths
  const namespacedSchemaData = useMemo(() => {
    if (!namespace || !currentSchemaData) {
      return schemaData;
    }
    // Create a namespaced version of schemaData by copying values to namespaced paths
    const namespaced: Record<string, any> = { ...currentSchemaData };
    
    // Copy all top-level keys to namespaced paths
    Object.keys(currentSchemaData).forEach(key => {
      const namespacedKey = `${namespace}.${key}`;
      if (!(namespacedKey in namespaced)) {
        namespaced[namespacedKey] = currentSchemaData[key];
      }
    });
    
    // Also handle nested objects - copy nested values to namespaced paths
    const copyNestedValues = (obj: any, prefix: string = '') => {
      if (obj && typeof obj === 'object' && !Array.isArray(obj)) {
        Object.keys(obj).forEach(key => {
          const fullPath = prefix ? `${prefix}.${key}` : key;
          const namespacedPath = `${namespace}.${fullPath}`;
          if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key])) {
            copyNestedValues(obj[key], fullPath);
            // Also set the nested object at the namespaced path
            setValueByPath(namespaced, namespacedPath, obj[key]);
          } else {
            setValueByPath(namespaced, namespacedPath, obj[key]);
          }
        });
      }
    };
    
    copyNestedValues(currentSchemaData);
    
    return namespaced;
  }, [namespace, schemaData, currentSchemaData]);

  const crViewData = useMemo(() => {
    if (mode !== 'CRView') return null;
    // Try to get from schemaData first, then from Redux store
    // Merge both sources to ensure we get the data
    const dataSource = { ...storeValues, ...currentSchemaData };
    const result = {
      createdBy: getValueByPath(dataSource, 'createdBy') || getValueByPath(dataSource, 'created_by'),
      createdDate: getValueByPath(dataSource, 'createdDate') || getValueByPath(dataSource, 'created_date'),
      approvedBy: getValueByPath(dataSource, 'approvedBy') || getValueByPath(dataSource, 'approved_by'),
      approvedDate: getValueByPath(dataSource, 'approvedDate') || getValueByPath(dataSource, 'approved_date'),
    };
    return result;
  }, [mode, currentSchemaData, storeValues]);

  // Use namespaced section for rendering
  const sectionToRender = namespacedSection;
  const sectionId = sectionToRender['section-id'];
  const gridId = `section-panels-${sectionId}`;
  const sectionClassId = `section-${sectionId}`;

  // Recursively count all vertical panels, especially those nested inside horizontal panels
  // Typically: horizontal panels at first level contain vertical panels at second level
  // Accounts for panel-column-span: a panel with column-span 3 counts as 3 columns
  const countVerticalPanels = (panels: SectionConfig['panels']): number => {
    let count = 0;
    for (const panel of panels) {
      const orientation = panel['panel-orientation'] || 'vertical';

      if (orientation === 'horizontal' && panel.panels) {
        // For horizontal panels, count all vertical panels nested inside (typically second level)
        count += countVerticalPanels(panel.panels);
      } else if (orientation === 'vertical') {
        // Count this vertical panel, accounting for column span
        const columnSpan = panel['panel-column-span'] || 1;
        count += columnSpan;
        // Also recursively count vertical panels nested inside this vertical panel
        if (panel.panels && panel.panels.length > 0) {
          count += countVerticalPanels(panel.panels);
        }
      }
    }
    return count;
  };

  // Check if section contains a table widget
  const checkForTableWidget = (panels: PanelConfig[]): boolean => {
    for (const panel of panels) {
      if (panel.widgets) {
        for (const widget of panel.widgets) {
          if (widget.widget === 'table' || widget['widget-type'] === 'table') {
            return true;
          }
        }
      }
      if (panel.panels) {
        if (checkForTableWidget(panel.panels)) {
          return true;
        }
      }
    }
    return false;
  };

  // Get table widget column span if explicitly set
  const getTableWidgetColumnSpan = (panels: PanelConfig[]): number | null => {
    for (const panel of panels) {
      if (panel.widgets) {
        for (const widget of panel.widgets) {
          if (widget.widget === 'table' || widget['widget-type'] === 'table') {
            // Return the widget's column span if specified, otherwise null
            return widget['widget-column-span'] || null;
          }
        }
      }
      if (panel.panels) {
        const nestedSpan = getTableWidgetColumnSpan(panel.panels);
        if (nestedSpan !== null) {
          return nestedSpan;
        }
      }
    }
    return null;
  };

  const hasTableWidget = checkForTableWidget(sectionToRender.panels);
  const tableWidgetColumnSpan = getTableWidgetColumnSpan(sectionToRender.panels);

  const verticalPanelsCount = countVerticalPanels(sectionToRender.panels);
  // If section contains a table widget with explicit column span, use it
  // Otherwise, if it has a table widget, ensure it spans at least 2 columns
  // Otherwise, use the vertical panel count
  const columnSpan = gridColumnSpan || 
    (tableWidgetColumnSpan !== null ? tableWidgetColumnSpan : 
     (hasTableWidget ? Math.max(verticalPanelsCount, 2) : verticalPanelsCount));
  
  // Check if table widget has explicit column span (not default)
  const hasExplicitTableSpan = tableWidgetColumnSpan !== null;
  
  // Supporting documents configuration
  const supportingDocuments = sectionToRender['section-supporting-documents'] || [];
  const hasSupportingDocuments = supportingDocuments.length > 0;
  
  // Edit mode state
  const [isEditMode, setIsEditMode] = useState(false);
  const [isDocumentsExpanded, setIsDocumentsExpanded] = useState(true);
  const sectionRef = useRef<HTMLDivElement>(null);
  const [sectionHeight, setSectionHeight] = useState<number | null>(null);
  const [editSectionPosition, setEditSectionPosition] = useState<{
    top: number;
    left: number;
    width: number;
  } | null>(null);
  
  // Capture section position when entering edit mode and update on scroll
  useEffect(() => {
    if (isEditMode && sectionRef.current) {
      const updatePosition = () => {
        if (sectionRef.current) {
          const rect = sectionRef.current.getBoundingClientRect();
          setEditSectionPosition({
            top: rect.top + window.scrollY,
            left: rect.left + window.scrollX,
            width: rect.width,
          });
        }
      };
      
      // Initial position calculation
      requestAnimationFrame(updatePosition);
      
      // Update position on scroll to keep it aligned with original section
      window.addEventListener('scroll', updatePosition, { passive: true });
      window.addEventListener('resize', updatePosition, { passive: true });
      
      return () => {
        window.removeEventListener('scroll', updatePosition);
        window.removeEventListener('resize', updatePosition);
      };
    } else if (!isEditMode) {
      setEditSectionPosition(null);
      setSectionHeight(null);
    }
  }, [isEditMode]);

  // Recursively modify panels to set readonly based on edit mode
  const makePanelsEditable = (panels: PanelConfig[], editable: boolean): PanelConfig[] => {
    const sectionEditable = sectionToRender['section-editable'] === true;
    return panels.map(panel => {
      const modifiedPanel: PanelConfig = {
        ...panel,
        panels: panel.panels ? makePanelsEditable(panel.panels, editable) : undefined,
        widgets: panel.widgets?.map(widget => {
          // When NOT in edit mode (editable = false), set all widgets to readonly
          // When in edit mode (editable = true):
          //   - If section-editable is true, force widgets to be editable (override widget-readonly)
          //   - Otherwise, respect original readonly setting
          const newReadonly = editable 
            ? (sectionEditable ? false : (widget['widget-readonly'] || false))
            : true;
          
          return {
            ...widget,
            'widget-readonly': newReadonly,
          };
        }),
      };
      return modifiedPanel;
    });
  };

  // Create section with widgets readonly/editable based on edit mode
  const editableSection = useMemo(() => {
    // Always apply readonly/editable state based on edit mode
    return {
      ...sectionToRender,
      panels: makePanelsEditable(sectionToRender.panels, isEditMode),
    };
  }, [sectionToRender, isEditMode]);


  // Handle edit button click
  const handleEdit = () => {
    // Capture height BEFORE entering edit mode to preserve space
    if (sectionRef.current) {
      const height = sectionRef.current.offsetHeight;
      setSectionHeight(height);
    }
    setIsEditMode(true);
  };
  
  // Render the edit section (absolutely positioned duplicate via portal)
  const renderEditSection = () => {
    if (!isEditMode || !editSectionPosition) return null;
    
    const editGridId = `${gridId}-edit`;
    
    return createPortal(
      <>
        <style>{`
          #${editGridId} {
            display: flex;
            flex-wrap: wrap;
            width: 100%;
          }
          #${editGridId} > .panel-wrapper {
            flex: 1 1 100%;
            min-width: 0;
          }
          @media (min-width: 640px) {
            #${editGridId} > .panel-wrapper {
              flex: 1 1 calc(50% - 0.75rem);
            }
          }
          @media (min-width: 1024px) {
            #${editGridId} > .panel-wrapper {
              flex: 1 1 calc(33.333% - 1rem);
            }
          }
          @media (min-width: 1280px) {
            #${editGridId} > .panel-wrapper {
              flex: 1 1 calc(25% - 1.125rem);
            }
          }
          @media (min-width: 1536px) {
            #${editGridId} > .panel-wrapper {
              flex: 1 1 calc(20% - 1.2rem);
            }
          }
          
          /* Vertical dividers between vertical panels in edit mode */
          #${editGridId} > .panel-wrapper {
            position: relative;
          }
          /* Only add divider between panels, not after the last one */
          #${editGridId} > .panel-wrapper:not(.last-panel-wrapper)::after {
            content: '';
            position: absolute;
            right: 0;
            top: 0;
            bottom: 0;
            width: 1px;
            background-color: #F2BA1A;
          }
        `}</style>
        <div
          className={`section ${sectionClassId} ${sectionClassId}-edit px-4 sm:px-6 lg:px-8`}
          data-section-id={`${sectionId}-edit`}
          style={{
            position: 'absolute',
            top: `${editSectionPosition.top}px`,
            left: `${editSectionPosition.left}px`,
            width: `${editSectionPosition.width}px`,
            maxHeight: '90vh',
            overflowY: 'auto',
          }}
        >
        {sectionToRender['section-title'] && (
          <h2 className="text-xl font-semibold mb-4" style={{ fontFamily: 'Roboto, sans-serif', marginTop: '35px' }}>{translateConfig(sectionToRender['section-title'])}</h2>
        )}
          <div id={editGridId} className="section-panels">
            {editableSection.panels.map((panel, index) => {
              const isLastPanel = index === editableSection.panels.length - 1;
              return (
              <div
                key={panel['panel-id'] || `section-panel-${index}`}
                className={`panel-wrapper ${isLastPanel ? 'last-panel-wrapper' : ''}`}
              >
              <PanelRenderer
                panel={panel}
                dataSourceRequestHandler={dataSourceRequestHandler}
                schemaData={namespacedSchemaData}
                onValueChange={onValueChange}
                isEditMode={true}
              />
              </div>
              );
            })}
            {hasSupportingDocuments && (
              <>
                <hr className="my-4 w-full" style={{ height: '1px', backgroundColor: '#F2BA1A', border: 'none' }} />
                <div className="supporting-documents-container">
                  <button
                    type="button"
                    onClick={() => setIsDocumentsExpanded(!isDocumentsExpanded)}
                    className="supporting-documents-title-button w-full flex items-center text-left"
                  >
                    <span className="font-semibold" style={{ fontFamily: 'Roboto, sans-serif', fontSize: '16px' }}>
                      {translate('common.supportedDocuments') || 'Supported Documents'}
                    </span>
                    <svg
                      className={`w-5 h-5 text-[#ED7C22] transition-transform ml-2 ${isDocumentsExpanded ? 'rotate-180' : ''}`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  {isDocumentsExpanded && (
                    <div className="supporting-documents-grid mt-4">
                      {supportingDocuments.map((doc, index) => {
                        const docConfig = createDocumentWidgetConfig(doc, sectionId, index);
                        return (
                          <div key={`${sectionId}-doc-${index}`} className="supporting-document-item">
                            <FileInputWidget config={docConfig} />
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </>
            )}
            <hr className="w-full" style={{ height: '1px', backgroundColor: '#F2BA1A', border: 'none', marginTop: hasSupportingDocuments ? '20px' : 0, marginBottom: '20px' }} />
            <div className="edit-controls-container" style={{ marginBottom: '20px' }}>
              <div className="edit-controls-buttons">
                <button
                  onClick={handleCancel}
                  className="bg-white hover:bg-gray-50 text-gray-900 text-sm font-medium px-6 py-2 transition-colors border border-gray-300"
                  style={{ fontFamily: 'Roboto, sans-serif', borderRadius: '10px' }}
                >
                  {translate('common.cancel') || 'Cancel'}
                </button>
                <button
                  onClick={handleSave}
                  className="bg-gray-900 hover:bg-gray-800 text-white text-sm font-medium px-6 py-2 transition-colors"
                  style={{ fontFamily: 'Roboto, sans-serif', borderRadius: '10px' }}
                >
                  {translate('common.save') || 'Save'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </>,
      document.body
    );
  };

  const collectWidgets = (panels: PanelConfig[]): any[] => {
    let widgets: any[] = [];
    panels.forEach(panel => {
      if (panel.widgets) {
        widgets = [...widgets, ...panel.widgets];
      }
      if (panel.panels) {
        widgets = [...widgets, ...collectWidgets(panel.panels)];
      }
    });
    return widgets;
  };

  const trackSectionChages = (widgets: any[], sourceData: any, useNamespacedPaths: boolean = false) => {
    const snapshot: Record<string, any> = {};
    let hasTable = false
    const recordId = Object.keys(sourceData)[0];
    widgets.forEach(widget => {
      const originalDataPath = widget['widget-data-path'];
      if (!originalDataPath) return;
      if (widget['widget-type'] === 'table' || widget['widget-type'] === 'simple-table') {
        hasTable = true;
      }
      
      // If namespace was used and we're reading from store, use namespaced paths
      const readDataPath = useNamespacedPaths && namespace && originalDataPath
        ? (typeof originalDataPath === 'string'
            ? `${namespace}.${originalDataPath}`
            : Object.fromEntries(
                Object.entries(originalDataPath).map(([key, path]) => [key, `${namespace}.${path}`])
              ))
        : originalDataPath;
      
      // Always store snapshot using original paths (for change tracking)
      // Handle multi-path (object) or single path (string)
      if (typeof originalDataPath === 'object') {
        // Multi-path: store each path separately using original paths
        Object.entries(originalDataPath).forEach(([key, path]) => {
          if (typeof path === 'string') {
            // Read from source using namespaced path if needed
            const readPath = useNamespacedPaths && namespace ? `${namespace}.${path}` : path;
            snapshot[path] = getValueByPath(sourceData, readPath);
          }
        });
      } else if (typeof originalDataPath === 'string') {
        // Read from source using namespaced path if needed
        const readPath = useNamespacedPaths && namespace ? `${namespace}.${originalDataPath}` : originalDataPath;
        snapshot[originalDataPath] = getValueByPath(sourceData, readPath);
      }
    });

    if (hasTable===false) {
      const cleanedSnapshot: Record<string, any> = {};

      Object.entries(snapshot).forEach(([key, value]) => {
        const removedFirstLevelPath = key.includes('.')
          ? key.split('.').slice(1).join('.')
          : key;

        cleanedSnapshot[removedFirstLevelPath] = value;
      });

      return [
        { ...sourceData[recordId],
          ...cleanedSnapshot,
          edit_action: "UPDATE"
        }
      ]
    }
    const recordEntry = Object.entries(snapshot).find(
        ([key, value]) => key.endsWith('.records') && Array.isArray(value)
    );
    return recordEntry ? recordEntry[1] : snapshot;
  };

  // Get original section (without namespace) for building snapshots
  // This ensures we use the original data paths when saving
  const originalSection = section;

  // Handle save button click
  const handleSave = async () => {
    if (!store || !onSectionSave) {
      console.warn('Missing store or onSectionSave in SectionRenderer');
      setIsEditMode(false);
      return;
    }
    // Use original section (without namespace) for collecting widgets
    // This ensures we use the original widget IDs and data paths
    const sectionWidgets = collectWidgets(originalSection.panels)
    const currentState = (store.getState() as any).widget
    const currentSchemaData = currentState.values || {}

    // schema data before section change
    const oldSchemaData = schemaData || contextSchemaData
    // schema data after section change
    const newSchemaData = trackSectionChages(
      sectionWidgets,
      currentSchemaData,
    )

    // Include supporting documents in the snapshot if they exist
    const sectionFiles:unknown[] = [];
    if (hasSupportingDocuments) {
      // Use original section's supporting documents to get original data paths
      const originalSupportingDocuments = originalSection['section-supporting-documents'] || [];
      originalSupportingDocuments.forEach((doc) => {
        const originalDataPath = doc['document-data-path'];
        // Read new value from store (with namespace if used)
        const storeDataPath = namespace && originalDataPath
          ? `${namespace}.${originalDataPath}`
          : originalDataPath;
        sectionFiles.push(getValueByPath(currentSchemaData, storeDataPath));
      });
    }
  
    if (JSON.stringify(oldSchemaData) !== JSON.stringify(newSchemaData)) {
      try {
        const sectionchanges: SectionChanges = {
          section_id: originalSection['section-id'],
          records:[...newSchemaData],
          files:[...sectionFiles]
      }
        await onSectionSave(sectionchanges)
      } catch (error) {
        console.error('Section Changes Save failed', error)
      }
    }

    setIsEditMode(false)

  };

 // Handle cancel button click
  const handleCancel = () => {
    // Revert values in store to original schema data
    // Use original section (without namespace) for collecting widgets
    const sectionWidgets = collectWidgets(originalSection.panels);
    const oldSchemaData = schemaData || contextSchemaData;
    const currentStoreValues = (store.getState() as any).widget.values;
    let newStoreValues = currentStoreValues;

    sectionWidgets.forEach(widget => {
      const originalWidgetId = widget['widget-id'];
      // If namespace was used, we need to use namespaced widget ID and data path
      const namespacedWidgetId = namespace ? `${namespace}__${originalWidgetId}` : originalWidgetId;
      const widgetId = namespacedWidgetId;
      const originalDataPath = widget['widget-data-path'];
      // If namespace was used, data path in store is namespaced, but we read from original schema using original path
      const storeDataPath = namespace && originalDataPath
        ? (typeof originalDataPath === 'string' 
            ? `${namespace}.${originalDataPath}` 
            : Object.fromEntries(
                Object.entries(originalDataPath).map(([key, path]) => [key, `${namespace}.${path}`])
              ))
        : originalDataPath;

      if (widgetId && originalDataPath) {
        // Handle multi-path (object) or single path (string)
        // Read from original schema data using original paths
        let oldValue: any;
        if (typeof originalDataPath === 'object') {
          // Multi-path: get values for each path
          oldValue = {};
          Object.entries(originalDataPath).forEach(([key, path]) => {
            if (typeof path === 'string') {
              oldValue[key] = getValueByPath(oldSchemaData, path);
            }
          });
        } else if (typeof originalDataPath === 'string') {
          oldValue = getValueByPath(oldSchemaData, originalDataPath);
        }
        
        // Set in store using namespaced data path (if namespace was used)
        if (oldValue !== undefined) {
          newStoreValues = setWidgetValue(
            newStoreValues,
            storeDataPath,
            widgetId,
            oldValue
          );
        }
      }
    });

    // Also revert supporting documents if any
    if (hasSupportingDocuments) {
      // Use original section's supporting documents to get original data paths
      const originalSupportingDocuments = originalSection['section-supporting-documents'] || [];
      originalSupportingDocuments.forEach((doc, index) => {
        const widgetId = `supporting-doc-${sectionId}-${index}`;
        const originalDataPath = doc['document-data-path'];
        // If namespace was used, data path in store is namespaced
        const storeDataPath = namespace && originalDataPath
          ? `${namespace}.${originalDataPath}`
          : originalDataPath;
        const oldValue = getValueByPath(oldSchemaData, originalDataPath);
        newStoreValues = setWidgetValue(
          newStoreValues,
          storeDataPath,
          widgetId,
          oldValue
        );
      });
    }

    if (newStoreValues !== currentStoreValues) {
      dispatch(setValues(newStoreValues));
    }

    setIsEditMode(false);
  };

  // Create widget config for supporting document
  const createDocumentWidgetConfig = (
    doc: SupportingDocumentConfig,
    sectionId: string,
    index: number
  ) => {
    const documentType = doc['document-type'] || 'file';
    const accept = doc['document-accept'] || 
      (documentType === 'image' ? 'image/*' : 
       documentType === 'pdf' ? '.pdf' : 
       '*/*');
    
    // Use the namespaced section ID for widget ID to ensure uniqueness
    const widgetId = `supporting-doc-${sectionId}-${index}`;
    
    return {
      widget: 'file',
      'widget-type': 'input' as const,
      'widget-label': doc['document-label'] || doc['document-data-path'] || `Document ${index + 1}`,
      'widget-id': widgetId,
      'widget-data-path': doc['document-data-path'],
      'widget-required': doc['document-required'] || false,
      'widget-readonly': false,
      'widget-data-options': {
        accept,
        multiple: false,
        maxSize: doc['document-max-size'],
      },
    };
  };

  return (
    <>
      {renderEditSection()}
      <style>{`
        .${sectionClassId} {
          /* Section spans grid columns based on vertical panel count */
          /* This ensures all sections align to the same grid boundaries */
          width: 100%;
          position: relative;
          transition: box-shadow 0.3s ease-in-out, border-color 0.3s ease-in-out;
          min-height: auto !important;
          height: auto !important;
        }
        
        /* Only apply fixed height when in edit mode */
        .${sectionClassId}[data-edit-mode="true"] {
          min-height: auto;
        }
        
        /* Hide original section content when in edit mode but maintain space */
        .${sectionClassId}[data-edit-mode="true"] {
          visibility: hidden;
          position: relative;
        }
        
        /* Ensure all children are also hidden but maintain their space */
        .${sectionClassId}[data-edit-mode="true"] * {
          visibility: hidden;
        }
        
        /* Edit section styles (rendered via portal, absolutely positioned) */
        .${sectionClassId}-edit {
          box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.2), 
                      0 8px 10px -6px rgba(0, 0, 0, 0.1);
          border-color: #ED7C22;
          border-style: dashed;
          border-width: 1px;
          background-color: #F3E6BC;
          border-radius: 10px;
          z-index: 10;
          position: absolute;
        }
        
        /* Ensure widget containers in edit section have no margin bottom */
        .${sectionClassId}-edit .widget-container {
          margin-bottom: 0 !important;
        }
        
        
        /* Only set grid-column in CSS if no explicit span (inline style will handle explicit spans) */
        .${sectionClassId}[data-has-explicit-span="false"] {
          grid-column: span ${columnSpan};
        }
        
        #${gridId} {
          display: flex;
          flex-wrap: wrap;
          // gap: 1.5rem;
          width: 100%;
          ${hasTableWidget ? 'margin-bottom: 20px;' : ''}
        }
        #${gridId} > .panel-wrapper {
          flex: 1 1 100%;
          min-width: 0;
          position: relative;
        }
        /* Mobile: 1 panel per row */
        @media (min-width: 640px) {
          #${gridId} > .panel-wrapper {
            flex: 1 1 calc(50% - 0.75rem);
          }
        }
        /* Tablet/Desktop: 3 panels per row (max) */
        @media (min-width: 1024px) {
          #${gridId} > .panel-wrapper {
            flex: 1 1 calc(33.333% - 1rem);
          }
        }
        /* Large screens: 4 panels per row */
        @media (min-width: 1280px) {
          #${gridId} > .panel-wrapper {
            flex: 1 1 calc(25% - 1.125rem);
          }
        }
        /* XL screens: 5 panels per row */
        @media (min-width: 1536px) {
          #${gridId} > .panel-wrapper {
            flex: 1 1 calc(20% - 1.2rem);
          }
        }
        
        
        /* Supporting documents container */
        .${sectionClassId} .supporting-documents-container {
          width: 100%;
        }
        
        .${sectionClassId} .supporting-documents-title-button {
          background: none;
          border: none;
          padding: 0;
          cursor: pointer;
        }
        
        .${sectionClassId} .supporting-documents-title-button:hover {
          opacity: 0.8;
        }
        
        .${sectionClassId} .supporting-documents-grid {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }
        
        .${sectionClassId} .supporting-document-item {
          width: 100%;
        }
        
        .${sectionClassId} .supporting-document-item > div {
          margin-bottom: 0 !important;
        }
        
        .${sectionClassId} .edit-controls-container {
          display: flex;
          flex-direction: column;
          gap: 1rem;
          width: 100%;
        }
        
        .${sectionClassId} .edit-controls-buttons {
          display: flex;
          justify-content: flex-start;
          align-items: center;
          gap: 0.5rem;
        }
      `}</style>
      <div
        ref={sectionRef}
        className={`section ${sectionClassId} px-4 sm:px-6 lg:px-8 border-2 border-white `}
        data-section-id={sectionId}
        data-has-table={hasTableWidget ? 'true' : 'false'}
        data-has-explicit-span={hasExplicitTableSpan ? 'true' : 'false'}
        data-edit-mode={isEditMode ? 'true' : 'false'}
        data-column-span={columnSpan}
        style={{
          gridColumn: `span ${columnSpan}`,
          width: '100%',
          borderRadius: '10px',
          backgroundColor: '#FFFFFF',
          ...(isEditMode && sectionHeight ? { 
            height: `${sectionHeight}px`,
            minHeight: `${sectionHeight}px`
          } : {
            // Ensure no min-height when not in edit mode
            minHeight: 'auto',
            height: 'auto'
          }),
        }}
      >
        {sectionToRender['section-title'] && (
          <h2 className="text-xl font-semibold mb-4" style={{ marginTop: '35px' }}>{translateConfig(sectionToRender['section-title'])}</h2>
        )}
        <div 
          id={gridId} 
          className="section-panels"
          style={mode === 'RegistryView' && hideEditButton ? { paddingBottom: '40px' } : {}}
        >
          {editableSection.panels.map((panel, index) => (
            <div
              key={panel['panel-id'] || `section-panel-${index}`}
              className="panel-wrapper"
            >
              <PanelRenderer
                panel={panel}
                dataSourceRequestHandler={dataSourceRequestHandler}
                schemaData={namespacedSchemaData}
                onValueChange={onValueChange}
              />
            </div>
          ))}
          {/* CRView Mode - Show Created by / Approved by information */}
          {mode === 'CRView' && crViewData && (
            <>
              <hr className="border-gray-300 w-full" style={{ height: '1px', marginTop: '20px', marginBottom: '0px' }} />
              <div className="cr-view-container" style={{ 
              marginTop: '20px',
              paddingBottom: '30px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              width: '100%',
            }}>
              {/* Created by section - Left aligned */}
              <div className="created-by-section" style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                flex: 1,
              }}>
                <span style={{
                  fontFamily: 'Roboto, sans-serif',
                  fontSize: '14px',
                  color: '#000000',
                  fontWeight: 'normal',
                }}>
                  Created by
                </span>
                {/* Person icon */}
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M8 8C9.47276 8 10.6667 6.80609 10.6667 5.33333C10.6667 3.86058 9.47276 2.66667 8 2.66667C6.52724 2.66667 5.33333 3.86058 5.33333 5.33333C5.33333 6.80609 6.52724 8 8 8Z" fill="#ED7C22"/>
                  <path d="M8 9.33333C5.42267 9.33333 3.33333 11.4227 3.33333 14H12.6667C12.6667 11.4227 10.5773 9.33333 8 9.33333Z" fill="#ED7C22"/>
                </svg>
                {crViewData?.createdBy && (
                  <span style={{
                    fontFamily: 'Roboto, sans-serif',
                    fontSize: '14px',
                    color: '#000000',
                    fontWeight: 'normal',
                  }}>
                    {crViewData.createdBy}
                  </span>
                )}
                {/* Calendar icon */}
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ marginLeft: '6px' }}>
                  <path d="M12.6667 2.66667H12V2C12 1.63181 11.7015 1.33333 11.3333 1.33333C10.9651 1.33333 10.6667 1.63181 10.6667 2V2.66667H5.33333V2C5.33333 1.63181 5.03486 1.33333 4.66667 1.33333C4.29848 1.33333 4 1.63181 4 2V2.66667H3.33333C2.59695 2.66667 2 3.26362 2 4V13.3333C2 14.0697 2.59695 14.6667 3.33333 14.6667H12.6667C13.403 14.6667 14 14.0697 14 13.3333V4C14 3.26362 13.403 2.66667 12.6667 2.66667ZM12.6667 13.3333H3.33333V6.66667H12.6667V13.3333Z" fill="#ED7C22"/>
                </svg>
                {crViewData?.createdDate && (
                  <span style={{
                    fontFamily: 'Roboto, sans-serif',
                    fontSize: '14px',
                    color: '#000000',
                    fontWeight: 'normal',
                  }}>
                    {crViewData.createdDate}
                  </span>
                )}
              </div>

              {/* Approved by section - Right aligned */}
              <div className="approved-by-section" style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                flex: 1,
                justifyContent: 'flex-end',
              }}>
                <span style={{
                  fontFamily: 'Roboto, sans-serif',
                  fontSize: '14px',
                  color: '#000000',
                  fontWeight: 'normal',
                }}>
                  Approved by
                </span>
                {/* Person icon */}
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M8 8C9.47276 8 10.6667 6.80609 10.6667 5.33333C10.6667 3.86058 9.47276 2.66667 8 2.66667C6.52724 2.66667 5.33333 3.86058 5.33333 5.33333C5.33333 6.80609 6.52724 8 8 8Z" fill="#ED7C22"/>
                  <path d="M8 9.33333C5.42267 9.33333 3.33333 11.4227 3.33333 14H12.6667C12.6667 11.4227 10.5773 9.33333 8 9.33333Z" fill="#ED7C22"/>
                </svg>
                {crViewData?.approvedBy && (
                  <span style={{
                    fontFamily: 'Roboto, sans-serif',
                    fontSize: '14px',
                    color: '#000000',
                    fontWeight: 'normal',
                  }}>
                    {crViewData.approvedBy}
                  </span>
                )}
                {/* Calendar icon */}
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ marginLeft: '6px' }}>
                  <path d="M12.6667 2.66667H12V2C12 1.63181 11.7015 1.33333 11.3333 1.33333C10.9651 1.33333 10.6667 1.63181 10.6667 2V2.66667H5.33333V2C5.33333 1.63181 5.03486 1.33333 4.66667 1.33333C4.29848 1.33333 4 1.63181 4 2V2.66667H3.33333C2.59695 2.66667 2 3.26362 2 4V13.3333C2 14.0697 2.59695 14.6667 3.33333 14.6667H12.6667C13.403 14.6667 14 14.0697 14 13.3333V4C14 3.26362 13.403 2.66667 12.6667 2.66667ZM12.6667 13.3333H3.33333V6.66667H12.6667V13.3333Z" fill="#ED7C22"/>
                </svg>
                {crViewData?.approvedDate && (
                  <span style={{
                    fontFamily: 'Roboto, sans-serif',
                    fontSize: '14px',
                    color: '#000000',
                    fontWeight: 'normal',
                  }}>
                    {crViewData.approvedDate}
                  </span>
                )}
              </div>
            </div>
            </>
          )}
          {/* RegistryView Mode - Show edit button (if not hidden) */}
          {mode === 'RegistryView' && !hideEditButton && (
            <hr className="border-gray-300 w-full" style={{ height: '1px', marginTop: !isEditMode ? '20px' : 0, marginBottom: '14px' }} />
          )}
          {mode === 'RegistryView' && !isEditMode && !hideEditButton && (
            <div className="flex justify-center items-center" style={{ marginBottom: '20px' }}>
              <button
                onClick={handleEdit}
                className="font-normal inline-flex items-center gap-2 bg-transparent border-0 p-0 cursor-pointer hover:opacity-80"
                style={{ 
                  fontFamily: 'Roboto, sans-serif',
                  fontSize: '16px',
                  color: 'rgba(0, 0, 0, 0.50)'
                }}
              >
                Edit Details
                <span>→</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
};
