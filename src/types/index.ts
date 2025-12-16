import { z } from 'zod';

/**
 * Widget data path can be a string (single path) or object (multi-path)
 */
export type WidgetDataPath = string | Record<string, string>;

/**
 * Data source types
 */
export type DataSourceType = 'static' | 'api' | 'schema';

/**
 * Static data source configuration
 */
export interface StaticDataSource {
  type: 'static';
  options: Array<{ value: string | number; label: string }>;
}

/**
 * API data source configuration
 */
export interface ApiDataSource {
  type: 'api';
  url: string;
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  dependsOn?: string; // Field path this depends on
  valueKey?: string; // Key for value in response
  labelKey?: string; // Key for label in response
  headers?: Record<string, string>;
  body?: Record<string, any>;
}

/**
 * Schema reference data source configuration
 */
export interface SchemaDataSource {
  type: 'schema';
  path: string; // Path to reference data in schema
  valueKey?: string;
  labelKey?: string;
}

export type DataSource = StaticDataSource | ApiDataSource | SchemaDataSource;

/**
 * Validation configuration
 */
export interface WidgetValidation {
  required?: boolean;
  pattern?: string;
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
  custom?: string; // Custom validation function name
  zodSchema?: z.ZodSchema; // Zod schema for validation
}

/**
 * Format configuration
 */
export interface WidgetFormat {
  dateFormat?: string;
  currency?: string;
  locale?: string;
  decimals?: number;
  pattern?: string; // For phone, etc.
  inputType?: 'text' | 'email' | 'password' | 'number' | 'tel' | 'url' | 'search' | 'file'; // HTML input type for text widgets
}

/**
 * Condition operators
 */
export type ConditionOperator =
  | 'equals'
  | 'notEquals'
  | 'notEmpty'
  | 'empty'
  | 'greaterThan'
  | 'lessThan'
  | 'contains'
  | 'notContains';

/**
 * Condition configuration
 */
export interface WidgetCondition {
  field: string; // Field path to check
  operator: ConditionOperator;
  value?: any; // Value to compare (for equals, notEquals, etc.)
}

/**
 * Widget options for conditional behavior
 */
export interface WidgetOptions {
  action?: 'show' | 'hide' | 'enable' | 'disable';
  condition?: WidgetCondition;
  minDate?: string;
  maxDate?: string;
  showCalendar?: boolean;
  [key: string]: any; // Allow widget-specific options
}

/**
 * Base widget configuration
 */
export interface BaseWidgetConfig {
  widget: string; // Widget name/type
  'widget-type'?: 'input' | 'layout' | 'table' | 'group'; // Optional - can be inferred from widget name
  'widget-label'?: string;
  'widget-id': string;
  'widget-orientation'?: 'horizontal' | 'vertical'; // For layout widgets that support orientation
  'widget-data-path'?: WidgetDataPath;
  'widget-data-default'?: any;
  'widget-required'?: boolean;
  'widget-readonly'?: boolean;
  'widget-data-validation'?: WidgetValidation;
  'widget-data-format'?: WidgetFormat;
  'widget-data-source'?: DataSource;
  'widget-data-options'?: WidgetOptions;
  'widget-data-placeholder'?: string;
  'widget-data-helptext'?: string;
  'widget-data-tooltip'?: string;
  widgets?: BaseWidgetConfig[]; // For layout widgets
  'widget-item'?: BaseWidgetConfig; // For array/group widgets
  'widget-data-columns'?: Array<{
    'column-key': string;
    'widget-label': string;
    widget?: string; // Widget type for column
    'widget-type'?: string;
    'widget-data-path': string;
  }>;
  'widget-data-operations'?: {
    add?: boolean;
    remove?: boolean;
    edit?: boolean;
  };
  'widget-data-add-label'?: string;
  'widget-data-collapsed'?: boolean;
  _comment?: string; // For schema comments/documentation
  [key: string]: any; // Allow additional widget-specific properties
}

/**
 * Panel configuration - a layout container that can contain nested panels or widgets
 */
export interface PanelConfig {
  'panel-id': string;
  'panel-orientation'?: 'horizontal' | 'vertical'; // optional, defaults to "vertical"
  // Styling fields removed - only panel-orientation remains
  panels?: PanelConfig[]; // Nested panels
  widgets?: BaseWidgetConfig[]; // Widgets within this panel
}

/**
 * Section configuration
 */
export interface SectionConfig {
  'section-id': string;
  'section-title'?: string; // Optional - can be empty for card-based layouts
  'section-editable'?: boolean;
  panels: PanelConfig[];
}

/**
 * UI Schema structure
 */
export interface UISchema {
  sections: SectionConfig[];
}

/**
 * Widget value type
 */
export type WidgetValue = any;

/**
 * Widget state in Redux store
 */
export interface WidgetState {
  values: Record<string, WidgetValue>; // widget-id -> value
  errors: Record<string, string[]>; // widget-id -> error messages
  touched: Record<string, boolean>; // widget-id -> touched state
  loading: Record<string, boolean>; // widget-id -> loading state
  dataSources: Record<string, any[]>; // widget-id -> data source options
}

/**
 * Widget context value
 */
export interface WidgetContextValue {
  widgetId: string;
  value: WidgetValue;
  error: string[];
  touched: boolean;
  loading: boolean;
  onChange: (value: WidgetValue) => void;
  onBlur: () => void;
  setError: (errors: string[]) => void;
  getFieldValue: (path: string) => any;
  getDataSource: (widgetId: string) => any[];
}

/**
 * Custom widget render function
 */
export type WidgetRenderFunction = (
  config: BaseWidgetConfig,
  context: WidgetContextValue
) => React.ReactNode;

/**
 * Widget registry entry
 */
export interface WidgetRegistryEntry {
  widget: string;
  component: React.ComponentType<any> | WidgetRenderFunction;
  defaultProps?: Record<string, any>;
}

/**
 * API adapter function type
 */
export type ApiAdapter = (
  url: string,
  options: {
    method?: string;
    headers?: Record<string, string>;
    body?: any;
    params?: Record<string, any>;
  }
) => Promise<any>;

