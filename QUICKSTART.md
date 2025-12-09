# Quick Start Guide

## Installation

```bash
npm install @openg2p/react-widgets
npm install react react-dom @reduxjs/toolkit react-redux zod
```

## Basic Setup

### 1. Wrap your app with WidgetProvider

```tsx
import { WidgetProvider, createWidgetStore } from '@openg2p/react-widgets';

const store = createWidgetStore();

function App() {
  return (
    <WidgetProvider store={store}>
      <YourComponents />
    </WidgetProvider>
  );
}
```

### 2. Create and register a widget

```tsx
import { useBaseWidget, widgetRegistry, BaseWidgetConfig } from '@openg2p/react-widgets';

const MyWidget = ({ config }: { config: BaseWidgetConfig }) => {
  const { value, onChange, error, isEnabled } = useBaseWidget({ config });
  
  return (
    <input
      value={value || ''}
      onChange={(e) => onChange(e.target.value)}
      disabled={!isEnabled}
    />
  );
};

// Register it
widgetRegistry.register({
  widget: 'my-widget',
  component: MyWidget,
});
```

### 3. Use WidgetRenderer

```tsx
import { WidgetRenderer } from '@openg2p/react-widgets';

const config = {
  widget: 'my-widget',
  'widget-type': 'input',
  'widget-id': 'myField',
  'widget-data-path': 'form.myField',
  'widget-label': 'My Field',
};

<WidgetRenderer config={config} />
```

## Key Concepts

### useBaseWidget Hook

This hook provides all widget functionality:

- `value` - Current value
- `onChange(value)` - Update value
- `error` - Array of error messages
- `isEnabled` - Whether widget is enabled
- `isVisible` - Whether widget is visible
- `getFieldValue(path)` - Get other field values

### Widget Configuration

Widgets are configured via JSON objects matching your UISchema format.

### Data Binding

Use `widget-data-path` to bind to your data:

- Single path: `"person.name"`
- Multi-path: `{ "firstName": "person.fname", "lastName": "person.lname" }`

### Conditional Logic

Use `widget-data-options` for show/hide/enable/disable:

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

Support for static, API, and schema reference data sources.

See README.md for complete documentation.

