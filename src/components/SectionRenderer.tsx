import { useState, useMemo, useCallback } from 'react';
import { useStore, useDispatch } from 'react-redux';
import { setValues } from '../store/widgetSlice';
import { SectionConfig, PanelConfig } from '../types';
import { UseBaseWidgetOptions } from '../hooks/useBaseWidget';
import { PanelRenderer } from './PanelRenderer';
import { useWidgetTranslation } from '../hooks/useWidgetTranslation';
import { getValueByPath, setWidgetValue } from '../utils/pathUtils';
import { useWidgetContext } from './WidgetProvider';


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
  
  // Debug: Log the column span calculation
  // console.log('Section column span:', { 
  //   sectionId, 
  //   gridColumnSpan, 
  //   tableWidgetColumnSpan, 
  //   hasTableWidget, 
  //   verticalPanelsCount, 
  //   columnSpan, 
  //   hasExplicitTableSpan 
  // });

  // Edit mode state
  const [isEditMode, setIsEditMode] = useState(false);

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
      snapshot[dataPath] = getValueByPath(sourceData, dataPath);
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

      if (widgetId) {
        let oldValue = getValueByPath(oldSchemaData, dataPath);
        newStoreValues = setWidgetValue(
          newStoreValues,
          dataPath,
          widgetId,
          oldValue
        );
      }
    });

    if (newStoreValues !== currentStoreValues) {
      dispatch(setValues(newStoreValues));
    }

    setIsEditMode(false);
  };

  return (
    <>
      <style>{`
        .${sectionClassId} {
          /* Section spans grid columns based on vertical panel count */
          /* This ensures all sections align to the same grid boundaries */
          width: 100%;
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
      `}</style>
      <div
        className={`section ${sectionClassId} px-4 sm:px-6 lg:px-8 border-2 rounded-lg border-gray-300`}
        data-section-id={sectionId}
        data-has-table={hasTableWidget ? 'true' : 'false'}
        data-has-explicit-span={hasExplicitTableSpan ? 'true' : 'false'}
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
          <div className="flex justify-center items-center py-4">
            {!isEditMode ? (
              <button
                onClick={handleEdit}
                className="text-blue-600 bg-gray-200 hover:text-blue-800 text-sm font-medium inline-flex items-center px-2 py-2 rounded-md hover:bg-blue-50 transition-colors"
              >
                Edit details
                <span className="ml-1">→</span>
              </button>
            ) : (
              <div className="flex gap-2">
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
            )}
          </div>
        </div>
      </div>
    </>
  );
};
