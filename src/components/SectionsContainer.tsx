import React from 'react';
import { SectionConfig } from '../types';
import { UseBaseWidgetOptions } from '../hooks/useBaseWidget';
import { SectionRenderer } from './SectionRenderer';

export interface SectionsContainerProps {
  sections: SectionConfig[];
  apiAdapter?: UseBaseWidgetOptions['apiAdapter'];
  schemaData?: UseBaseWidgetOptions['schemaData'];
  onValueChange?: UseBaseWidgetOptions['onValueChange'];
  className?: string;
}

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
}: SectionsContainerProps) => {
  // Find the maximum number of vertical panels across all sections
  // This determines the grid size (minimum 3 columns)
  const maxVerticalPanels = Math.max(
    ...sections.map(section => countVerticalPanels(section.panels)),
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

        /* Responsive fallback for smaller screens */
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
          const verticalPanelsCount = countVerticalPanels(section.panels);
          return (
            <SectionRenderer
              key={section['section-id']}
              section={section}
              apiAdapter={apiAdapter}
              schemaData={schemaData}
              onValueChange={onValueChange}
              gridColumnSpan={verticalPanelsCount}
            />
          );
        })}
      </div>
    </>
  );
};
