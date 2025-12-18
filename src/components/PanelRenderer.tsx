import React from 'react';
import { PanelConfig } from '../types';
import { UseBaseWidgetOptions } from '../hooks/useBaseWidget';
import { WidgetRenderer } from './WidgetRenderer';
import { useWidgetTranslation } from '../hooks/useWidgetTranslation';

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
  const { translateConfig } = useWidgetTranslation();
  const orientation = panel['panel-orientation'] || 'vertical';
  const nestedPanels = panel.panels || [];
  const widgets = panel.widgets || [];

  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/e62c6601-d40c-4700-97c4-c232bd6729bc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'PanelRenderer.tsx:33',message:'PanelRenderer entry',data:{panelId:panel['panel-id'],orientation,nestedPanelsCount:nestedPanels.length,widgetsCount:widgets.length},timestamp:Date.now(),sessionId:'debug-session',runId:'initial',hypothesisId:'B'})}).catch(()=>{});
  // #endregion

  // For horizontal orientation, use grid for equal-width columns
  // Dynamic grid based on number of nested panels
  // For vertical orientation, use flex column
  const getContainerClassAndStyle = () => {
    if (orientation === 'horizontal' && nestedPanels.length > 0) {
      const numPanels = nestedPanels.length;
      // Use predefined grid classes based on number of panels (1-5)
      // For more than 5, use inline style
      console.log('numPanels', numPanels);
      if (numPanels <= 5) {
        const gridClasses: Record<number, string> = {
          1: 'grid grid-cols-1 gap-4',
          2: 'grid grid-cols-2 gap-4',
          3: 'grid grid-cols-3 gap-4',
          4: 'grid grid-cols-4 gap-4',
          5: 'grid grid-cols-5 gap-4',
        };
        return { className: gridClasses[numPanels] || 'grid gap-4', style: {} };
      } else {
        // For more than 5 panels, use inline style
        return {
          className: 'grid gap-4',
          style: { gridTemplateColumns: `repeat(${numPanels}, minmax(0, 1fr))` },
        };
      }
    }
    return {
      className: orientation === 'horizontal'
        ? 'flex flex-row space-x-4'
        : 'flex flex-col space-y-4',
      style: {},
    };
  };

  const { className: containerClass, style: containerStyle } = getContainerClassAndStyle();

  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/e62c6601-d40c-4700-97c4-c232bd6729bc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'PanelRenderer.tsx:68',message:'Container class computed',data:{panelId:panel['panel-id'],orientation,containerClass,containerStyle,nestedPanelsCount:nestedPanels.length},timestamp:Date.now(),sessionId:'debug-session',runId:'initial',hypothesisId:'A'})}).catch(()=>{});
  // #endregion

  const content = (
    <div 
      className={containerClass} 
      style={{
        // Panels should always take full width of their container
        // Orientation only affects how content is arranged inside
        width: '100%',
        ...containerStyle
      }}
    >
      {/* Render nested panels */}
      {nestedPanels.map((nestedPanel, index) => {
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/e62c6601-d40c-4700-97c4-c232bd6729bc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'PanelRenderer.tsx:87',message:'Rendering nested panel',data:{parentPanelId:panel['panel-id'],nestedPanelId:nestedPanel['panel-id'],index,orientation,nestedPanelOrientation:nestedPanel['panel-orientation']},timestamp:Date.now(),sessionId:'debug-session',runId:'initial',hypothesisId:'D'})}).catch(()=>{});
        // #endregion
        return (
          <div 
            key={nestedPanel['panel-id'] || `panel-${index}`} 
            className={orientation === 'horizontal' ? 'min-w-200  border--300 float-left' : 'w-full'}
            style={orientation === 'horizontal' ? { width: '200px' ,float:'left'} : {width:'100%'}}
          > 
            <PanelRenderer
              panel={nestedPanel}
              apiAdapter={apiAdapter}
              schemaData={schemaData}
              onValueChange={onValueChange}
            />
          </div>
        );
      })}
      
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
  );

  // Render panel without card styling (panel-type removed from schema)
  // Vertical panels will have constrained width via CSS in SectionRenderer
  // Horizontal panels take full width
  return (
    <div 
      className={`panel panel-${orientation}`} 
      data-panel-id={panel['panel-id']}
      style={orientation === 'horizontal' ? { width: '100%' } : {}}
    >
      {content}
    </div>
  );
};
