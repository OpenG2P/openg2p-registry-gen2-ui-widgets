import React, { useState, useCallback, useEffect } from 'react';
import { SectionConfig, PanelConfig, BaseWidgetConfig } from '../../types';
import { JSONEditorPanel } from './JSONEditorPanel';
import { VisualBuilderPanel } from './VisualBuilderPanel';
import { TreeNode } from './SectionTree';

export interface SectionBuilderProps {
  initialSection?: SectionConfig;
  onChange?: (section: SectionConfig) => void;
  onSave?: (section: SectionConfig) => void;
}

/**
 * Main Section Builder Component
 * Provides dual-panel interface for editing section JSON
 */
export const SectionBuilder: React.FC<SectionBuilderProps> = ({
  initialSection,
  onChange,
  onSave,
}) => {
  const [section, setSection] = useState<SectionConfig>(
    initialSection || {
      'section-id': 'new-section',
      'section-title': '',
      'section-editable': false,
      panels: [],
    }
  );
  const [selectedNode, setSelectedNode] = useState<TreeNode | null>(null);

  useEffect(() => {
    if (initialSection) {
      setSection(initialSection);
    }
  }, [initialSection]);

  const handleSectionChange = useCallback(
    (updatedSection: SectionConfig) => {
      setSection(updatedSection);
      if (onChange) {
        onChange(updatedSection);
      }
    },
    [onChange]
  );

  const handleAddPanel = useCallback(
    (parentId: string, parentType: 'section' | 'panel' | 'widget') => {
      const updatedSection = JSON.parse(JSON.stringify(section));
      const newPanel: PanelConfig = {
        'panel-id': `panel-${Date.now()}`,
        'panel-orientation': 'vertical',
        widgets: [],
      };

      if (parentType === 'section') {
        updatedSection.panels = [...(updatedSection.panels || []), newPanel];
      } else if (parentType === 'panel') {
        const addPanelToParent = (panels: PanelConfig[]): boolean => {
          for (const panel of panels) {
            if (panel['panel-id'] === parentId) {
              panel.panels = [...(panel.panels || []), newPanel];
              return true;
            }
            if (panel.panels && addPanelToParent(panel.panels)) {
              return true;
            }
          }
          return false;
        };
        if (updatedSection.panels) {
          addPanelToParent(updatedSection.panels);
        }
      }

      handleSectionChange(updatedSection);
    },
    [section, handleSectionChange]
  );

  const handleAddWidget = useCallback(
    (parentId: string) => {
      const updatedSection = JSON.parse(JSON.stringify(section));
      const newWidget: BaseWidgetConfig = {
        widget: 'text',
        'widget-id': `widget-${Date.now()}`,
        'widget-label': 'New Widget',
        'widget-data-path': '',
      };

      const addWidgetToPanel = (panels: PanelConfig[]): boolean => {
        for (const panel of panels) {
          if (panel['panel-id'] === parentId) {
            panel.widgets = [...(panel.widgets || []), newWidget];
            return true;
          }
          if (panel.panels && addWidgetToPanel(panel.panels)) {
            return true;
          }
        }
        return false;
      };

      if (updatedSection.panels) {
        addWidgetToPanel(updatedSection.panels);
      }

      handleSectionChange(updatedSection);
    },
    [section, handleSectionChange]
  );

  const handleDeleteNode = useCallback(
    (node: TreeNode) => {
      const updatedSection = JSON.parse(JSON.stringify(section));

      if (node.type === 'section') {
        // Can't delete section, but can reset it
        return;
      }

      const deleteFromSection = (current: any): boolean => {
        if (current.panels) {
          const panelIndex = current.panels.findIndex(
            (p: PanelConfig) => p['panel-id'] === node.id
          );
          if (panelIndex !== -1 && node.type === 'panel') {
            current.panels.splice(panelIndex, 1);
            return true;
          }

          for (const panel of current.panels) {
            if (panel['panel-id'] === node.id && node.type === 'panel') {
              // This shouldn't happen due to findIndex above, but handle nested case
              const index = current.panels.indexOf(panel);
              if (index !== -1) {
                current.panels.splice(index, 1);
                return true;
              }
            }

            if (panel.widgets) {
              const widgetIndex = panel.widgets.findIndex(
                (w: BaseWidgetConfig) => w['widget-id'] === node.id
              );
              if (widgetIndex !== -1 && node.type === 'widget') {
                panel.widgets.splice(widgetIndex, 1);
                return true;
              }
            }

            if (panel.panels && deleteFromSection(panel)) {
              return true;
            }
          }
        }

        return false;
      };

      deleteFromSection(updatedSection);
      handleSectionChange(updatedSection);
      setSelectedNode(null);
    },
    [section, handleSectionChange]
  );

  const handleDuplicateNode = useCallback(
    (node: TreeNode) => {
      const updatedSection = JSON.parse(JSON.stringify(section));

      if (node.type === 'section') {
        return;
      }

      const duplicateInSection = (current: any): boolean => {
        if (current.panels) {
          for (const panel of current.panels) {
            if (panel['panel-id'] === node.id && node.type === 'panel') {
              const duplicated: PanelConfig = {
                ...panel,
                'panel-id': `${panel['panel-id']}-copy-${Date.now()}`,
              };
              const index = current.panels.indexOf(panel);
              current.panels.splice(index + 1, 0, duplicated);
              return true;
            }

            if (panel.widgets) {
              for (const widget of panel.widgets) {
                if (widget['widget-id'] === node.id && node.type === 'widget') {
                  const duplicated: BaseWidgetConfig = {
                    ...widget,
                    'widget-id': `${widget['widget-id']}-copy-${Date.now()}`,
                  };
                  const index = panel.widgets.indexOf(widget);
                  panel.widgets.splice(index + 1, 0, duplicated);
                  return true;
                }
              }
            }

            if (panel.panels && duplicateInSection(panel)) {
              return true;
            }
          }
        }
        return false;
      };

      duplicateInSection(updatedSection);
      handleSectionChange(updatedSection);
    },
    [section, handleSectionChange]
  );

  return (
    <div
      style={{
        display: 'flex',
        height: '100%',
        width: '100%',
        minHeight: 0,
        background: '#f5f5f5',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        overflow: 'hidden',
      }}
    >
      {/* Left Panel: JSON Editor */}
      <div style={{ 
        width: '50%', 
        height: '100%', 
        minHeight: 0,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      }}>
        <JSONEditorPanel section={section} onChange={handleSectionChange} />
      </div>

      {/* Right Panel: Visual Builder */}
      <div style={{ 
        width: '50%', 
        height: '100%', 
        minHeight: 0,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      }}>
        <VisualBuilderPanel
          section={section}
          selectedNode={selectedNode}
          onSelectNode={setSelectedNode}
          onSectionChange={handleSectionChange}
          onAddPanel={handleAddPanel}
          onAddWidget={handleAddWidget}
          onDeleteNode={handleDeleteNode}
          onDuplicateNode={handleDuplicateNode}
        />
      </div>
    </div>
  );
};
