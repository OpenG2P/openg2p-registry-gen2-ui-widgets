/**
 * Standalone app to run SectionBuilder example
 * Run with: npx vite (after setting up vite.config.ts)
 * 
 * This example shows how to integrate SectionBuilder in a host application.
 * For height adaptation, ensure the container has a defined height.
 * 
 * Host Application Pattern:
 * <div className="p-8">
 *   <div className="bg-white rounded-[30px] p-8 h-full w-full">
 *     <SectionBuilder ... />
 *   </div>
 * </div>
 * 
 * Note: Use h-full (height: 100%) instead of min-h-[600px] to fill available space.
 * The parent container should have flex-1 or a defined height.
 */

import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Provider } from 'react-redux';
import { SectionBuilder } from '../src/components/SectionBuilder';
import { SectionConfig } from '../src/types';
import { createWidgetStore } from '../src/store';
import { WidgetProvider } from '../src/components/WidgetProvider';

// Create Redux store
const store = createWidgetStore();

// Example section data
const initialSection: SectionConfig = {
  'section-id': 'example-section',
  'section-title': 'Example Section',
  'section-editable': true,
  panels: [
    {
      'panel-id': 'personal-details',
      'panel-orientation': 'horizontal',
      panels: [
        {
          'panel-id': 'left-column',
          'panel-orientation': 'vertical',
          widgets: [
            {
              widget: 'text',
              'widget-type': 'input',
              'widget-id': 'name',
              'widget-label': 'Full Name',
              'widget-data-path': 'person.name',
              'widget-required': true,
              'widget-readonly': false,
            },
            {
              widget: 'text',
              'widget-type': 'input',
              'widget-id': 'email',
              'widget-label': 'Email Address',
              'widget-data-path': 'person.email',
              'widget-data-validation': {
                validationType: 'email',
                required: true,
              },
            },
          ],
        },
        {
          'panel-id': 'right-column',
          'panel-orientation': 'vertical',
          widgets: [
            {
              widget: 'number',
              'widget-type': 'input',
              'widget-id': 'age',
              'widget-label': 'Age',
              'widget-data-path': 'person.age',
              'widget-data-validation': {
                min: 0,
                max: 120,
              },
            },
            {
              widget: 'date',
              'widget-type': 'input',
              'widget-id': 'dob',
              'widget-label': 'Date of Birth',
              'widget-data-path': 'person.dob',
            },
          ],
        },
      ],
    },
  ],
};

function App() {
  const [section, setSection] = useState<SectionConfig>(initialSection);

  const handleSectionChange = (updatedSection: SectionConfig) => {
    setSection(updatedSection);
    console.log('Section updated:', updatedSection);
  };

  const handleSave = (savedSection: SectionConfig) => {
    console.log('Section saved:', savedSection);
    alert('Section saved! Check console for JSON output.');
  };

  return (
    <Provider store={store}>
      <WidgetProvider store={store}>
        <div style={{ 
          width: '100%', 
          height: '100vh',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'stretch',
          background: '#f5f5f5',
          padding: '20px',
          boxSizing: 'border-box',
          overflow: 'hidden',
        }}>
          <div style={{ 
            width: '100%',
            maxWidth: '1400px',
            margin: '0 auto',
            boxSizing: 'border-box',
            display: 'flex',
            flexDirection: 'column',
            flex: '1 1 0',
            minHeight: 0,
            overflow: 'hidden',
          }}>
            <SectionBuilder
              initialSection={section}
              onChange={handleSectionChange}
              onSave={handleSave}
            />
          </div>
        </div>
      </WidgetProvider>
    </Provider>
  );
}

// Render the app
const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(<App />);
}
