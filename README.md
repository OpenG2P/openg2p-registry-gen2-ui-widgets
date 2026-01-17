# @openg2p/registry-widgets

A comprehensive React widget library for building extensible form widgets with data binding, validation, conditional logic, and more. Built for the OpenG2P Registry system, this library provides a flexible, architecture-driven approach to form rendering based on JSON UI schemas.

## Overview

The Registry UI Widget Library is a layered, extensible system that enables you to build dynamic forms from JSON configurations. It separates concerns across multiple layers, making it maintainable, testable, and easy to extend with custom widgets.

### Key Features

- ✅ **TypeScript** support with full type definitions
- ✅ **Redux** integration for centralized state management
- ✅ **Zod** validation support with custom schemas
- ✅ **Data Binding** with dot-notation paths (single or multi-path)
- ✅ **Conditional Logic** (show/hide, enable/disable based on field values)
- ✅ **Data Sources** (static, API, schema reference)
- ✅ **Formatting** (dates, currency, phone numbers, numbers)
- ✅ **Widget Registry** system for extensible plugin architecture
- ✅ **19+ Pre-built Widgets** ready to use
- ✅ **Internationalization** support via i18next
- ✅ **Tailwind CSS** ready (unstyled base, you provide styles)

## Installation

```bash
npm install @openg2p/registry-widgets
```

### Peer Dependencies

```bash
npm install react react-dom @reduxjs/toolkit react-redux zod i18next react-i18next
```

## Quick Start

See [QUICKSTART.md](./QUICKSTART.md) for a detailed setup guide. Here's a minimal example:

```tsx
import { WidgetProvider, createWidgetStore, WidgetRenderer } from '@openg2p/registry-widgets';

const store = createWidgetStore();

function App() {
  return (
    <WidgetProvider store={store}>
      <WidgetRenderer 
        config={{
          widget: 'text',
          'widget-type': 'input',
          'widget-id': 'name',
          'widget-label': 'Name',
          'widget-data-path': 'person.name',
          'widget-required': true,
        }}
      />
    </WidgetProvider>
  );
}
```


## Architecture

The library follows a layered architecture that separates concerns and enables extensibility:

```
┌─────────────────────────────────────────┐
│     Application Layer                   │
│  (UISchema → Sections → Panels)         │
└─────────────────────────────────────────┘
              ↓
┌─────────────────────────────────────────┐
│     Widget Registry Layer                │
│  (Widget Registration & Lookup)           │
└─────────────────────────────────────────┘
              ↓
┌─────────────────────────────────────────┐
│     Widget Components Layer              │
│  (19+ Pre-built Widgets)                 │
└─────────────────────────────────────────┘
              ↓
┌─────────────────────────────────────────┐
│     Core Hooks Layer                     │
│  (useBaseWidget, useWidgetTranslation)  │
└─────────────────────────────────────────┘
              ↓
┌─────────────────────────────────────────┐
│     State Management Layer               │
│  (Redux Store, Widget Slice)             │
└─────────────────────────────────────────┘
              ↓
┌─────────────────────────────────────────┐
│     Utility Layer                        │
│  (Validation, Formatting, Data Sources) │
└─────────────────────────────────────────┘
```

### Layer Descriptions

**Application Layer** - The top-level entry point where UI schemas (JSON configurations) are parsed and rendered. This layer handles the hierarchical structure of Sections → Panels → Widgets, managing layout, orientation, and section-level operations like editing and saving.

**Widget Registry Layer** - A plugin system that maintains a catalog of available widgets. When a widget is requested by name, the registry looks it up and returns the corresponding React component. This enables dynamic widget loading and easy extensibility - new widgets can be registered without modifying core library code.

**Widget Components Layer** - The actual React components that render UI elements (text inputs, selects, tables, etc.). These are the 19+ pre-built widgets that come with the library. Each widget is a React component that receives configuration and renders the appropriate UI. Custom widgets can be added by registering them in the registry.

**Core Hooks Layer** - React hooks that provide all the business logic for widgets. The `useBaseWidget` hook handles state management, validation, conditional logic, data source loading, and formatting. The `useWidgetTranslation` hook provides internationalization support. Widget components use these hooks to get values, errors, visibility states, and change handlers without directly interacting with Redux or utilities.

**State Management Layer** - Redux store and widget slice that maintain centralized state for all widgets. The Redux Store holds all widget values, errors, touched states, loading states, and data source options. The Widget Slice defines the state structure and provides actions (setValue, setError, setTouched, etc.) to update state. This ensures a single source of truth and enables efficient re-renders.

**Utility Layer** - Pure functions that handle cross-cutting concerns:
- **Validation**: Validates widget values using built-in rules, regex patterns, or Zod schemas
- **Formatting**: Formats values for display (dates, currency, phone numbers, numbers, text)
- **Data Sources**: Loads options for select/dropdown widgets from static data, APIs, or schema references
- **Conditional Logic**: Evaluates conditions to determine widget visibility and enablement
- **Path Utilities**: Handles dot-notation path resolution for reading/writing nested data structures

### Data Flow

1. **Top-Down (Rendering)**: Application receives UISchema → Registry looks up widgets → Components render using hooks → Hooks read from Redux store → Utilities process data

2. **Bottom-Up (Updates)**: User interacts with widget → Component calls hook's onChange → Hook dispatches Redux action → Store updates → Hooks re-evaluate → Components re-render

This layered architecture provides clear separation of concerns, making the library maintainable, testable, and extensible.

## Core Concepts

### useBaseWidget Hook

The `useBaseWidget` hook is the foundation of every widget. It provides:

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

Widgets are configured using a JSON schema format. A minimal configuration:

```typescript
{
  widget: string;                    // Widget name/type
  'widget-type': 'input' | 'layout' | 'table' | 'group';
  'widget-id': string;               // Unique identifier
  'widget-data-path'?: string | Record<string, string>; // Data binding path
  'widget-label'?: string;
  'widget-required'?: boolean;
  'widget-readonly'?: boolean;
  'widget-data-validation'?: {...};  // Validation rules
  'widget-data-format'?: {...};      // Formatting options
  'widget-data-source'?: {...};      // Data source configuration
  'widget-data-options'?: {...};     // Conditional logic
}
```

### Data Binding

Bind widgets to your data using dot-notation paths:

**Single Path:**
```json
{
  "widget-data-path": "person.name"
}
```

**Multi-Path (Object):**
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

Load options for select/dropdown widgets from multiple sources:

- **Static**: Pre-defined option arrays
- **API**: Dynamic loading from REST endpoints
- **Schema Reference**: Reference data from your schema

### Validation

Support for multiple validation strategies:

- Built-in rules (required, minLength, maxLength, pattern)
- Custom regex patterns
- Zod schemas for complex validation

## Available Widgets

The library includes 19+ pre-built widgets:

- **Input Widgets**: TextInput, TextArea, NumberInput, CurrencyInput, DateInput, DateTimeInput, PhoneInput, FileInput
- **Selection Widgets**: Select, Radio, Checkbox, Boolean
- **Layout Widgets**: Array, IterableAccordion
- **Display Widgets**: Display, Profile
- **Table Widgets**: Table, SimpleTable

> 📚 **Widget documentation coming soon!** Detailed guides for each widget will be available in our tutorial pages.

## Examples

See the `examples/` directory for comprehensive examples demonstrating:

- Basic widget usage
- Layout widgets
- Schema internationalization
- Comparison views
- And more...

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

### Components

- `SectionsContainer` - Container for rendering sections
- `SectionRenderer` - Renders individual sections
- `PanelRenderer` - Renders panels within sections
- `FilePreviewModal` - Modal for file preview

## Contributing

Contributions are welcome! Please ensure your code follows the existing architecture patterns and includes appropriate TypeScript types.

## License

MPL 2.0 (Mozilla Public License 2.0)
