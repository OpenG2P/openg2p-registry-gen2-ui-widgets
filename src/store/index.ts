import { configureStore } from '@reduxjs/toolkit';
import widgetReducer from './widgetSlice';

export const createWidgetStore = () => {
  return configureStore({
    reducer: {
      widget: widgetReducer,
    },
    middleware: (getDefaultMiddleware) =>
      getDefaultMiddleware({
        serializableCheck: {
          // Ignore these action types
          ignoredActions: ['widget/setValue', 'widget/setValues'],
        },
      }),
  });
};

export type WidgetStore = ReturnType<typeof createWidgetStore>;
export type WidgetRootState = ReturnType<WidgetStore['getState']>;
export type WidgetDispatch = WidgetStore['dispatch'];

