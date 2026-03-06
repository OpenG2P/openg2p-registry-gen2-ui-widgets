import { DataSource, DataSourceRequestHandler } from '../types';
import { getValueByPath } from './pathUtils';

/**
 * Get static data source options
 */
export const getStaticDataSource = (dataSource: Extract<DataSource, { type: 'static' }>): any[] => {
  return dataSource.options || [];
};

/**
 * Get API data source options
 * Uses dataSourceRequestHandler to make API calls through host application
 */
export const getApiDataSource = async (
  dataSource: Extract<DataSource, { type: 'api' }>,
  allValues: Record<string, any>,
  dataSourceRequestHandler: DataSourceRequestHandler,
  levelId?: string // Optional level_id from widget-geo-config.level
): Promise<any[]> => {
  if (!dataSourceRequestHandler) {
    console.error('[getApiDataSource] dataSourceRequestHandler is required for API data sources');
    return [];
  }

  try {
    // Get dependency value if exists
    // dependsOn can be either a data path (e.g., "person.address") or a widget-id
    let depValue: any = null;
    if (dataSource.dependsOn) {
      // First try as data path
      depValue = getValueByPath(allValues, dataSource.dependsOn);

      // If not found and doesn't contain dots, try as widget-id
      if ((depValue === null || depValue === undefined) && !dataSource.dependsOn.includes('.')) {
        depValue = allValues[dataSource.dependsOn];
      }

      if (depValue === null || depValue === undefined || depValue === '') {
        // If dependency is empty, return empty array
        return [];
      }
    }

    // Build request parameters
    const method = dataSource.method || 'GET';

    // Extract static params from dataSource
    // Include explicit params object and any additional fields (like level_id)
    const staticParams: Record<string, any> = { ...dataSource.params };

    // Extract additional fields that aren't part of the standard ApiDataSource interface
    // These are fields like level_id that might be directly on the dataSource
    // BUT: level_id should come from widget-geo-config.level, not from dataSource
    const standardFields = ['type', 'service', 'endpoint', 'url', 'method', 'dependsOn', 'valueKey', 'labelKey', 'headers', 'body', 'params', 'level_id'];
    for (const [key, value] of Object.entries(dataSource)) {
      if (!standardFields.includes(key) && value !== undefined && value !== null) {
        staticParams[key] = value;
      }
    }

    // If levelId is provided (from widget-geo-config.level), use it instead of any level_id in dataSource
    if (levelId) {
      staticParams.level_id = levelId;
    }

    // Build request params object
    const requestParams: Record<string, any> = { ...staticParams };

    // Add dependency value to params
    if (dataSource.dependsOn && depValue !== null && depValue !== undefined) {
      // Extract the actual value ID if depValue is an object
      const parentValueId = typeof depValue === 'object' && depValue !== null
        ? (depValue.level_value_id || depValue.id || depValue.value || depValue)
        : depValue;

      // For geo APIs, use parent_level_value_id
      if (staticParams.level_id) {
        requestParams.parent_level_value_id = parentValueId;
      } else {
        // For other APIs, use the dependency field name as param key
        const paramKey = dataSource.dependsOn.split('.').pop() || 'filter';
        requestParams[paramKey] = parentValueId;
      }
    } else if (staticParams.level_id) {
      // First level has no parent
      requestParams.parent_level_value_id = null;
    }

    // Get service mnemonic and endpoint (required)
    const service = dataSource.service;
    const endpoint = dataSource.endpoint;

    if (!service) {
      console.error('[getApiDataSource] API data source missing service mnemonic. Use "service" field instead of "url"');
      return [];
    }

    if (!endpoint) {
      console.error('[getApiDataSource] API data source missing endpoint. Use "endpoint" field to specify the operation (e.g., "get_g2p_geo_level_values")');
      return [];
    }

    let response: any;
    try {
      response = await dataSourceRequestHandler(
        service,
        endpoint,
        method,
        requestParams,
        {
          headers: dataSource.headers,
        }
      );
    } catch (error) {
      console.error('[getApiDataSource] Handler error:', error);
      throw error;
    }

    // Handle OpenG2P response format (response_body.response_payload)
    if (response && typeof response === 'object') {
      if (response.response_body?.response_payload && Array.isArray(response.response_body.response_payload)) {
        return response.response_body.response_payload;
      }
    }

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
