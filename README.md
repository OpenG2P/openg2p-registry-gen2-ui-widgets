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
- ✅ **20 Pre-built Widgets** ready to use (including HeaderSection)
- ✅ **Internationalization** support via i18next
- ✅ **Tailwind CSS** ready (unstyled base, you provide styles)
- ✅ **Multi-mode Section Rendering** (RegistryView, CRView, IntakeForm)
- ✅ **Geo Hierarchy Cascading Dropdowns** for location-based fields
- ✅ **Section Builder** with visual and JSON editor for UI schemas
- ✅ **Form Handle API** for host-driven validation and submission
- ✅ **Dirty Tracking** with unsaved changes detection per section

## Installation

```bash
npm install @openg2p/registry-widgets
```

### Peer Dependencies

```bash
npm install react react-dom @reduxjs/toolkit react-redux zod i18next react-i18next
```

## Quick Start

See [QUICKSTART.md](./QUICKSTART.md) for a detailed setup guide, or [Complete Reference](https://docs.openg2p.org/registry-gen-2/developer-zone/registry-ui-widgets-complete-guide-and-reference) for a comprehensive tutorial covering all features. Here's a minimal example:

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
│  (20 Pre-built Widgets)                  │
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

**Widget Components Layer** - The actual React components that render UI elements (text inputs, selects, tables, etc.). These are the 20 pre-built widgets that come with the library. Each widget is a React component that receives configuration and renders the appropriate UI. Custom widgets can be added by registering them in the registry.

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

The library includes 20 pre-built widgets:

- **Input Widgets**: TextInput, TextArea, NumberInput, CurrencyInput, DateInput, DateTimeInput, PhoneInput, FileInput
- **Selection Widgets**: Select, Radio, Checkbox, Boolean
- **Layout Widgets**: Array, IterableAccordion
- **Display Widgets**: Display, Profile
- **Table Widgets**: Table, SimpleTable
- **Section Widgets**: HeaderSection, ScoresDisplay

### HeaderSection Widget

A full-width header card designed for registry record views. Displays a profile image, record name, functional ID, status badge, and audit metadata (created by / approved by) in a responsive two-column layout. Supports editable status and status-reason fields with data source-driven dropdowns, customisable label overrides via i18n, and configurable status-colour mapping.

```json
{
  "widget": "header-section",
  "widget-type": "group",
  "widget-id": "registry-header",
  "widget-data-path": {
    "image": "record_image_storage_id",
    "name": "record_name",
    "functionalId": "functional_record_id",
    "status": "record_status"
  }
}
```

### ScoresDisplay Widget

A full-width, view-only widget for showing a single computed score record (e.g. PMT, Food Security Score). It fetches data via the host application's `dataSourceRequestHandler` and renders:

- **Score Type**
- **Score**
- **Computed at**

**API request mapping**

- The widget reads `internal_record_id` from `widget-data-source.params.internal_record_id_path` (a dot-path into `schemaData` / store values).
- It then calls `dataSourceRequestHandler(service, endpoint, method, params)` and passes `internal_record_id` in the request params.

```json
{
  "widget": "scores-display",
  "widget-type": "group",
  "widget-id": "record-scores",
  "widget-readonly": true,
  "widget-data-source": {
    "type": "api",
    "service": "staff-portal-api",
    "endpoint": "get_scores",
    "method": "POST",
    "params": {
      "internal_record_id_path": "internal_record_id"
    }
  }
}
```

**Expected response shape (ideal)**

```json
{
  "scores": [
    {
      "score_type": "PMT",
      "computed_score": 42,
      "computed_at": "2026-04-16T10:12:00Z",
      "triggered_by_cr_id": "CR-001"
    }
  ]
}
```

**Notes**

- The widget displays a single score record. If multiple scores are returned, it selects the most recent by `computed_at` (falls back to the first item if dates are missing).
- There is no edit mode for this widget.

## Section Modes

`SectionsContainer` supports three display modes via the `mode` prop:

### RegistryView (default)

Standard registry display. Sections render in a CSS Grid layout with an inline **Edit Details** button. Only one section can be in edit mode at a time; editing a section opens it as a portal-based overlay with save/cancel controls.

### CRView (Change Request View)

Read-only comparison view for change requests. Sections display **Created by** / **Approved by** metadata and support `changeRequestType` labels (`"new"` / `"old"`) for side-by-side comparison.

### IntakeForm

Accordion-based registration form. Sections expand and collapse, with **Prev** / **Next** navigation buttons. Supports `isDraft` mode (editable vs read-only), per-section validation on save, and status badges (**Saved** / **Modified and not saved**).

## Form Handle API

`SectionsContainer` exposes a `SectionsFormHandle` via the `onFormReady` callback, enabling host applications to drive form submission externally:

```tsx
<SectionsContainer
  sections={sections}
  mode="IntakeForm"
  onFormReady={(handle) => {
    // handle.validate()            – validate all sections, returns boolean
    // handle.getFormData()         – raw store data (no validation)
    // handle.validateAndGetData()  – validate then return SectionChanges[]
    // handle.getStructuredData()   – get records and files without validation
  }}
/>
```

## Geo Hierarchy Cascading Dropdowns

The `useGeoWidgetCascade` hook and `geoHierarchyBuilder` utility provide cascading dropdown functionality for geographic location fields (e.g. Country > State > City). Changes in a parent level automatically reload and reset child dropdowns via the widget event bus.

## Section Builder

A visual UI schema editor shipped as `SectionBuilder`, with sub-components:

- **JSONEditorPanel** — Live JSON editor (powered by `json-edit-react`) for direct schema manipulation
- **VisualBuilderPanel** — Drag-and-drop visual layout editor
- **SectionTree** — Tree view of the section/panel/widget hierarchy
- **PropertyEditor** — Contextual property panel for the selected node

## Examples

See the `examples/` directory for comprehensive examples demonstrating:

- Basic widget usage (`usage-example.tsx`)
- Layout widgets (`LayoutWidgets.tsx`)
- Schema internationalization (`schema-i18n-example.tsx`)
- Comparison views (`comparison-view-example.tsx`)
- Section rendering modes (`section-renderer-example.tsx`)
- Intake form flow (`intake-form-example.tsx`)
- Header section widget (`header-section-example.tsx`)
- Section builder (`section-builder-example.tsx`)
- JSON editor standalone (`jsoneditor-standalone-example.tsx`)

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

- `SectionsContainer` - Container for rendering sections with mode support (RegistryView, CRView, IntakeForm)
- `SectionRenderer` - Renders individual sections with edit mode, dirty tracking, and accordion support
- `PanelRenderer` - Renders panels within sections
- `FilePreviewModal` - Modal for file preview
- `SectionBuilder` - Visual UI schema editor
- `JSONEditorPanel` - JSON editor for UI schemas
- `VisualBuilderPanel` - Visual layout builder
- `SectionTree` - Tree view of section hierarchy
- `PropertyEditor` - Property editor for selected nodes

### Hooks

- `useBaseWidget` - Core hook for widget state, validation, conditional logic, and formatting
- `useWidgetTranslation` - i18n hook for widget labels and messages
- `useWidgetEventBus` - Pub/sub event bus for inter-widget communication
- `useWidgetCascade` - Cascading dropdown behaviour between linked widgets
- `useGeoWidgetCascade` - Geo hierarchy cascading for location-based dropdowns

### Utilities

- `pathUtils` - Dot-notation path read/write for nested data structures
- `validation` - Built-in, regex, and Zod validation
- `formatting` - Date, currency, phone, number, and text formatting
- `conditions` - Conditional show/hide and enable/disable evaluation
- `dataSource` - Static, API, and schema reference data loading
- `geoHierarchy` - Geo hierarchy builder for location cascades
- `sectionValidate` - Section-level validation across all widgets
- `buildSectionChanges` - Build change payloads from section data
- `schemaNamespace` - Namespace section configs for multi-instance rendering
- `schemaTranslation` - Translate UI schemas, widget configs, and panel configs

## Contributing

Contributions are welcome! Please ensure your code follows the existing architecture patterns and includes appropriate TypeScript types.

## License

MPL 2.0 (Mozilla Public License 2.0)
