/**
 * IntakeForm Mode Example
 *
 * Demonstrates SectionsContainer with mode="IntakeForm" for registration forms.
 * Features:
 * - Accordion layout: sections collapse/expand on header click
 * - First section expanded by default
 * - Previous/Save buttons for stepwise navigation
 * - isDraft: when true/undefined, sections are editable; when false, readonly
 * - onFormReady: host receives form controls to place Submit button anywhere
 */

import React, { useMemo, useState } from 'react';
import { createWidgetStore } from '../src/store';
import { WidgetProvider, SectionsContainer } from '../src';
import type { SectionConfig } from '../src/types';
import type { SectionChanges, SectionsFormHandle } from '../src/components/SectionsContainer';

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
  const [formHandle, setFormHandle] = useState<SectionsFormHandle | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSectionSave = async (_changes: SectionChanges) => {
    console.log('Section saved (per-section):', _changes);
  };

  const handleSubmit = async () => {
    if (!formHandle) return;
    setIsSubmitting(true);
    try {
      const sections = await formHandle.validateAndGetData();
      console.log('All sections data:', sections);
      alert(`Form submitted! Check console for data.\nSections: ${sections.length}`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Submit failed';
      console.warn(msg, e);
      alert(msg);
    } finally {
      setIsSubmitting(false);
    }
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
          onFormReady={setFormHandle}
          namespace={(_, i) => `section-${i}`}
        />
        <div style={{ marginTop: '24px', display: 'flex', justifyContent: 'flex-end' }}>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!formHandle || isSubmitting}
            style={{
              padding: '10px 24px',
              background: formHandle && !isSubmitting ? '#2563eb' : '#9ca3af',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: formHandle && !isSubmitting ? 'pointer' : 'not-allowed',
              fontWeight: 600,
            }}
          >
            {isSubmitting ? 'Submitting...' : 'Submit'}
          </button>
        </div>
      </div>
    </WidgetProvider>
  );
};

export default IntakeFormExample;
