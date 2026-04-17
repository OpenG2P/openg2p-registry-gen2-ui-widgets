/**
 * Scores Display Widget Example
 *
 * Demonstrates the ScoresDisplayWidget in a full-width section.
 * The API handler below is a small mock; in a host app you would route
 * `service + endpoint` to your API gateway.
 */

import React, { useMemo } from 'react';
import { createWidgetStore } from '../src/store';
import { WidgetProvider, SectionsContainer } from '../src';
import type { DataSourceRequestHandler, SectionConfig } from '../src/types';

const schemaData = {
  internal_record_id: 'INT-0000123',
};

const mockHandler: DataSourceRequestHandler = async (service, endpoint, method, params) => {
  void service;
  void endpoint;
  void method;
  void params;
  if (service === 'staff-portal-api' && endpoint === 'get_scores') {
    return {
      scores: [
        {
          score_type: 'PMT',
          computed_score: 42,
          computed_at: '2026-04-16T10:12:00Z',
          triggered_by_cr_id: 'CR-001',
        },
      ],
    };
  }
  return { scores: [] };
};

const scoresSection: SectionConfig = {
  'section-id': 'scores',
  'section-title': '',
  'section-editable': false,
  'section-column-span': 3,
  'section-hide-edit-button': true, // Hide the edit button band below the section
  panels: [
    {
      'panel-id': 'scores-panel',
      'panel-orientation': 'vertical',
      'panel-column-span': 3,
      widgets: [
        {
          widget: 'scores-display',
          'widget-type': 'group',
          'widget-id': 'record-scores',
          'widget-readonly': true,
          'widget-data-source': {
            type: 'api',
            service: 'staff-portal-api',
            endpoint: 'get_scores',
            method: 'POST',
            params: { internal_record_id_path: 'internal_record_id' },
          },
        },
      ],
    },
  ],
};

export const ScoresDisplayExample = () => {
  const store = useMemo(() => createWidgetStore(), []);
  return (
    <WidgetProvider store={store} schemaData={schemaData} dataSourceRequestHandler={mockHandler}>
      <div style={{ padding: '24px', maxWidth: '1241px', margin: '0 auto' }}>
        <h1 style={{ fontSize: '24px', fontFamily: 'Roboto, sans-serif', margin: '0 0 24px 0' }}>
          Registry View — Scores Display Widget
        </h1>
        <SectionsContainer sections={[scoresSection]} schemaData={schemaData} mode="RegistryView" hideEditButton />
      </div>
    </WidgetProvider>
  );
};

export default ScoresDisplayExample;

