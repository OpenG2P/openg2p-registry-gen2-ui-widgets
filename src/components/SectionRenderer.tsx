import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useStore, useDispatch } from 'react-redux';
import { setValues } from '../store/widgetSlice';
import { SectionConfig, PanelConfig, SupportingDocumentConfig } from '../types';
import { UseBaseWidgetOptions } from '../hooks/useBaseWidget';
import { PanelRenderer } from './PanelRenderer';
import { useWidgetTranslation } from '../hooks/useWidgetTranslation';
import { getValueByPath, setWidgetValue } from '../utils/pathUtils';
import { useWidgetContext } from './WidgetProvider';
import { FileInputWidget } from '../widgets/FileInputWidget';


export interface SectionChanges {
  section_id: string;
  section_schema: SectionConfig;
  old_section_value: unknown;
  new_section_value: unknown;
}

export interface SectionRendererProps {
  section: SectionConfig;
  apiAdapter?: UseBaseWidgetOptions['apiAdapter'];
  schemaData?: UseBaseWidgetOptions['schemaData'];
  onValueChange?: UseBaseWidgetOptions['onValueChange'];
  gridColumnSpan?: number; // Number of grid columns this section should span
  onSectionSave?: (changes: SectionChanges) => Promise<void> | void;
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
  apiAdapter,
  schemaData,
  onValueChange,
  gridColumnSpan,
  onSectionSave,
}: SectionRendererProps) => {
  const { translateConfig } = useWidgetTranslation();
  const { schemaData: contextSchemaData } = useWidgetContext();
  const store = useStore();
  const dispatch = useDispatch();

  const sectionId = section['section-id'];
  const gridId = `section-panels-${sectionId}`;
  const sectionClassId = `section-${sectionId}`;

  // Recursively count all vertical panels, especially those nested inside horizontal panels
  // Typically: horizontal panels at first level contain vertical panels at second level
  const countVerticalPanels = (panels: SectionConfig['panels']): number => {
    let count = 0;
    for (const panel of panels) {
      const orientation = panel['panel-orientation'] || 'vertical';

      if (orientation === 'horizontal' && panel.panels) {
        // For horizontal panels, count all vertical panels nested inside (typically second level)
        count += countVerticalPanels(panel.panels);
      } else if (orientation === 'vertical') {
        // Count this vertical panel
        count += 1;
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

  const hasTableWidget = checkForTableWidget(section.panels);
  const tableWidgetColumnSpan = getTableWidgetColumnSpan(section.panels);

  const verticalPanelsCount = countVerticalPanels(section.panels);
  // If section contains a table widget with explicit column span, use it
  // Otherwise, if it has a table widget, ensure it spans at least 2 columns
  // Otherwise, use the vertical panel count
  const columnSpan = gridColumnSpan || 
    (tableWidgetColumnSpan !== null ? tableWidgetColumnSpan : 
     (hasTableWidget ? Math.max(verticalPanelsCount, 2) : verticalPanelsCount));
  
  // Check if table widget has explicit column span (not default)
  const hasExplicitTableSpan = tableWidgetColumnSpan !== null;
  
  // Supporting documents configuration
  const supportingDocuments = section['section-supporting-documents'] || [];
  const hasSupportingDocuments = supportingDocuments.length > 0;
  
  // Edit mode state
  const [isEditMode, setIsEditMode] = useState(false);
  const sectionRef = useRef<HTMLDivElement>(null);
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
    }
  }, [isEditMode]);

  // Recursively modify panels to set readonly based on edit mode
  const makePanelsEditable = (panels: PanelConfig[], editable: boolean): PanelConfig[] => {
    return panels.map(panel => {
      const modifiedPanel: PanelConfig = {
        ...panel,
        panels: panel.panels ? makePanelsEditable(panel.panels, editable) : undefined,
        widgets: panel.widgets?.map(widget => ({
          ...widget,
          'widget-readonly': editable ? false : widget['widget-readonly'],
        })),
      };
      return modifiedPanel;
    });
  };

  // Create editable version of section when in edit mode
  const editableSection = useMemo(() => {
    if (!isEditMode) return section;
    return {
      ...section,
      panels: makePanelsEditable(section.panels, true),
    };
  }, [section, isEditMode]);

  // Handle edit button click
  const handleEdit = () => {
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
        `}</style>
        <div
          className={`section ${sectionClassId} ${sectionClassId}-edit px-4 sm:px-6 lg:px-8 border-2 rounded-lg`}
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
          {section['section-title'] && (
            <h2 className="text-xl font-semibold my-4">{translateConfig(section['section-title'])}</h2>
          )}
          <div id={editGridId} className="section-panels">
            {editableSection.panels.map((panel, index) => (
              <div
                key={panel['panel-id'] || `section-panel-${index}`}
                className="panel-wrapper"
              >
                <PanelRenderer
                  panel={panel}
                  apiAdapter={apiAdapter}
                  schemaData={schemaData}
                  onValueChange={onValueChange}
                />
              </div>
            ))}
            <hr className="border-gray-300 my-4 w-full" />
            <div className="edit-controls-container">
              {hasSupportingDocuments && (
                <div className="supporting-documents-container">
                  <div className="supporting-documents-title">
                    {translateConfig('Upload Supporting Documents') || 'Upload Supporting Documents'}
                  </div>
                  <div className="supporting-documents-grid">
                    {supportingDocuments.map((doc, index) => {
                      const docConfig = createDocumentWidgetConfig(doc, sectionId, index);
                      return (
                        <div key={`${sectionId}-doc-${index}`} className="supporting-document-item">
                          <FileInputWidget config={docConfig} />
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
              <div className="edit-controls-buttons">
                <button
                  onClick={handleSave}
                  className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-md transition-colors"
                >
                  Save
                </button>
                <button
                  onClick={handleCancel}
                  className="bg-gray-200 hover:bg-gray-300 text-gray-700 text-sm font-medium px-4 py-2 rounded-md transition-colors"
                >
                  Cancel
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

  const buildSectionSnapshot = (widgets: any[], sourceData: any) => {
    const snapshot: Record<string, any> = {};
    widgets.forEach(widget => {
      const dataPath = widget['widget-data-path'];
      if (!dataPath) return;
      
      // Handle multi-path (object) or single path (string)
      if (typeof dataPath === 'object') {
        // Multi-path: store each path separately
        Object.entries(dataPath).forEach(([key, path]) => {
          if (typeof path === 'string') {
            snapshot[path] = getValueByPath(sourceData, path);
          }
        });
      } else if (typeof dataPath === 'string') {
        snapshot[dataPath] = getValueByPath(sourceData, dataPath);
      }
    });
    return snapshot;
 };

  // Handle save button click
  const handleSave = async () => {
    if (!store || !onSectionSave) {
      console.warn('Missing store or onSectionSave in SectionRenderer');
      setIsEditMode(false);
      return;
    }
    const sectionWidgets = collectWidgets(section.panels)
    const currentState = (store.getState() as any).widget
    const currentSchemaData = currentState.values || {}
    const oldSchemaData = schemaData || contextSchemaData

    const oldSectionValue = buildSectionSnapshot(
      sectionWidgets,
      oldSchemaData
    )

    const newSectionValue = buildSectionSnapshot(
      sectionWidgets,
      currentSchemaData
    )

    // Include supporting documents in the snapshot if they exist
    if (hasSupportingDocuments) {
      supportingDocuments.forEach((doc, index) => {
        const widgetId = `supporting-doc-${sectionId}-${index}`;
        const dataPath = doc['document-data-path'];
        const oldValue = getValueByPath(oldSchemaData, dataPath);
        const newValue = getValueByPath(currentSchemaData, dataPath);
        oldSectionValue[dataPath] = oldValue;
        newSectionValue[dataPath] = newValue;
      });
    }

    if (JSON.stringify(oldSectionValue) !== JSON.stringify(newSectionValue)) {
      const changes: SectionChanges = {
        section_id: sectionId,
        section_schema: section,
        old_section_value: oldSectionValue,
        new_section_value: newSectionValue,
      }

      try {
        await onSectionSave(changes)
      } catch (error) {
        console.error('Section Changes Save failed', error)
      }
    }

    setIsEditMode(false)

  };

 // Handle cancel button click
  const handleCancel = () => {
    // Revert values in store to original schema data
    const sectionWidgets = collectWidgets(section.panels);
    const oldSchemaData = schemaData || contextSchemaData;
    const currentStoreValues = (store.getState() as any).widget.values;
    let newStoreValues = currentStoreValues;

    sectionWidgets.forEach(widget => {
      const widgetId = widget['widget-id'];
      const dataPath = widget['widget-data-path'];

      if (widgetId && dataPath) {
        // Handle multi-path (object) or single path (string)
        let oldValue: any;
        if (typeof dataPath === 'object') {
          // Multi-path: get values for each path
          oldValue = {};
          Object.entries(dataPath).forEach(([key, path]) => {
            if (typeof path === 'string') {
              oldValue[key] = getValueByPath(oldSchemaData, path);
            }
          });
        } else if (typeof dataPath === 'string') {
          oldValue = getValueByPath(oldSchemaData, dataPath);
        }
        
        if (oldValue !== undefined) {
          newStoreValues = setWidgetValue(
            newStoreValues,
            dataPath,
            widgetId,
            oldValue
          );
        }
      }
    });

    // Also revert supporting documents if any
    if (hasSupportingDocuments) {
      supportingDocuments.forEach((doc, index) => {
        const widgetId = `supporting-doc-${sectionId}-${index}`;
        const dataPath = doc['document-data-path'];
        const oldValue = getValueByPath(oldSchemaData, dataPath);
        newStoreValues = setWidgetValue(
          newStoreValues,
          dataPath,
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
    
    return {
      widget: 'file',
      'widget-type': 'input' as const,
      'widget-label': doc['document-label'] || doc['document-data-path'] || `Document ${index + 1}`,
      'widget-id': `supporting-doc-${sectionId}-${index}`,
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
        }
        
        /* Hide original section content when in edit mode */
        .${sectionClassId}[data-edit-mode="true"] {
          visibility: hidden;
        }
        
        /* Edit section styles (rendered via portal, absolutely positioned) */
        .${sectionClassId}-edit {
          box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.2), 
                      0 8px 10px -6px rgba(0, 0, 0, 0.1),
                      0 0 0 3px rgba(59, 130, 246, 0.3);
          border-color: #ED7C22;
          border-style: dashed;
          background-color: #F3E6BC;
          z-index: 1000;
          position: absolute;
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
        }
        #${gridId} > .panel-wrapper {
          flex: 1 1 100%;
          min-width: 0;
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
          margin-top: 1rem;
          padding-top: 1rem;
          border-top: 1px solid #e5e7eb;
        }
        
        .${sectionClassId} .supporting-documents-title {
          font-size: 0.875rem;
          font-weight: 600;
          color: #374151;
          margin-bottom: 0.75rem;
        }
        
        .${sectionClassId} .supporting-documents-grid {
          display: flex;
          flex-direction: column;
          gap: 1rem;
          margin-bottom: 1rem;
        }
        
        .${sectionClassId} .supporting-document-item {
          width: 100%;
        }
        
        .${sectionClassId} .edit-controls-container {
          display: flex;
          flex-direction: column;
          gap: 1rem;
          width: 100%;
        }
        
        .${sectionClassId} .edit-controls-buttons {
          display: flex;
          justify-content: center;
          align-items: center;
          gap: 0.5rem;
        }
      `}</style>
      <div
        ref={sectionRef}
        className={`section ${sectionClassId} px-4 sm:px-6 lg:px-8 border-2 rounded-lg border-gray-300`}
        data-section-id={sectionId}
        data-has-table={hasTableWidget ? 'true' : 'false'}
        data-has-explicit-span={hasExplicitTableSpan ? 'true' : 'false'}
        data-edit-mode={isEditMode ? 'true' : 'false'}
        data-column-span={columnSpan}
        style={{
          gridColumn: `span ${columnSpan}`,
          width: '100%',
        }}
      >
        {section['section-title'] && (
          <h2 className="text-xl font-semibold my-4">{translateConfig(section['section-title'])}</h2>
        )}
        <div id={gridId} className="section-panels">
          {editableSection.panels.map((panel, index) => (
            <div
              key={panel['panel-id'] || `section-panel-${index}`}
              className="panel-wrapper"
            >
              <PanelRenderer
                panel={panel}
                apiAdapter={apiAdapter}
                schemaData={schemaData}
                onValueChange={onValueChange}
              />
            </div>
          ))}
          <hr className="border-gray-300 my-4 w-full" />
          {!isEditMode && (
            <div className="flex justify-center items-center py-4">
              <button
                onClick={handleEdit}
                className="text-blue-600 bg-gray-200 hover:text-blue-800 text-sm font-medium inline-flex items-center px-2 py-2 rounded-md hover:bg-blue-50 transition-colors"
              >
                Edit details
                <span className="ml-1">→</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
};
