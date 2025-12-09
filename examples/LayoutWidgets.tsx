import React from 'react';
import { WidgetRenderer, BaseWidgetConfig, UseBaseWidgetOptions } from '../src';

/**
 * Example: Vertical layout widget
 * 
 * Usage in schema:
 * {
 *   "widget": "vertical-layout",
 *   "widget-type": "layout",
 *   "widgets": [
 *     { ... widget configs ... }
 *   ]
 * }
 */
export const VerticalLayoutWidget: React.FC<{
  config: BaseWidgetConfig;
  apiAdapter?: UseBaseWidgetOptions['apiAdapter'];
  schemaData?: UseBaseWidgetOptions['schemaData'];
  onValueChange?: UseBaseWidgetOptions['onValueChange'];
}> = ({ config, apiAdapter, schemaData, onValueChange }) => {
  const widgets = config.widgets || [];

  return (
    <div className="flex flex-col space-y-4">
      {widgets.map((widgetConfig: BaseWidgetConfig, index: number) => (
        <WidgetRenderer
          key={widgetConfig['widget-id'] || index}
          config={widgetConfig}
          apiAdapter={apiAdapter}
          schemaData={schemaData}
          onValueChange={onValueChange}
        />
      ))}
    </div>
  );
};

/**
 * Example: Horizontal layout widget
 * 
 * Usage in schema:
 * {
 *   "widget": "horizontal-layout",
 *   "widget-type": "layout",
 *   "widgets": [
 *     { ... widget configs ... }
 *   ]
 * }
 */
export const HorizontalLayoutWidget: React.FC<{
  config: BaseWidgetConfig;
  apiAdapter?: UseBaseWidgetOptions['apiAdapter'];
  schemaData?: UseBaseWidgetOptions['schemaData'];
  onValueChange?: UseBaseWidgetOptions['onValueChange'];
}> = ({ config, apiAdapter, schemaData, onValueChange }) => {
  const widgets = config.widgets || [];

  return (
    <div className="flex flex-row space-x-4">
      {widgets.map((widgetConfig: BaseWidgetConfig, index: number) => (
        <WidgetRenderer
          key={widgetConfig['widget-id'] || index}
          config={widgetConfig}
          apiAdapter={apiAdapter}
          schemaData={schemaData}
          onValueChange={onValueChange}
        />
      ))}
    </div>
  );
};

