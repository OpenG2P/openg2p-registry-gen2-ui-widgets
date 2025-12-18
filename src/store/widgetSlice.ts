import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { WidgetState, WidgetValue } from '../types';

const initialState: WidgetState = {
  values: {},
  errors: {},
  touched: {},
  loading: {},
  dataSources: {},
};

const widgetSlice = createSlice({
  name: 'widget',
  initialState,
  reducers: {
    setValue: (
      state,
      action: PayloadAction<{ widgetId: string; value: WidgetValue }>
    ) => {
      state.values[action.payload.widgetId] = action.payload.value;
      // Clear errors when value changes
      if (state.errors[action.payload.widgetId]) {
        delete state.errors[action.payload.widgetId];
      }
    },
    setValues: (state, action: PayloadAction<Record<string, WidgetValue>>) => {
      state.values = { ...state.values, ...action.payload };
    },
    setError: (
      state,
      action: PayloadAction<{ widgetId: string; errors: string[] }>
    ) => {
      if (action.payload.errors.length > 0) {
        state.errors[action.payload.widgetId] = action.payload.errors;
      } else {
        delete state.errors[action.payload.widgetId];
      }
    },
    setTouched: (
      state,
      action: PayloadAction<{ widgetId: string; touched: boolean }>
    ) => {
      state.touched[action.payload.widgetId] = action.payload.touched;
    },
    setLoading: (
      state,
      action: PayloadAction<{ widgetId: string; loading: boolean }>
    ) => {
      state.loading[action.payload.widgetId] = action.payload.loading;
    },
    setDataSource: (
      state,
      action: PayloadAction<{ widgetId: string; data: any[] }>
    ) => {
      state.dataSources[action.payload.widgetId] = action.payload.data;
    },
    resetWidget: (state, action: PayloadAction<string>) => {
      const widgetId = action.payload;
      delete state.values[widgetId];
      delete state.errors[widgetId];
      delete state.touched[widgetId];
      delete state.loading[widgetId];
      delete state.dataSources[widgetId];
    },
    resetAll: () => initialState,
  },
});

export const {
  setValue,
  setValues,
  setError,
  setTouched,
  setLoading,
  setDataSource,
  resetWidget,
  resetAll,
} = widgetSlice.actions;

export default widgetSlice.reducer;

