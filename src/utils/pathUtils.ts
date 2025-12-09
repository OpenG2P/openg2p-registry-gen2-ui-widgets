import get from 'lodash.get';
import set from 'lodash.set';

/**
 * Get value from object using dot notation path
 */
export const getValueByPath = (obj: any, path: string): any => {
  return get(obj, path);
};

/**
 * Set value in object using dot notation path
 */
export const setValueByPath = (obj: any, path: string, value: any): any => {
  const newObj = { ...obj };
  set(newObj, path, value);
  return newObj;
};

/**
 * Parse widget data path (can be string or object)
 */
export const parseDataPath = (
  dataPath: string | Record<string, string> | undefined
): string | Record<string, string> | null => {
  if (!dataPath) return null;
  return dataPath;
};

/**
 * Get value from widget state using data path
 */
export const getWidgetValue = (
  values: Record<string, any>,
  dataPath: string | Record<string, string> | undefined,
  widgetId: string
): any => {
  if (!dataPath) {
    // Fallback to widget-id if no data path
    return values[widgetId];
  }

  if (typeof dataPath === 'string') {
    return getValueByPath(values, dataPath);
  }

  // Multi-path: return object with all paths
  const result: Record<string, any> = {};
  for (const [key, path] of Object.entries(dataPath)) {
    result[key] = getValueByPath(values, path);
  }
  return result;
};

/**
 * Set value in widget state using data path
 */
export const setWidgetValue = (
  currentValues: Record<string, any>,
  dataPath: string | Record<string, string> | undefined,
  widgetId: string,
  value: any
): Record<string, any> => {
  if (!dataPath) {
    // Fallback to widget-id if no data path
    return { ...currentValues, [widgetId]: value };
  }

  if (typeof dataPath === 'string') {
    return setValueByPath(currentValues, dataPath, value);
  }

  // Multi-path: set each path from value object
  let newValues = { ...currentValues };
  for (const [key, path] of Object.entries(dataPath)) {
    if (value && typeof value === 'object' && key in value) {
      newValues = setValueByPath(newValues, path, value[key]);
    }
  }
  return newValues;
};

