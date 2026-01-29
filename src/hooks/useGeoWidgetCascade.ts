import { useEffect, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useWidgetEventBus } from './useWidgetEventBus';
import { BaseWidgetConfig, WidgetGeoConfig, DataSourceRequestHandler } from '../types';
import { setValue, setDataSource } from '../store/widgetSlice';
import { getApiDataSource, transformDataSourceOptions } from '../utils/dataSource';
import { WidgetRootState } from '../store';
import { geoHierarchyBuilder } from '../utils/geoHierarchy';
import { getWidgetValue, setWidgetValue } from '../utils/pathUtils';

export interface UseGeoWidgetCascadeOptions {
  config: BaseWidgetConfig;
  dataSourceRequestHandler?: DataSourceRequestHandler;
  values: Record<string, any>;
}

// Define stable empty array to avoid selector reference issues
const EMPTY_DATA_SOURCE: any[] = [];

/**
 * Hook for geo widget cascade functionality
 * Handles geo hierarchy building and cascade behavior
 */
export const useGeoWidgetCascade = (options: UseGeoWidgetCascadeOptions) => {
  const { config, dataSourceRequestHandler, values } = options;
  const dispatch = useDispatch();
  const eventBus = useWidgetEventBus();
  const widgetId = config['widget-id'];
  const geoConfig = config['widget-geo-config'];
  const dataSource = config['widget-data-source'];
  const dataPath = config['widget-data-path'];

  const valuesRef = useRef(values);
  const handlerRef = useRef(dataSourceRequestHandler);

  // Keep refs updated
  useEffect(() => {
    valuesRef.current = values;
    handlerRef.current = dataSourceRequestHandler;
  }, [values, dataSourceRequestHandler]);

  // Get current value and data source options
  const currentValue = useSelector((state: WidgetRootState) => {
    if (!dataPath) {
      return state.widget.values[widgetId];
    }
    return getWidgetValue(state.widget.values, dataPath, widgetId);
  });

  // Memoize selector to avoid returning new array reference
  const dataSourceOptions = useSelector((state: WidgetRootState) => 
    state.widget.dataSources[widgetId] ?? EMPTY_DATA_SOURCE
  );

  useEffect(() => {
    if (!geoConfig || !eventBus || !dataSource || dataSource.type !== 'api') {
      return;
    }

    const { level, isLastLevel, parentWidgetId } = geoConfig;

    // Listen to parent widget changes
    if (parentWidgetId) {
      const handleParentChange = async (event: any) => {
        if (event.widgetId !== parentWidgetId) {
          return;
        }

        // CRITICAL: Use a small delay to ensure Redux state has been updated
        // This prevents reading stale values from valuesRef
        await new Promise(resolve => setTimeout(resolve, 0));

        const currentValues = valuesRef.current;
        const currentHandler = handlerRef.current;

        // CRITICAL: Get the parent value from Redux state, not from the event
        // The event.value might be stale, but Redux state is always current
        const parentValue = currentValues[parentWidgetId];

        // Remove this level and all below from hierarchy
        geoHierarchyBuilder.removeLevelAndBelow(level);

        // Clear this widget's value
        // CRITICAL: Only dispatch setValue for THIS widget, not for parent or other widgets
        // setWidgetValue returns the entire updated state, but we only want to update this widget
        if (dataPath) {
          const updatedValues = setWidgetValue(currentValues, dataPath, widgetId, undefined);
          // Only dispatch setValue for this widget's widgetId, not for parent or other widgets
          // This prevents accidentally overwriting the parent widget's value
          // The setWidgetValue function updates the nested structure, but we only want to
          // update the top-level widgetId key, not other keys that might be in updatedValues
          const newWidgetValue = updatedValues[widgetId];
          if (newWidgetValue !== undefined) {
            dispatch(setValue({ widgetId, value: newWidgetValue }));
          } else {
            // If widgetId is not in updatedValues, the value was set in a nested path
            // In this case, we need to use setValues to update the entire structure
            // But we need to be careful not to overwrite the parent widget's value
            // Only update keys that are related to this widget's dataPath
            const dataPathStr = typeof dataPath === 'string' ? dataPath : '';
            if (dataPathStr && !dataPathStr.startsWith(parentWidgetId + '.')) {
              // Only update if dataPath doesn't start with parentWidgetId
              // This ensures we don't accidentally overwrite the parent widget's value
              dispatch(setValue({ widgetId, value: undefined }));
            }
          }
        } else {
          dispatch(setValue({ widgetId, value: undefined }));
        }

        // Reload data source with new parent value
        // CRITICAL: Use parentValue from Redux, not event.value
        if (currentHandler && parentValue !== null && parentValue !== undefined) {
          try {
            // Merge the new parent value into current values for the API call
            // This ensures getApiDataSource can find the dependency value
            const updatedValues = {
              ...currentValues,
              [parentWidgetId]: parentValue, // Use Redux value, not event.value
            };
            
            // Extract level_id from widget-geo-config.level
            const levelId = geoConfig.level;
            const data = await getApiDataSource(dataSource, updatedValues, currentHandler!, levelId);
            
            // Transform to { value, label } format
            const valueKey = dataSource.valueKey || 'level_value_id';
            const labelKey = dataSource.labelKey || 'level_value_mnemonic';
            const transformed = transformDataSourceOptions(data, valueKey, labelKey);
            
            dispatch(setDataSource({ widgetId, data: transformed }));
          } catch (error) {
            console.error('Error reloading geo data source:', error);
            dispatch(setDataSource({ widgetId, data: [] }));
          }
        } else {
          // If parent value is cleared, clear the data source
          dispatch(setDataSource({ widgetId, data: [] }));
        }
      };

      const unsubscribe = eventBus.subscribe('widget:change', handleParentChange);
      return () => {
        unsubscribe();
      };
    }
  }, [geoConfig, eventBus, dataSource, widgetId, dataPath, dispatch]);

  // Handle value changes to build hierarchy
  useEffect(() => {
    if (!geoConfig) {
      return;
    }

    // Skip if value is empty/null (but allow 0 and false)
    if (currentValue === null || currentValue === undefined || currentValue === '') {
      // If value was cleared, remove this level and below from hierarchy
      const { level } = geoConfig;
      geoHierarchyBuilder.removeLevelAndBelow(level);
      return;
    }

    const { level, isLastLevel } = geoConfig;
    
    // For last level, check if hierarchy is already built to prevent endless loops
    if (isLastLevel && dataPath) {
      const currentHierarchy = getWidgetValue(valuesRef.current, dataPath, widgetId);
      // If hierarchy JSON is already set and matches current value, skip rebuilding
      if (currentHierarchy && typeof currentHierarchy === 'object' && currentHierarchy.geo_code_hierarchy_json) {
        // Check if the lowest level value matches
        const currentLevelValue = typeof currentValue === 'object' 
          ? (currentValue.level_value_id || currentValue.id || currentValue.value)
          : currentValue;
        if (currentHierarchy.geo_lowest_level_value_id === currentLevelValue) {
          return; // Hierarchy already built for this value, skip
        }
      }
    }

    // Extract level_value_id and level_value_mnemonic from current value
    // The value could be the ID itself or an object with id/name
    let level_value_id: string;
    let level_value_mnemonic: string;

    if (typeof currentValue === 'string' || typeof currentValue === 'number') {
      // Value is just the ID, need to find mnemonic from data source
      level_value_id = String(currentValue);
      // Try to get mnemonic from data source options
      const option = dataSourceOptions.find((opt: any) => opt.value === currentValue);
      level_value_mnemonic = option?.label || String(currentValue);
    } else if (currentValue && typeof currentValue === 'object') {
      level_value_id = currentValue.level_value_id || currentValue.id || currentValue.value;
      level_value_mnemonic = currentValue.level_value_mnemonic || currentValue.name || currentValue.label;
    } else {
      return;
    }

    // When a widget's own value changes, remove this level and all below from hierarchy first
    // This ensures that when level 1 changes, we clear the hierarchy and rebuild from scratch
    // The addLevel method already handles removing existing levels, but we explicitly clear to be safe
    geoHierarchyBuilder.removeLevelAndBelow(level);
    
    // Add level to hierarchy
    geoHierarchyBuilder.addLevel(level, level_value_id, level_value_mnemonic);

    // If this is the last level, build and store hierarchy JSON
    if (isLastLevel && dataPath) {
      const hierarchyJson = geoHierarchyBuilder.buildHierarchyJson();
      
      if (hierarchyJson) {
        // Store both geo_lowest_level_value_id and geo_code_hierarchy_json
        const updatedValues = setWidgetValue(
          valuesRef.current,
          dataPath,
          widgetId,
          {
            geo_lowest_level_value_id: hierarchyJson.geo_lowest_level_value_id,
            geo_code_hierarchy_json: hierarchyJson.geo_code_hierarchy_json,
          }
        );

        Object.entries(updatedValues).forEach(([key, value]) => {
          dispatch(setValue({ widgetId: key, value }));
        });
      }
    } else if (!isLastLevel) {
      // For non-last levels, the value is already stored by handleChange in useBaseWidget
      // We don't need to dispatch setValue again here - it would cause conflicts
      // The value is stored by widget-id when handleChange is called
    }
  }, [geoConfig, currentValue, widgetId, dataPath, dispatch, dataSourceOptions]);
};
