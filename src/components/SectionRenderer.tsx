import React from 'react';
import { SectionConfig } from '../types';
import { UseBaseWidgetOptions } from '../hooks/useBaseWidget';
import { PanelRenderer } from './PanelRenderer';

export interface SectionRendererProps {
  section: SectionConfig;
  apiAdapter?: UseBaseWidgetOptions['apiAdapter'];
  schemaData?: UseBaseWidgetOptions['schemaData'];
  onValueChange?: UseBaseWidgetOptions['onValueChange'];
}

/**
 * Renders a section with its panels
 */
export const SectionRenderer: React.FC<SectionRendererProps> = ({
  section,
  apiAdapter,
  schemaData,
  onValueChange,
}) => {
  return (
    <div className="section" data-section-id={section['section-id']}>
      {section['section-title'] && (
        <h2 className="text-xl font-semibold mb-4">{section['section-title']}</h2>
      )}
      <div className="section-panels">
        {section.panels.map((panel, index) => (
          <PanelRenderer
            key={panel['panel-id'] || `section-panel-${index}`}
            panel={panel}
            apiAdapter={apiAdapter}
            schemaData={schemaData}
            onValueChange={onValueChange}
          />
        ))}
      </div>
    </div>
  );
};

