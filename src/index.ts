// Types
export * from './types';

// Store
export { createWidgetStore } from './store';
export type { WidgetStore, WidgetRootState, WidgetDispatch } from './store';
export * from './store/widgetSlice';

// Hooks
export { useBaseWidget } from './hooks/useBaseWidget';
export type { UseBaseWidgetOptions } from './hooks/useBaseWidget';

// Components
export { WidgetRenderer } from './components/WidgetRenderer';
export { WidgetProvider, useWidgetContext } from './components/WidgetProvider';
export { SectionRenderer } from './components/SectionRenderer';
export { SectionsContainer } from './components/SectionsContainer';
export { PanelRenderer } from './components/PanelRenderer';

// Registry (import defaultWidgets to auto-register widgets)
import './registry/defaultWidgets';
export { widgetRegistry } from './registry/WidgetRegistry';
export type { WidgetRegistryEntry } from './types';
export { registerDefaultWidgets } from './registry/defaultWidgets';

// Widgets (for custom registration or direct use)
export * from './widgets';

// Utils
export * from './utils/pathUtils';
export * from './utils/validation';
export * from './utils/formatting';
export * from './utils/conditions';
export * from './utils/dataSource';

// i18n
export { initI18n } from './i18n/config';
export { useWidgetTranslation } from './hooks/useWidgetTranslation';
export { default as i18n } from './i18n/config';
export { translateUISchema, translateWidgetConfig, translatePanelConfig } from './utils/schemaTranslation';

