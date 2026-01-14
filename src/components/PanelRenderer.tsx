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
  isEditMode?: boolean;
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
  isEditMode = false,
}: PanelRendererProps) => {
  const { translateConfig } = useWidgetTranslation();
  const orientation = panel['panel-orientation'] || 'vertical';
  const nestedPanels = panel.panels || [];
  const widgets = panel.widgets || [];

  // For horizontal orientation, use grid for equal-width columns
  // Dynamic grid based on number of nested panels
  // For vertical orientation, use flex column
  const getContainerClassAndStyle = () => {
    if (orientation === 'horizontal' && nestedPanels.length > 0) {
      const numPanels = nestedPanels.length;
      // Use predefined grid classes based on number of panels (1-5)
      // For more than 5, use inline style
      // Removed gap to allow borders to show properly
      console.log('numPanels', numPanels);
      if (numPanels <= 5) {
        const gridClasses: Record<number, string> = {
          1: 'grid grid-cols-1',
          2: 'grid grid-cols-2',
          3: 'grid grid-cols-3',
          4: 'grid grid-cols-4',
          5: 'grid grid-cols-5',
        };
        return { className: gridClasses[numPanels] || 'grid', style: {} };
      } else {
        // For more than 5 panels, use inline style
        return {
          className: 'grid',
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
        const isLastPanel = index === nestedPanels.length - 1;
        const isFirstPanel = index === 0;
        const horizontalStyle = orientation === 'horizontal' 
          ? {
              minWidth: '200px',
              paddingRight: !isLastPanel ? '40px' : undefined,
              paddingLeft: !isFirstPanel ? '40px' : undefined,
              position: 'relative' as const,
            }
          : { width: '100%' };
        return (
          <React.Fragment key={nestedPanel['panel-id'] || `panel-${index}`}>
            <div 
              className={orientation === 'horizontal' ? 'min-w-200 relative' : 'w-full'}
              style={horizontalStyle}
            > 
              <PanelRenderer
                panel={nestedPanel}
                apiAdapter={apiAdapter}
                schemaData={schemaData}
                onValueChange={onValueChange}
                isEditMode={isEditMode}
              />
              {orientation === 'horizontal' && !isLastPanel && (
                <div
                  style={{
                    position: 'absolute',
                    right: 0,
                    top: 0,
                    bottom: 0,
                    width: '1px',
                    backgroundColor: isEditMode ? '#F2BA1A' : '#D1D5DB',
                  }}
                />
              )}
            </div>
          </React.Fragment>
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
