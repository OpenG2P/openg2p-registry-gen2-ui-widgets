import React from 'react';
import { BaseWidgetConfig, WidgetContextValue } from '../types';
import { useBaseWidget, UseBaseWidgetOptions } from '../hooks/useBaseWidget';
import { widgetRegistry } from '../registry/WidgetRegistry';
import { useWidgetContext } from './WidgetProvider';

export interface WidgetRendererProps extends Omit<UseBaseWidgetOptions, 'config'> {
  config: BaseWidgetConfig;
  defaultComponent?: React.ComponentType<any>;
}

export const WidgetRenderer = ({
  config,
  apiAdapter: propApiAdapter,
  schemaData: propSchemaData,
  onValueChange,
  defaultComponent,
}: WidgetRendererProps) => {
  // Use context values as fallback
  const context = useWidgetContext();
  const apiAdapter = propApiAdapter || context.apiAdapter;
  const schemaData = propSchemaData || context.schemaData;

  const widgetContext = useBaseWidget({
    config,
    apiAdapter,
    schemaData,
    onValueChange,
  });

  // Don't render if not visible
  if (!widgetContext.isVisible) {
    return null;
  }

  // Render widget using registry
  return (
    <div className="widget-container" data-widget-id={widgetContext.widgetId}>
      {widgetRegistry.render(config, widgetContext, defaultComponent)}
    </div>
  );
};

