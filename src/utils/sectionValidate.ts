import { setError, setTouched } from "../store/widgetSlice";
import { WidgetDispatch } from "../store";

import {
  SectionConfig,
  PanelConfig,
  BaseWidgetConfig,
} from "../types";
import { shouldShowWidget } from "./conditions";
import { getValueByPath, getWidgetValue } from "./pathUtils";
import { validateWidget } from "./validation";

export const collectWidgets = (panels: PanelConfig[]): BaseWidgetConfig[] => {
  let widgets: BaseWidgetConfig[] = [];
  panels.forEach((panel) => {
    if (panel.widgets) {
      widgets = [...widgets, ...panel.widgets];
    }
    if (panel.panels) {
      widgets = [...widgets, ...collectWidgets(panel.panels)];
    }
  });
  return widgets;
};

export const sectionValidate = (
  section: SectionConfig,
  currentSchemaData: Record<string, any>,
  dispatch: WidgetDispatch
): boolean => {
  const allWidgets = collectWidgets(section.panels);

  let isValid = true;

  for (const widget of allWidgets) {

    const isVisible = shouldShowWidget(
      widget['widget-data-options'],
      currentSchemaData
    );

    if (!isVisible) continue;

    const widgetId = widget['widget-id'];

    const value = getWidgetValue(
      currentSchemaData,
      widget['widget-data-path'],
      widgetId
    );

    const errors = validateWidget(
      value,
      widget['widget-data-validation'],
      widget['widget-required']
    );

    if (errors.length > 0) {
      isValid = false;
      dispatch(setTouched({ widgetId, touched: true }));
      dispatch(setError({ widgetId, errors }));
    } else {
      dispatch(setTouched({ widgetId, touched: false }));
      dispatch(setError({ widgetId, errors: [] }));
    }
  }

  // Supporting Documents
  section['section-supporting-documents']?.forEach((doc, index) => {
    const widgetId = `supporting-doc-${section['section-id']}-${index}`;

    if (doc['document-required']) {

      const file = getValueByPath(
        currentSchemaData,
        doc['document-data-path']
      );



      if (!file) {
        isValid = false;
        dispatch(setTouched({ widgetId, touched: true }));
        dispatch(setError({
          widgetId,
          errors: ['This document is required'],
        }));
      } else {
        dispatch(setTouched({ widgetId, touched: false }));
        dispatch(setError({ widgetId, errors: [] }));
      }
    }
  });

  return isValid;
};
