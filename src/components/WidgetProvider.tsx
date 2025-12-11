import React, { createContext, useContext, ReactNode } from 'react';
import { Provider } from 'react-redux';
import { ApiAdapter } from '../types';
import { createWidgetStore, WidgetStore } from '../store';

export interface WidgetProviderProps {
  store?: WidgetStore;
  apiAdapter?: ApiAdapter;
  schemaData?: Record<string, any>;
  children: ReactNode;
}

const WidgetContext = createContext<{
  apiAdapter?: ApiAdapter;
  schemaData?: Record<string, any>;
}>({
  apiAdapter: undefined,
  schemaData: undefined,
});

export const useWidgetContext = () => {
  return useContext(WidgetContext);
};

export const WidgetProvider = ({
  store,
  apiAdapter,
  schemaData,
  children,
}: WidgetProviderProps) => {
  const widgetStore = store || createWidgetStore();

  return (
    <Provider store={widgetStore}>
      <WidgetContext.Provider value={{ apiAdapter, schemaData }}>
        {children}
      </WidgetContext.Provider>
    </Provider>
  );
};

