import React, { createContext, useContext, ReactNode, useEffect, useMemo } from 'react';
import { Provider } from 'react-redux';
import { ApiAdapter } from '../types';
import { createWidgetStore, WidgetStore } from '../store';
import { setValues } from '../store/widgetSlice';

export interface WidgetProviderProps {
  store?: WidgetStore;
  apiAdapter?: ApiAdapter;
  schemaData?: Record<string, any>;
  translate?: (key: string, options?: any) => string;
  children: ReactNode;
}

const WidgetContext = createContext<{
  apiAdapter?: ApiAdapter;
  schemaData?: Record<string, any>;
  translate?: (key: string, options?: any) => string;
}>({
  apiAdapter: undefined,
  schemaData: undefined,
  translate: undefined,
});

export const useWidgetContext = () => {
  return useContext(WidgetContext);
};

export const WidgetProvider = ({
  store,
  apiAdapter,
  schemaData,
  translate,
  children,
}: WidgetProviderProps) => {
  const widgetStore = useMemo(() => store || createWidgetStore(), [store]);

  // Sync schemaData to Redux store
  useEffect(() => {
    if (schemaData) {
      widgetStore.dispatch(setValues(schemaData));
    }
  }, [schemaData, widgetStore]);

  const content = (
    <Provider store={widgetStore}>
      <WidgetContext.Provider value={{ apiAdapter, schemaData, translate }}>
        {children}
      </WidgetContext.Provider>
    </Provider>
  );

  return content;
};

