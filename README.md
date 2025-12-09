# @openg2p/react-widgets

A base React widget/component system for building extensible form widgets with data binding, validation, conditional logic, and more.

## Features

- ✅ **TypeScript** support with full type definitions
- ✅ **Redux** integration for state management
- ✅ **Zod** validation support
- ✅ **Data Binding** with dot-notation paths (single or multi-path)
- ✅ **Conditional Logic** (show/hide, enable/disable based on field values)
- ✅ **Data Sources** (static, API, schema reference)
- ✅ **Formatting** (dates, currency, phone numbers)
- ✅ **Widget Registry** for extensible widget system
- ✅ **Tailwind CSS** ready (unstyled base, you provide styles)

## Installation

```bash
npm install @openg2p/react-widgets
```

## Peer Dependencies

Make sure you have these installed:

```bash
npm install react react-dom @reduxjs/toolkit react-redux zod
```

## Quick Start

### 1. Setup Provider

```tsx
import { WidgetProvider } from '@openg2p/react-widgets';
import { createWidgetStore } from '@openg2p/react-widgets';

// Create store (or use your existing Redux store)
const store = createWidgetStore();

// API adapter function (optional)
const apiAdapter = async (url, options) => {
  const response = await fetch(url, {
    method: options.method || 'GET',
    headers: options.headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  return response.json();
};

function App() {
  return (
    <WidgetProvider store={store} apiAdapter={apiAdapter}>
      <YourFormComponent />
    </WidgetProvider>
  );
}
```

### 2. Create a Custom Widget

```tsx
import { useBaseWidget, widgetRegistry } from '@openg2p/react-widgets';
import { BaseWidgetConfig } from '@openg2p/react-widgets';

// Simple text input widget
const TextInputWidget = ({ config }: { config: BaseWidgetConfig }) => {
  const {
    value,
    error,
    touched,
    isEnabled,
    onChange,
    onBlur,
    config: widgetConfig,
  } = useBaseWidget({ config });

  return (
    <div className="mb-4">
      <label className="block text-sm font-medium mb-1">
        {widgetConfig['widget-label']}
        {widgetConfig['widget-required'] && <span className="text-red-500">*</span>}
      </label>
      <input
        type="text"
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        disabled={!isEnabled}
        placeholder={widgetConfig['widget-data-placeholder']}
        className={`w-full px-3 py-2 border rounded ${
          touched && error.length > 0 ? 'border-red-500' : 'border-gray-300'
        }`}
      />
      {touched && error.length > 0 && (
        <p className="text-red-500 text-sm mt-1">{error[0]}</p>
      )}
      {widgetConfig['widget-data-helptext'] && (
        <p className="text-gray-500 text-sm mt-1">{widgetConfig['widget-data-helptext']}</p>
      )}
    </div>
  );
};

// Register the widget
widgetRegistry.register({
  widget: 'text',
  component: TextInputWidget,
});
```

### 3. Use WidgetRenderer

```tsx
import { WidgetRenderer } from '@openg2p/react-widgets';

const widgetConfig = {
  widget: 'text',
  'widget-type': 'input',
  'widget-label': 'Name',
  'widget-id': 'name',
  'widget-data-path': 'person.name',
  'widget-required': true,
  'widget-data-validation': {
    required: true,
    minLength: 2,
    maxLength: 50,
  },
};

function MyForm() {
  return <WidgetRenderer config={widgetConfig} />;
}
```

## Core Concepts

### useBaseWidget Hook

The `useBaseWidget` hook provides all the functionality for a widget:

```tsx
const {
  widgetId,        // Widget ID
  value,           // Current value
  formattedValue,  // Formatted value (if format config exists)
  error,           // Array of error messages
  touched,         // Whether field has been touched
  loading,         // Loading state (for API data sources)
  isVisible,       // Whether widget should be visible
  isEnabled,       // Whether widget should be enabled
  onChange,        // Function to update value
  onBlur,          // Function to handle blur
  setError,        // Function to manually set errors
  getFieldValue,   // Helper to get other field values
  dataSourceOptions, // Options for select/dropdown widgets
  config,          // Full widget config
} = useBaseWidget({ config });
```

### Widget Configuration

Widgets are configured using a JSON schema format:

```typescript
interface BaseWidgetConfig {
  widget: string;                    // Widget name/type
  'widget-type': 'input' | 'layout' | 'table' | 'group';
  'widget-label'?: string;
  'widget-id': string;               // Unique identifier
  'widget-data-path'?: string | Record<string, string>; // Data binding path
  'widget-data-default'?: any;
  'widget-required'?: boolean;
  'widget-readonly'?: boolean;
  'widget-data-validation'?: {
    required?: boolean;
    pattern?: string;
    minLength?: number;
    maxLength?: number;
    zodSchema?: z.ZodSchema;
  };
  'widget-data-format'?: {
    dateFormat?: string;
    currency?: string;
    locale?: string;
    pattern?: string;
  };
  'widget-data-source'?: {
    type: 'static' | 'api' | 'schema';
    // ... source-specific config
  };
  'widget-data-options'?: {
    action?: 'show' | 'hide' | 'enable' | 'disable';
    condition?: {
      field: string;
      operator: 'equals' | 'notEquals' | 'notEmpty' | 'empty' | ...;
      value?: any;
    };
  };
}
```

### Data Binding

#### Single Path
```json
{
  "widget-data-path": "person.name"
}
```

#### Multi-Path (Object)
```json
{
  "widget-data-path": {
    "firstName": "person.fname",
    "lastName": "person.lname"
  }
}
```

### Conditional Logic

Show/hide or enable/disable widgets based on other field values:

```json
{
  "widget-data-options": {
    "action": "show",
    "condition": {
      "field": "person.maritalStatus",
      "operator": "equals",
      "value": "married"
    }
  }
}
```

### Data Sources

#### Static
```json
{
  "widget-data-source": {
    "type": "static",
    "options": [
      { "value": "us", "label": "United States" },
      { "value": "uk", "label": "United Kingdom" }
    ]
  }
}
```

#### API
```json
{
  "widget-data-source": {
    "type": "api",
    "url": "/api/states",
    "method": "GET",
    "dependsOn": "address.country",
    "valueKey": "id",
    "labelKey": "name"
  }
}
```

#### Schema Reference
```json
{
  "widget-data-source": {
    "type": "schema",
    "path": "reference.villages",
    "valueKey": "code",
    "labelKey": "name"
  }
}
```

### Validation

#### Basic Validation
```json
{
  "widget-data-validation": {
    "required": true,
    "pattern": "^[0-9]{10}$",
    "minLength": 10,
    "maxLength": 10
  }
}
```

#### Zod Schema
```typescript
import { z } from 'zod';

const emailSchema = z.string().email();

const config = {
  'widget-data-validation': {
    zodSchema: emailSchema,
  },
};
```

## Examples

### Select/Dropdown Widget

```tsx
const SelectWidget = ({ config }: { config: BaseWidgetConfig }) => {
  const {
    value,
    error,
    touched,
    isEnabled,
    onChange,
    onBlur,
    dataSourceOptions,
    loading,
    config: widgetConfig,
  } = useBaseWidget({ config });

  return (
    <div className="mb-4">
      <label className="block text-sm font-medium mb-1">
        {widgetConfig['widget-label']}
      </label>
      <select
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        disabled={!isEnabled || loading}
        className="w-full px-3 py-2 border rounded"
      >
        <option value="">Select...</option>
        {dataSourceOptions.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {loading && <p className="text-sm text-gray-500">Loading...</p>}
      {touched && error.length > 0 && (
        <p className="text-red-500 text-sm mt-1">{error[0]}</p>
      )}
    </div>
  );
};

widgetRegistry.register({
  widget: 'select',
  component: SelectWidget,
});
```

### Layout Widgets

```tsx
import { WidgetRenderer } from '@openg2p/react-widgets';

const VerticalLayoutWidget = ({ config, ...context }: any) => {
  const widgets = config.widgets || [];
  
  return (
    <div className="flex flex-col space-y-4">
      {widgets.map((widgetConfig: BaseWidgetConfig, index: number) => (
        <WidgetRenderer
          key={widgetConfig['widget-id'] || index}
          config={widgetConfig}
          {...context}
        />
      ))}
    </div>
  );
};

widgetRegistry.register({
  widget: 'vertical-layout',
  component: VerticalLayoutWidget,
});
```

## API Reference

### WidgetProvider

Provider component that wraps your app and provides Redux store and context.

**Props:**
- `store?: WidgetStore` - Optional Redux store (creates one if not provided)
- `apiAdapter?: ApiAdapter` - Function to handle API calls
- `schemaData?: Record<string, any>` - Reference data for schema data sources
- `children: ReactNode`

### WidgetRenderer

Component that renders a widget based on configuration.

**Props:**
- `config: BaseWidgetConfig` - Widget configuration
- `apiAdapter?: ApiAdapter` - Optional API adapter (overrides provider)
- `schemaData?: Record<string, any>` - Optional schema data (overrides provider)
- `onValueChange?: (widgetId: string, value: any) => void` - Callback on value change
- `defaultComponent?: React.ComponentType` - Fallback component if widget not registered

### widgetRegistry

Registry for managing widget components.

**Methods:**
- `register(entry: WidgetRegistryEntry)` - Register a widget
- `get(widgetName: string)` - Get widget entry
- `has(widgetName: string)` - Check if widget is registered
- `unregister(widgetName: string)` - Unregister a widget
- `clear()` - Clear all widgets

## License

MIT

