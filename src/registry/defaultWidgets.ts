import { widgetRegistry } from './WidgetRegistry';
import {
  TextInputWidget,
  DateInputWidget,
  SelectWidget,
  RadioWidget,
  CheckboxWidget,
  FileInputWidget,
  SimpleTableWidget,
  ArrayWidget,
  IterableAccordionWidget,
  PhoneInputWidget,
  CurrencyInputWidget
} from '../widgets';

/**
 * Register all default/generic widgets
 * This is called automatically when the package is imported
 */
export const registerDefaultWidgets = () => {
  // Text input widget (supports all text-based inputs via configuration: text, email, tel, number, etc.)
  widgetRegistry.register({ widget: 'text', component: TextInputWidget });

  // Date input widget
  widgetRegistry.register({ widget: 'date', component: DateInputWidget });

  // Select/Dropdown widget
  widgetRegistry.register({ widget: 'select', component: SelectWidget });

  // Radio button widget
  widgetRegistry.register({ widget: 'radio', component: RadioWidget });

  // Checkbox widget (supports single or multiple checkboxes)
  widgetRegistry.register({ widget: 'checkbox', component: CheckboxWidget });

  // File input widget
  widgetRegistry.register({ widget: 'file', component: FileInputWidget });

  // Table widget
  widgetRegistry.register({ widget: 'simple-table', component: SimpleTableWidget });

  // Group widgets
  widgetRegistry.register({ widget: 'array-widget', component: ArrayWidget });
  widgetRegistry.register({ widget: 'iterable-accordion', component: IterableAccordionWidget });
  // Phone and Currency Widgets
  widgetRegistry.register({ widget: 'phone', component: PhoneInputWidget });
  widgetRegistry.register({ widget: 'currency', component: CurrencyInputWidget });
};

// Auto-register on import
registerDefaultWidgets();
