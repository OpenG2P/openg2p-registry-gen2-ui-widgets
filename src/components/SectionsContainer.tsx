import { SectionConfig } from '../types';
import { UseBaseWidgetOptions } from '../hooks/useBaseWidget';
import { SectionRenderer, SectionChanges } from './SectionRenderer';

export type SectionMode = 'RegistryView' | 'CRView';

export interface SectionsContainerProps {
  sections: SectionConfig[];
  apiAdapter?: UseBaseWidgetOptions['apiAdapter'];
  schemaData?: UseBaseWidgetOptions['schemaData'];
  onValueChange?: UseBaseWidgetOptions['onValueChange'];
  className?: string;
  onSectionSave?: (changes: SectionChanges) => Promise<void> | void;
  hideEditButton?: boolean; // Hide the edit button band below sections
  mode?: SectionMode; // Display mode: 'RegistryView' (default) or 'CRView'
  // CRView data is read from schemaData with keys: createdBy, createdDate, approvedBy, approvedDate
}

/**
 * Recursively check if a panel contains a table widget
 */
const hasTableWidget = (panels: SectionConfig['panels']): boolean => {
  for (const panel of panels) {
    // Check widgets in this panel
    if (panel.widgets) {
      for (const widget of panel.widgets) {
        if (widget.widget === 'table' || widget['widget-type'] === 'table') {
          return true;
        }
      }
    }
    // Recursively check nested panels
    if (panel.panels) {
      if (hasTableWidget(panel.panels)) {
        return true;
      }
    }
  }
  return false;
};

/**
 * Recursively get table widget column span from panels
 */
const getTableWidgetColumnSpan = (panels: SectionConfig['panels']): number | null => {
  for (const panel of panels) {
    // Check widgets in this panel
    if (panel.widgets) {
      for (const widget of panel.widgets) {
        if (widget.widget === 'table' || widget['widget-type'] === 'table') {
          // Return the widget's column span if specified, otherwise null
          return widget['widget-column-span'] || null;
        }
      }
    }
    // Recursively check nested panels
    if (panel.panels) {
      const nestedSpan = getTableWidgetColumnSpan(panel.panels);
      if (nestedSpan !== null) {
        return nestedSpan;
      }
    }
  }
  return null;
};

/**
 * Recursively count all vertical panels in a section
 * Handles nested structure: horizontal panels containing vertical panels
 */
const countVerticalPanels = (panels: SectionConfig['panels']): number => {
  let count = 0;
  for (const panel of panels) {
    const orientation = panel['panel-orientation'] || 'vertical';

    if (orientation === 'horizontal' && panel.panels) {
      // For horizontal panels, count all vertical panels nested inside
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

/**
 * Container component that renders multiple sections
 * 
 * Layout behavior:
 * - Uses CSS Grid for proper alignment
 * - Each grid column = 200px (one vertical panel width)
 * - Sections span columns based on their total vertical panel count
 * - All sections align to the same grid, ensuring right-side alignment
 * - Handles nested structure: multiple horizontal panels, each with multiple vertical panels
 */
export const SectionsContainer = ({
  sections,
  apiAdapter,
  schemaData,
  onValueChange,
  className = '',
  onSectionSave,
  hideEditButton = false,
  mode = 'RegistryView',
}: SectionsContainerProps) => {
  // Find the maximum number of vertical panels across all sections
  // This determines the grid size (minimum 3 columns)
  // Also account for table widgets and their explicit column spans
  const maxVerticalPanels = Math.max(
    ...sections.map(section => {
      const panelCount = countVerticalPanels(section.panels);
      const tableWidgetSpan = getTableWidgetColumnSpan(section.panels);
      // Use explicit table widget span if specified, otherwise use default logic
      return tableWidgetSpan !== null 
        ? Math.max(panelCount, tableWidgetSpan)
        : (hasTableWidget(section.panels) ? Math.max(panelCount, 2) : panelCount);
    }),
    3 // Minimum 3 columns
  );

  const containerId = 'sections-container-grid';

  return (
    <>
      <style>{`
        #${containerId} {
          display: grid;
          /* Flexible columns: minimum 200px, but can grow equally to fill width */
          grid-template-columns: repeat(${maxVerticalPanels}, minmax(200px, 1fr));
          gap: 1.5rem;
          width: 100%;
          align-items: start;
        }

        /* Sections with table widgets should expand to fill available space only if no explicit span */
        #${containerId} > .section[data-has-table="true"][data-has-explicit-span="false"] {
          grid-column: 1 / -1; /* Span all columns */
          width: 100%;
        }
        
        /* Sections with explicit table widget span - inline style will handle grid-column */
        /* This rule ensures width is 100% but doesn't override grid-column */
        #${containerId} > .section[data-has-explicit-span="true"] {
          width: 100%;
        }

        /* Responsive: on smaller screens, use auto-fit for flexibility */
        @media (max-width: 1023px) {
          #${containerId} {
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          }
        }
      `}</style>
      <div
        id={containerId}
        className={`sections-container ${className}`}
      >
        {sections.map((section) => {
          // Check if section has explicit column span
          if (section['section-column-span']) {
            return (
              <SectionRenderer
                key={section['section-id']}
                section={section}
                apiAdapter={apiAdapter}
                schemaData={schemaData}
                onValueChange={onValueChange}
                gridColumnSpan={section['section-column-span']}
                onSectionSave={onSectionSave}
                hideEditButton={hideEditButton}
                mode={mode}
              />
            );
          }
          
          const verticalPanelsCount = countVerticalPanels(section.panels);
          const tableWidgetColumnSpan = getTableWidgetColumnSpan(section.panels);
          const containsTable = hasTableWidget(section.panels);
          // If section contains a table widget with explicit column span, use it
          // Otherwise, if it has a table widget, ensure it spans at least 2 columns
          // Otherwise, use the vertical panel count
          const columnSpan = tableWidgetColumnSpan !== null 
            ? tableWidgetColumnSpan 
            : (containsTable ? Math.max(verticalPanelsCount, 2) : verticalPanelsCount);
          return (
            <SectionRenderer
              key={section['section-id']}
              section={section}
              apiAdapter={apiAdapter}
              schemaData={schemaData}
              onValueChange={onValueChange}
              gridColumnSpan={columnSpan}
              onSectionSave={onSectionSave}
              hideEditButton={hideEditButton}
              mode={mode}
            />
          );
        })}
      </div>
    </>
  );
};
