import { useEffect, useCallback, useMemo, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { BaseWidgetConfig, DataSourceRequestHandler } from '../types';
import { WidgetRootState } from '../store';
import { setValue, setValues, setError, setTouched, setLoading, setDataSource } from '../store/widgetSlice';
import { getWidgetValue, setWidgetValue } from '../utils/pathUtils';
import { validateWidget } from '../utils/validation';
import { shouldShowWidget, shouldEnableWidget } from '../utils/conditions';
import { formatValue } from '../utils/formatting';
import {
  getStaticDataSource,
  getApiDataSource,
  getSchemaDataSource,
  transformDataSourceOptions,
} from '../utils/dataSource';
import { useWidgetEventBus } from './useWidgetEventBus';
import { useWidgetContext } from '../components/WidgetProvider';

export interface UseBaseWidgetOptions {
  config: BaseWidgetConfig;
  dataSourceRequestHandler?: DataSourceRequestHandler; // Required for widgets with API data sources
  schemaData?: Record<string, any>;
  onValueChange?: (widgetId: string, value: any) => void;
}

// Define stable empty arrays to avoid selector reference issues
const EMPTY_ERRORS: string[] = [];
const EMPTY_DATA_SOURCE: any[] = [];

export const useBaseWidget = (options: UseBaseWidgetOptions) => {
  const { config, dataSourceRequestHandler: propHandler, schemaData, onValueChange } = options;
  const dispatch = useDispatch();
  const context = useWidgetContext();
  const eventBus = useWidgetEventBus();
  const widgetId = config['widget-id'];

  // Fall back to WidgetContext for dataSourceRequestHandler
  const dataSourceRequestHandler = propHandler || context.dataSourceRequestHandler;

  // Get state from Redux
  const values = useSelector((state: WidgetRootState) => state.widget.values);
  const errors = useSelector((state: WidgetRootState) => state.widget.errors[widgetId] ?? EMPTY_ERRORS);
  const touched = useSelector((state: WidgetRootState) => state.widget.touched[widgetId] || false);
  const loading = useSelector((state: WidgetRootState) => state.widget.loading[widgetId] || false);
  const dataSourceOptions = useSelector(
    (state: WidgetRootState) => state.widget.dataSources[widgetId] ?? EMPTY_DATA_SOURCE
  );

  // Skip value handling for layout widgets (they don't store data values)
  // Infer layout from widget-type
  const isLayoutWidget = config['widget-type'] === 'layout';

  // Track if user has explicitly set a value to prevent default from overwriting
  const userHasSetValueRef = useRef(false);

  // Use ref for values to avoid stale closures in handleChange
  const valuesRef = useRef(values);
  useEffect(() => {
    valuesRef.current = values;
  }, [values]);

  // Track last dispatched value to prevent duplicate dispatches
  const lastDispatchedValueRef = useRef<any>(null);

  // Get current value
  const currentValue = useMemo(() => {
    if (isLayoutWidget) {
      return undefined; // Layout widgets don't have values
    }

    // Helper to extract displayable value from object (especially geo hierarchy objects)
    const extractValueFromObject = (obj: any): any => {
      if (!obj || typeof obj !== 'object' || Array.isArray(obj)) {
        return obj;
      }

      // Check for geo hierarchy structure first
      if ('geo_code_hierarchy_json' in obj || 'geo_lowest_level_value_id' in obj) {
        if ('geo_lowest_level_value_id' in obj) {
          return obj.geo_lowest_level_value_id;
        }
        // If it's a geo hierarchy object but no extractable ID, return undefined to avoid rendering object
        return undefined;
      }

      // Try common value fields
      if ('value' in obj) {
        return obj.value;
      }
      if ('id' in obj) {
        return obj.id;
      }
      if ('label' in obj) {
        return obj.label;
      }
      if ('name' in obj) {
        return obj.name;
      }

      // If no extractable value found, return undefined to avoid rendering object as React child
      // This prevents "Objects are not valid as a React child" errors
      return undefined;
    };

    // Try to get value from widgetId first (this should have the actual selected value)
    // For geo widgets with dataPath, widgetId stores the actual ID, while dataPath stores the hierarchy object
    let value = values[widgetId];

    // Extract value if it's an object (handles geo hierarchy objects stored in widgetId)
    if (value !== null && value !== undefined && typeof value === 'object' && !Array.isArray(value)) {
      value = extractValueFromObject(value);
    }

    // If widgetId doesn't have a value, try dataPath
    if (value === undefined && config['widget-data-path']) {
      value = getWidgetValue(values, config['widget-data-path'], widgetId);

      // Extract value if it's an object (handles geo hierarchy objects from dataPath)
      if (value !== null && value !== undefined && typeof value === 'object' && !Array.isArray(value)) {
        value = extractValueFromObject(value);
      }
    }

    // If value is still undefined and user has set a value, try reading from widgetId as backup
    // This handles cases where dataPath lookup might fail temporarily
    if (value === undefined && userHasSetValueRef.current && values[widgetId] !== undefined) {
      value = values[widgetId];
      // Extract value if it's an object (handles geo hierarchy objects)
      if (value !== null && value !== undefined && typeof value === 'object' && !Array.isArray(value)) {
        value = extractValueFromObject(value);
      }
    }

    // Final safety check: if value is still an object, extract displayable value
    if (value !== null && value !== undefined && typeof value === 'object' && !Array.isArray(value)) {
      value = extractValueFromObject(value);
    }

    // If user has explicitly set a value, always return it (even if undefined/null)
    // This prevents the default from overwriting user selections
    if (userHasSetValueRef.current) {
      return value;
    }

    // Only fall back to default if user hasn't set a value yet
    // But check if value is explicitly null (user cleared it) vs undefined (never set)
    if (value === null) {
      return null; // User explicitly cleared it, don't use default
    }

    return value !== undefined ? value : config['widget-data-default'];
  }, [values, config, widgetId, isLayoutWidget]);

  // Initialize default value only once on mount (skip for layout widgets)
  useEffect(() => {
    if (isLayoutWidget) {
      return;
    }
    // Only initialize default if value is undefined and user hasn't set a value yet
    if (!userHasSetValueRef.current && config['widget-data-default'] !== undefined && currentValue === undefined) {
      handleChange(config['widget-data-default'], false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLayoutWidget]); // Only run once on mount

  // Handle value change
  // CRITICAL: Don't include 'values' in dependency array - it causes the callback to be recreated
  // every time values change, which can lead to stale closures and double dispatches
  const handleChange = useCallback(
    (newValue: any, validate: boolean = true) => {
      // Use valuesRef to get the latest values, not the stale closure value
      const currentValues = valuesRef.current;
      const currentValue = currentValues[widgetId] || getWidgetValue(currentValues, config['widget-data-path'], widgetId);

      // CRITICAL: Prevent setting the same value (avoids unnecessary dispatches and potential loops)
      if (currentValue === newValue) {
        return;
      }

      // Mark that user has set a value (unless this is the default initialization)
      if (newValue !== config['widget-data-default'] || userHasSetValueRef.current) {
        userHasSetValueRef.current = true;
      }

      // CRITICAL FIX: If there's no dataPath, just set the value directly
      // If there's a dataPath, we need to update both the widgetId and the dataPath
      if (!config['widget-data-path']) {
        // No dataPath: just set the value directly by widgetId
        // CRITICAL: Check if we just dispatched this value to prevent duplicate dispatches
        if (lastDispatchedValueRef.current === newValue) {
          return;
        }
        lastDispatchedValueRef.current = newValue;
        dispatch(setValue({ widgetId, value: newValue }));
      } else {
        // Has dataPath: update both widgetId and dataPath
        // CRITICAL: Create updated values object with newValue already set
        // This prevents setWidgetValue from reading stale values
        const currentValuesWithUpdate = {
          ...valuesRef.current,
          [widgetId]: newValue, // Ensure widgetId has the new value
        };
        const updatedValues = setWidgetValue(
          currentValuesWithUpdate,
          config['widget-data-path'],
          widgetId,
          newValue
        );
        // setWidgetValue returns the complete updated structure with all existing data preserved
        // Use setValues to update the entire state with deep merge
        dispatch(setValues(updatedValues));
      }

      // Validate if needed
      if (validate) {
        const validationErrors = validateWidget(
          newValue,
          config['widget-data-validation'],
          config['widget-required']
        );
        dispatch(setError({ widgetId, errors: validationErrors }));
      }

      // Call custom onChange if provided
      if (onValueChange) {
        onValueChange(widgetId, newValue);
      }

      // Publish widget:change event
      // Skip publishing for last-level geo widgets (no child widgets waiting)
      const geoConfig = config['widget-geo-config'];
      const isLastLevelGeo = geoConfig?.isLastLevel === true;

      if (eventBus && !isLastLevelGeo) {
        eventBus.publish({
          type: 'widget:change',
          widgetId,
          value: newValue,
          timestamp: Date.now(),
        });
      }
    },
    [config, widgetId, dispatch, onValueChange, eventBus] // Removed 'values' to prevent stale closures
  );

  // Handle blur
  const handleBlur = useCallback(() => {
    dispatch(setTouched({ widgetId, touched: true }));
    // Validate on blur
    const validationErrors = validateWidget(
      currentValue,
      config['widget-data-validation'],
      config['widget-required']
    );
    dispatch(setError({ widgetId, errors: validationErrors }));

    // Publish widget:blur event
    if (eventBus) {
      eventBus.publish({
        type: 'widget:blur',
        widgetId,
        value: currentValue,
        timestamp: Date.now(),
      });
    }
  }, [currentValue, config, widgetId, dispatch, eventBus]);

  // Get field value helper
  const getFieldValue = useCallback(
    (path: string) => {
      return getWidgetValue(values, path, '');
    },
    [values]
  );

  // Conditional visibility and enablement
  const isVisible = useMemo(() => {
    // Layout widgets are always visible unless explicitly hidden
    if (isLayoutWidget && !config['widget-data-options']?.condition) {
      return true;
    }
    return shouldShowWidget(config['widget-data-options'], values);
  }, [config['widget-data-options'], values, isLayoutWidget]);

  const isEnabled = useMemo(() => {
    // Layout widgets are always enabled (they don't have input state)
    if (isLayoutWidget) {
      return true;
    }
    if (config['widget-readonly']) {
      return false;
    }
    return shouldEnableWidget(config['widget-data-options'], values);
  }, [config['widget-readonly'], config['widget-data-options'], values, isLayoutWidget]);

  // Format value for display
  const formattedValue = useMemo(() => {
    if (!config['widget-data-format']) {
      return currentValue;
    }
    return formatValue(currentValue, config['widget-data-format'], config.widget);
  }, [currentValue, config]);

  // Track readonly state explicitly to detect changes
  // Use JSON.stringify to create a stable reference for the dependency array
  const isReadonly = config['widget-readonly'] ?? false;
  const dataSource = config['widget-data-source'];
  const geoConfig = config['widget-geo-config'];

  // Use ref to store handler to avoid stale closures
  const handlerRef = useRef(dataSourceRequestHandler);
  useEffect(() => {
    handlerRef.current = dataSourceRequestHandler;
  }, [dataSourceRequestHandler]);

  // Create a stable key for the config to detect changes
  // This ensures the effect runs when widget-readonly changes
  const apiService = dataSource?.type === 'api' ? (dataSource as any).service : '';
  const apiEndpoint = dataSource?.type === 'api' ? (dataSource as any).endpoint : '';
  const configKey = `${widgetId}-${isReadonly}-${dataSource?.type || 'none'}-${apiService}-${apiEndpoint}`;

  // Handle data source loading
  useEffect(() => {
    if (!dataSource) {
      return;
    }

    // For API data sources, check if widget is readonly
    // According to PRD: "Level 1 geo widgets load on widget mount or when entering edit mode"
    // So we should only load API data sources when widget is NOT readonly
    if (dataSource.type === 'api' && isReadonly) {
      return;
    }

    // For widgets with dependencies, check if dependency value exists
    if (dataSource.type === 'api' && dataSource.dependsOn) {
      // Check if dependency value exists
      let depValue: any = null;
      if (dataSource.dependsOn.includes('.')) {
        depValue = getWidgetValue(values, dataSource.dependsOn, '');
      } else {
        depValue = values[dataSource.dependsOn];
      }

      // If dependency is empty, don't load (will load when dependency has value)
      if (depValue === null || depValue === undefined || depValue === '') {
        return;
      }
    }

    const loadDataSource = async () => {
      // Get current handler from ref to avoid stale closures
      // Also check prop directly as fallback (for initial render or when ref not updated yet)
      const currentHandler = handlerRef.current || dataSourceRequestHandler;

      // Only check for handler when we actually need it (inside the async function)
      // This avoids false errors during React Strict Mode double-invocation
      // If handler isn't available yet, silently skip - React will retry when it's ready

      try {
        if (dataSource.type === 'api' && !currentHandler) {
          // Silently skip if handler isn't available yet (common during React Strict Mode double-invocation)
          // React will call this effect again when the handler is ready
          return;
        }

        dispatch(setLoading({ widgetId, loading: true }));

        let data: any[] = [];

        if (dataSource.type === 'static') {
          data = getStaticDataSource(dataSource);
        } else if (dataSource.type === 'api') {
          if (!currentHandler) {
            // Silently skip if handler isn't available yet
            dispatch(setLoading({ widgetId, loading: false }));
            dispatch(setDataSource({ widgetId, data: [] }));
            return;
          }
          // Extract level_id from widget-geo-config.level if available
          const levelId = geoConfig?.level;
          data = await getApiDataSource(dataSource, values, currentHandler, levelId);
        } else if (dataSource.type === 'schema') {
          data = getSchemaDataSource(dataSource, schemaData || {});
        }

        // Transform to { value, label } format
        // For geo widgets, default to level_value_id and level_value_mnemonic
        let valueKey: string | undefined;
        let labelKey: string | undefined;

        if (dataSource.type === 'static') {
          valueKey = undefined;
          labelKey = undefined;
        } else if (geoConfig) {
          // Geo widgets: default to level_value_id and level_value_mnemonic
          valueKey = dataSource.valueKey || 'level_value_id';
          labelKey = dataSource.labelKey || 'level_value_mnemonic';
        } else {
          // Non-geo widgets: use specified keys or undefined
          valueKey = dataSource.valueKey;
          labelKey = dataSource.labelKey;
        }

        const transformed = transformDataSourceOptions(
          data,
          valueKey,
          labelKey
        );

        dispatch(setDataSource({ widgetId, data: transformed }));
      } catch (error) {
        console.error(`[useBaseWidget] ERROR loading data source for ${widgetId}:`, error);
        dispatch(setDataSource({ widgetId, data: [] }));
      } finally {
        dispatch(setLoading({ widgetId, loading: false }));
      }
    };

    loadDataSource();
    // Use configKey to ensure effect runs when readonly state changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [configKey, values, dataSourceRequestHandler, schemaData, widgetId, dispatch]);

  return {
    widgetId,
    value: currentValue,
    formattedValue,
    error: errors,
    touched,
    loading,
    isVisible,
    isEnabled,
    onChange: handleChange,
    onBlur: handleBlur,
    setError: (errors: string[]) => dispatch(setError({ widgetId, errors })),
    getFieldValue,
    dataSourceOptions,
    config,
  };
};

