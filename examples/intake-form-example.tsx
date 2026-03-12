/**
 * IntakeForm Mode Example
 *
 * Demonstrates SectionsContainer with mode="IntakeForm" for registration forms.
 * Features:
 * - Accordion layout: sections collapse/expand on header click
 * - First section expanded by default
 * - Previous/Save buttons for stepwise navigation
 * - isDraft: when true/undefined, sections are editable; when false, readonly
 */

import React, { useMemo } from 'react';
import { createWidgetStore } from '../src/store';
import { WidgetProvider, SectionsContainer } from '../src';
import type { SectionConfig } from '../src/types';
import type { SectionChanges } from '../src/components/SectionRenderer';

const familyInfoSection: SectionConfig = {
  'section-id': 'family-info',
  'section-title': 'Family Information',
  'section-editable': true,
  panels: [
    {
      'panel-id': 'family-details',
      'panel-orientation': 'vertical',
      widgets: [
        {
          widget: 'text',
          'widget-type': 'input',
          'widget-id': 'household-name',
          'widget-label': 'Household Name',
          'widget-data-path': 'household.name',
        },
        {
          widget: 'number',
          'widget-type': 'input',
          'widget-id': 'member-count',
          'widget-label': 'Number of Members',
          'widget-data-path': 'household.memberCount',
        },
      ],
    },
  ],
};

const memberInfoSection: SectionConfig = {
  'section-id': 'member-info',
  'section-title': 'Family Member Information',
  'section-editable': true,
  panels: [
    {
      'panel-id': 'member-details',
      'panel-orientation': 'vertical',
      widgets: [
        {
          widget: 'text',
          'widget-type': 'input',
          'widget-id': 'member-name',
          'widget-label': 'Full Name',
          'widget-data-path': 'member.name',
        },
        {
          widget: 'text',
          'widget-type': 'input',
          'widget-id': 'member-email',
          'widget-label': 'Email',
          'widget-data-path': 'member.email',
          'widget-data-validation': { validationType: 'email' },
        },
        {
          widget: 'text',
          'widget-type': 'input',
          'widget-id': 'member-phone',
          'widget-label': 'Phone',
          'widget-data-path': 'member.phone',
        },
      ],
    },
  ],
};

const intakeFormSections: SectionConfig[] = [familyInfoSection, memberInfoSection];

export const IntakeFormExample = () => {
  const store = useMemo(() => createWidgetStore(), []);
  const schemaData = useMemo(() => ({}), []);

  const handleSectionSave = async (changes: SectionChanges) => {
    console.log('Section saved:', changes);
    // Host application would call API here, e.g. POST /registrations/{id}/sections
  };

  return (
    <WidgetProvider store={store} schemaData={schemaData}>
      <div style={{ padding: '24px', maxWidth: '800px', margin: '0 auto' }}>
        <h1 style={{ marginBottom: '24px', fontSize: '24px' }}>Intake Form</h1>
        <SectionsContainer
          sections={intakeFormSections}
          mode="IntakeForm"
          isDraft={true}
          onSectionSave={handleSectionSave}
        />
      </div>
    </WidgetProvider>
  );
};

export default IntakeFormExample;
