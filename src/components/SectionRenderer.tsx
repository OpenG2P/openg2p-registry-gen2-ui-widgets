import React, { useState, useMemo } from 'react';
import { SectionConfig, PanelConfig } from '../types';
import { UseBaseWidgetOptions } from '../hooks/useBaseWidget';
import { PanelRenderer } from './PanelRenderer';
import { useWidgetTranslation } from '../hooks/useWidgetTranslation';

export interface SectionRendererProps {
  section: SectionConfig;
  apiAdapter?: UseBaseWidgetOptions['apiAdapter'];
  schemaData?: UseBaseWidgetOptions['schemaData'];
  onValueChange?: UseBaseWidgetOptions['onValueChange'];
  gridColumnSpan?: number; // Number of grid columns this section should span
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
}: SectionRendererProps) => {
  const { translateConfig } = useWidgetTranslation();

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

  const verticalPanelsCount = countVerticalPanels(section.panels);
  const columnSpan = gridColumnSpan || verticalPanelsCount;

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

  // Handle save button click
  const handleSave = () => {
    setIsEditMode(false);
    // You can add save logic here, e.g., call an API
  };

  // Handle cancel button click
  const handleCancel = () => {
    setIsEditMode(false);
    // Revert any changes - the original section config will be used
  };

  return (
    <>
      <style>{`
        .${sectionClassId} {
          /* Section spans grid columns based on vertical panel count */
          /* This ensures all sections align to the same grid boundaries */
          grid-column: span ${columnSpan};
          width: 100%;
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
        style={{
          gridColumn: `span ${columnSpan}`,
        }}
      >
        {section['section-title'] && (
          <h2 className="text-xl font-semibold mb-4">{translateConfig(section['section-title'])}</h2>
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
                className="text-blue-600 hover:text-blue-800 text-sm font-medium inline-flex items-center px-4 py-2 rounded-md hover:bg-blue-50 transition-colors"
              >
                Edit details
                <span className="ml-1">→</span>
              </button>
            ) : (
              <>
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
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

