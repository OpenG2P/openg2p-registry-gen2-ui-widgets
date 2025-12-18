import { DataSource, ApiAdapter } from '../types';
import { getValueByPath } from './pathUtils';

/**
 * Get static data source options
 */
export const getStaticDataSource = (dataSource: Extract<DataSource, { type: 'static' }>): any[] => {
  return dataSource.options || [];
};

/**
 * Get API data source options
 */
export const getApiDataSource = async (
  dataSource: Extract<DataSource, { type: 'api' }>,
  allValues: Record<string, any>,
  apiAdapter: ApiAdapter | undefined
): Promise<any[]> => {
  if (!apiAdapter) {
    console.warn('API adapter not provided for API data source');
    return [];
  }

  try {
    // Get dependency value if exists
    const params: Record<string, any> = {};
    if (dataSource.dependsOn) {
      const depValue = getValueByPath(allValues, dataSource.dependsOn);
      if (depValue !== null && depValue !== undefined && depValue !== '') {
        params[dataSource.dependsOn.split('.').pop() || 'filter'] = depValue;
      } else {
        // If dependency is empty, return empty array
        return [];
      }
    }

    const response = await apiAdapter(dataSource.url, {
      method: dataSource.method || 'GET',
      headers: dataSource.headers,
      body: dataSource.body,
      params,
    });

    // Handle array response
    if (Array.isArray(response)) {
      return response;
    }

    // Handle object response (extract array from common keys)
    if (response && typeof response === 'object') {
      if (response.data && Array.isArray(response.data)) {
        return response.data;
      }
      if (response.results && Array.isArray(response.results)) {
        return response.results;
      }
    }

    return [];
  } catch (error) {
    console.error('Error fetching API data source:', error);
    return [];
  }
};

/**
 * Get schema reference data source options
 */
export const getSchemaDataSource = (
  dataSource: Extract<DataSource, { type: 'schema' }>,
  schemaData: Record<string, any>
): any[] => {
  const data = getValueByPath(schemaData, dataSource.path);
  return Array.isArray(data) ? data : [];
};

/**
 * Transform data source options to { value, label } format
 */
export const transformDataSourceOptions = (
  data: any[],
  valueKey?: string,
  labelKey?: string
): Array<{ value: any; label: string }> => {
  if (!valueKey || !labelKey) {
    // Assume data is already in { value, label } format
    return data.map((item) => {
      if (typeof item === 'object' && 'value' in item && 'label' in item) {
        return item;
      }
      return { value: item, label: String(item) };
    });
  }

  return data.map((item) => ({
    value: item[valueKey],
    label: item[labelKey] || String(item[valueKey]),
  }));
};

