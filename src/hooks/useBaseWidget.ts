import { useEffect, useCallback, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { BaseWidgetConfig, ApiAdapter } from '../types';
import { WidgetRootState } from '../store';
import { setValue, setError, setTouched, setLoading, setDataSource } from '../store/widgetSlice';
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

export interface UseBaseWidgetOptions {
  config: BaseWidgetConfig;
  apiAdapter?: ApiAdapter;
  schemaData?: Record<string, any>;
  onValueChange?: (widgetId: string, value: any) => void;
}

// Define stable empty arrays to avoid selector reference issues
const EMPTY_ERRORS: string[] = [];
const EMPTY_DATA_SOURCE: any[] = [];

export const useBaseWidget = (options: UseBaseWidgetOptions) => {
  const { config, apiAdapter, schemaData, onValueChange } = options;
  const dispatch = useDispatch();
  const widgetId = config['widget-id'];

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

  // Get current value
  const currentValue = useMemo(() => {
    if (isLayoutWidget) {
      return undefined; // Layout widgets don't have values
    }
    const value = getWidgetValue(values, config['widget-data-path'], widgetId);
    return value !== undefined ? value : config['widget-data-default'];
  }, [values, config, widgetId, isLayoutWidget]);

  // Initialize default value (skip for layout widgets)
  useEffect(() => {
    if (isLayoutWidget) {
      return;
    }
    if (config['widget-data-default'] !== undefined && currentValue === undefined) {
      handleChange(config['widget-data-default'], false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLayoutWidget]); // handleChange and currentValue are stable or handled separately

  // Handle value change
  const handleChange = useCallback(
    (newValue: any, validate: boolean = true) => {
      const updatedValues = setWidgetValue(
        values,
        config['widget-data-path'],
        widgetId,
        newValue
      );

      // Update Redux store
      Object.entries(updatedValues).forEach(([key, value]) => {
        if (key !== widgetId || value !== values[key]) {
          dispatch(setValue({ widgetId: key, value }));
        }
      });

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
    },
    [values, config, widgetId, dispatch, onValueChange]
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
  }, [currentValue, config, widgetId, dispatch]);

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

  // Handle data source loading
  useEffect(() => {
    const dataSource = config['widget-data-source'];
    if (!dataSource) {
      return;
    }

    const loadDataSource = async () => {
      try {
        dispatch(setLoading({ widgetId, loading: true }));

        let data: any[] = [];

        if (dataSource.type === 'static') {
          data = getStaticDataSource(dataSource);
        } else if (dataSource.type === 'api') {
          data = await getApiDataSource(dataSource, values, apiAdapter);
        } else if (dataSource.type === 'schema') {
          data = getSchemaDataSource(dataSource, schemaData || {});
        }

        // Transform to { value, label } format
        const valueKey = dataSource.type === 'static' ? undefined : dataSource.valueKey;
        const labelKey = dataSource.type === 'static' ? undefined : dataSource.labelKey;
        const transformed = transformDataSourceOptions(
          data,
          valueKey,
          labelKey
        );

        dispatch(setDataSource({ widgetId, data: transformed }));
      } catch (error) {
        console.error('Error loading data source:', error);
        dispatch(setDataSource({ widgetId, data: [] }));
      } finally {
        dispatch(setLoading({ widgetId, loading: false }));
      }
    };

    loadDataSource();
  }, [config['widget-data-source'], values, apiAdapter, schemaData, widgetId, dispatch]);

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

