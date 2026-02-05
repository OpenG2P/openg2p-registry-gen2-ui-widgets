import React, { createContext, useContext, ReactNode, useEffect, useMemo } from 'react';
import { Provider } from 'react-redux';
import { DataSourceRequestHandler } from '../types';
import { createWidgetStore, WidgetStore } from '../store';
import { setValues } from '../store/widgetSlice';
import { WidgetEventBus } from '../events/WidgetEventBus';
import { WidgetEventBusContext } from '../hooks/useWidgetEventBus';

export interface WidgetProviderProps {
  store?: WidgetStore;
  dataSourceRequestHandler?: DataSourceRequestHandler; // Required for widgets with API data sources
  schemaData?: Record<string, any>;
  translate?: (key: string, options?: any) => string;
  children: ReactNode;
}

const WidgetContext = createContext<{
  dataSourceRequestHandler?: DataSourceRequestHandler;
  schemaData?: Record<string, any>;
  translate?: (key: string, options?: any) => string;
}>({
  dataSourceRequestHandler: undefined,
  schemaData: undefined,
  translate: undefined,
});

export const useWidgetContext = () => {
  return useContext(WidgetContext);
};

export const WidgetProvider = ({
  store,
  dataSourceRequestHandler,
  schemaData,
  translate,
  children,
}: WidgetProviderProps) => {
  const widgetStore = useMemo(() => store || createWidgetStore(), [store]);
  
  // Create event bus instance (one per provider)
  const eventBus = useMemo(() => new WidgetEventBus(), []);

  // Memoize context value to prevent unnecessary re-renders
  const contextValue = useMemo(
    () => ({
      dataSourceRequestHandler,
      schemaData,
      translate,
    }),
    [dataSourceRequestHandler, schemaData, translate]
  );

  // Warn if dataSourceRequestHandler is missing (will cause issues with API data sources)
  useEffect(() => {
    if (!dataSourceRequestHandler) {
      console.warn(
        '[WidgetProvider] dataSourceRequestHandler is not provided. ' +
        'Widgets with API data sources will not be able to load data. ' +
        'Please provide dataSourceRequestHandler prop to WidgetProvider.'
      );
    }
  }, [dataSourceRequestHandler]);

  // Cleanup event bus on unmount
  useEffect(() => {
    return () => {
      eventBus.clear();
    };
  }, [eventBus]);

  // Initialize schemaData to Redux store (only on mount)
  // This prevents overwriting user changes when schemaData prop changes
  useEffect(() => {
    if (schemaData) {
      widgetStore.dispatch(setValues(schemaData));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schemaData, widgetStore]); // Only run on mount

  const content = (
    <Provider store={widgetStore}>
      <WidgetContext.Provider value={contextValue}>
        <WidgetEventBusContext.Provider value={eventBus}>
          {children}
        </WidgetEventBusContext.Provider>
      </WidgetContext.Provider>
    </Provider>
  );

  return content;
};

