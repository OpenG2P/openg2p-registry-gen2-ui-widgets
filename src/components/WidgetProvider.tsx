import React, { createContext, useContext, ReactNode, useEffect, useState, useMemo } from 'react';
import { Provider } from 'react-redux';
import { I18nextProvider } from 'react-i18next';
import { ApiAdapter } from '../types';
import { createWidgetStore, WidgetStore } from '../store';
import { setValues } from '../store/widgetSlice';
import { initI18n, default as defaultI18n } from '../i18n/config';
import type { i18n as I18nType } from 'i18next';

export interface WidgetProviderProps {
  store?: WidgetStore;
  apiAdapter?: ApiAdapter;
  schemaData?: Record<string, any>;
  i18n?: I18nType;
  i18nConfig?: {
    resources?: Record<string, any>;
    lng?: string;
    fallbackLng?: string;
    debug?: boolean;
    loadPath?: string | string[];
    autoLoad?: boolean;
  };
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
  i18n: customI18n,
  i18nConfig,
  children,
}: WidgetProviderProps) => {
  const widgetStore = useMemo(() => store || createWidgetStore(), [store]);

  // Sync schemaData to Redux store
  useEffect(() => {
    if (schemaData) {
      widgetStore.dispatch(setValues(schemaData));
    }
  }, [schemaData, widgetStore]);

  const [i18nInstance, setI18nInstance] = useState<I18nType | null>(
    customI18n || (i18nConfig?.resources ? null : defaultI18n)
  );
  const [isLoading, setIsLoading] = useState(!customI18n && !!i18nConfig && !i18nConfig.resources);

  useEffect(() => {
    // If custom i18n instance is provided, use it directly
    if (customI18n) {
      setI18nInstance(customI18n);
      setIsLoading(false);
      return;
    }

    // If resources are explicitly provided, initialize synchronously
    if (i18nConfig?.resources) {
      initI18n({ ...i18nConfig, autoLoad: false }).then((instance) => {
        setI18nInstance(instance);
        setIsLoading(false);
      });
      return;
    }

    // If no resources provided, try to auto-load from project
    if (i18nConfig || !defaultI18n.isInitialized) {
      setIsLoading(true);
      initI18n(i18nConfig || { autoLoad: true }).then((instance) => {
        setI18nInstance(instance);
        setIsLoading(false);
      });
    }
  }, [customI18n, i18nConfig]);

  const content = (
    <Provider store={widgetStore}>
      <WidgetContext.Provider value={{ apiAdapter, schemaData }}>
        {children}
      </WidgetContext.Provider>
    </Provider>
  );

  // Show loading state or wait for i18n to be ready
  if (isLoading || !i18nInstance) {
    return <div>{content}</div>; // Render content even while loading translations
  }

  // Always wrap with I18nextProvider since we always have an i18n instance
  return (
    <I18nextProvider i18n={i18nInstance}>
      {content}
    </I18nextProvider>
  );
};

