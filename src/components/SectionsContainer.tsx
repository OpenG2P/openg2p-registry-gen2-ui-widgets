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
 * Container component that renders multiple sections
 * 
 * Layout behavior:
 * - Sections can sit side-by-side if there's space
 * - Sections wrap to the next line when they don't fit
 * - Each section occupies width based on max 3 panels (or more on high resolution)
 */
export const SectionsContainer = ({
  sections,
  apiAdapter,
  schemaData,
  onValueChange,
  className = '',
}: SectionsContainerProps) => {
  return (
    <div 
      className={`sections-container flex flex-wrap gap-6 items-start ${className}`}
      style={{
        width: '100%',
      }}
    >
      {sections.map((section) => (
        <SectionRenderer
          key={section['section-id']}
          section={section}
          apiAdapter={apiAdapter}
          schemaData={schemaData}
          onValueChange={onValueChange}
        />
      ))}
    </div>
  );
};
