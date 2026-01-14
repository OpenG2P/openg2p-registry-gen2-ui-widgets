import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useStore, useDispatch, useSelector } from 'react-redux';
import { setValues } from '../store/widgetSlice';
import { WidgetRootState } from '../store';
import { SectionConfig, PanelConfig, SupportingDocumentConfig } from '../types';
import { UseBaseWidgetOptions } from '../hooks/useBaseWidget';
import { PanelRenderer } from './PanelRenderer';
import { useWidgetTranslation } from '../hooks/useWidgetTranslation';
import { getValueByPath, setWidgetValue } from '../utils/pathUtils';
import { useWidgetContext } from './WidgetProvider';
import { FileInputWidget } from '../widgets/FileInputWidget';
import { SectionMode } from './SectionsContainer';


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
  hideEditButton?: boolean; // Hide the edit button band below the section
  mode?: SectionMode; // Display mode: 'RegistryView' (default) or 'CRView'
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
  apiAdapter,
  schemaData,
  onValueChange,
  gridColumnSpan,
  onSectionSave,
  hideEditButton = false,
  mode = 'RegistryView',
}: SectionRendererProps) => {
  const { translateConfig, translate } = useWidgetTranslation();
  const { schemaData: contextSchemaData } = useWidgetContext();
  const store = useStore();
  const dispatch = useDispatch();

  // Get CRView data from schemaData (prefer prop over context, then Redux store)
  const currentSchemaData = schemaData || contextSchemaData || {};
  const storeValues = useSelector((state: WidgetRootState) => state.widget?.values || {});
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
    // Debug logging (can be removed in production)
    if (mode === 'CRView') {
      console.log('CRView Data Source:', { dataSource, result, currentSchemaData, storeValues });
    }
    return result;
  }, [mode, currentSchemaData, storeValues]);

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
          {section['section-title'] && (
            <h2 className="text-xl font-semibold mb-4" style={{ fontFamily: 'Roboto, sans-serif', marginTop: '35px' }}>{translateConfig(section['section-title'])}</h2>
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
                  apiAdapter={apiAdapter}
                  schemaData={schemaData}
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
                  style={{ fontFamily: 'Roboto, sans-serif', borderRadius: '15px' }}
                >
                  {translate('common.cancel') || 'Cancel'}
                </button>
                <button
                  onClick={handleSave}
                  className="bg-gray-900 hover:bg-gray-800 text-white text-sm font-medium px-6 py-2 transition-colors"
                  style={{ fontFamily: 'Roboto, sans-serif', borderRadius: '15px' }}
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
          border-radius: 30px;
          z-index: 1000;
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
        className={`section ${sectionClassId} px-4 sm:px-6 lg:px-8 border-2 border-gray-300`}
        data-section-id={sectionId}
        data-has-table={hasTableWidget ? 'true' : 'false'}
        data-has-explicit-span={hasExplicitTableSpan ? 'true' : 'false'}
        data-edit-mode={isEditMode ? 'true' : 'false'}
        data-column-span={columnSpan}
        style={{
          gridColumn: `span ${columnSpan}`,
          width: '100%',
          borderRadius: '30px',
          backgroundColor: '#FFFFFF',
          ...(isEditMode && sectionHeight ? { 
            height: `${sectionHeight}px`,
            minHeight: `${sectionHeight}px`
          } : {}),
        }}
      >
        {section['section-title'] && (
          <h2 className="text-xl font-semibold mb-4" style={{ marginTop: '35px' }}>{translateConfig(section['section-title'])}</h2>
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
                apiAdapter={apiAdapter}
                schemaData={schemaData}
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
