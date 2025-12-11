import React from 'react';
import { PanelConfig } from '../types';
import { UseBaseWidgetOptions } from '../hooks/useBaseWidget';
import { WidgetRenderer } from './WidgetRenderer';

export interface PanelRendererProps {
  panel: PanelConfig;
  apiAdapter?: UseBaseWidgetOptions['apiAdapter'];
  schemaData?: UseBaseWidgetOptions['schemaData'];
  onValueChange?: UseBaseWidgetOptions['onValueChange'];
}

/**
 * Renders a panel with its nested panels or widgets
 * 
 * Panels can contain:
 * - Nested panels (for layout composition)
 * - Widgets (for actual form inputs/controls)
 */
export const PanelRenderer = ({
  panel,
  apiAdapter,
  schemaData,
  onValueChange,
}: PanelRendererProps) => {
  const orientation = panel['panel-orientation'] || 'vertical';
  const nestedPanels = panel.panels || [];
  const widgets = panel.widgets || [];

  const containerClass =
    orientation === 'horizontal'
      ? 'flex flex-row space-x-4'
      : 'flex flex-col space-y-4';

  return (
    <div className={`panel panel-${orientation}`} data-panel-id={panel['panel-id']}>
      <div className={containerClass} style={{ width: '100%' }}>
        {/* Render nested panels */}
        {nestedPanels.map((nestedPanel, index) => (
          <PanelRenderer
            key={nestedPanel['panel-id'] || `panel-${index}`}
            panel={nestedPanel}
            apiAdapter={apiAdapter}
            schemaData={schemaData}
            onValueChange={onValueChange}
          />
        ))}
        
        {/* Render widgets */}
        {widgets.map((widgetConfig, index) => (
          <WidgetRenderer
            key={widgetConfig['widget-id'] || `widget-${index}`}
            config={widgetConfig}
            apiAdapter={apiAdapter}
            schemaData={schemaData}
            onValueChange={onValueChange}
          />
        ))}
      </div>
    </div>
  );
};
