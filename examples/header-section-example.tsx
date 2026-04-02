/**
 * Header Section Widget Example
 *
 * Demonstrates the HeaderSectionWidget in a RegistryView with:
 * - Full-width section spanning all 3 columns
 * - View mode: profile image, name, functional ID, status badge, metadata
 * - Edit mode: status dropdown + status reason text input become editable
 * - widget-field-config for explicit per-field data source mapping
 */

import React, { useMemo } from 'react';
import { createWidgetStore } from '../src/store';
import { WidgetProvider, SectionsContainer } from '../src';
import type { SectionConfig } from '../src/types';
import type { SectionChanges } from '../src/components/SectionRenderer';

// ── Schema data (simulates API response) ────────────────────────
const schemaData = {
  registrant: {
    record_name: 'Sarah Elizabeth',
    functional_record_id: '1234567890',
    record_image_storage_id: '',
    record_status: 'active',
    record_status_reason: 'Reason text here',
    created_by: 'Robert David',
    created_at: '14 Jan 2025',
    last_approved_by: 'Linda Susan',
    last_approved_at: '20 Mar 2026',
    first_name: 'Sarah',
    last_name: 'Elizabeth',
    date_of_birth: '1990-05-15',
    gender: 'Female',
    email: 'sarah.elizabeth@example.com',
    phone: '+1 (555) 012-3456',
    nationality: 'American',
    language: 'English',
    address: {
      street: '123 Main Street',
      city: 'Springfield',
      state: 'Illinois',
      postal_code: '62704',
    },
  },
};

// ── Header section config ───────────────────────────────────────
const headerSection: SectionConfig = {
  'section-id': 'header-section',
  'section-title': '',
  'section-editable': true,
  'section-column-span': 3,
  panels: [
    {
      'panel-id': 'header-panel',
      'panel-orientation': 'vertical',
      'panel-column-span': 3,
      widgets: [
        {
          widget: 'header-section',
          'widget-type': 'group',
          'widget-id': 'registry-header',
          'widget-data-path': {
            image: 'registrant.record_image_storage_id',
            name: 'registrant.record_name',
            functionalId: 'registrant.functional_record_id',
            status: 'registrant.record_status',
            statusReason: 'registrant.record_status_reason',
            createdBy: 'registrant.created_by',
            createdAt: 'registrant.created_at',
            lastApprovedBy: 'registrant.last_approved_by',
            lastApprovedAt: 'registrant.last_approved_at',
          },
          'widget-field-config': {
            status: {
              'data-source': {
                type: 'static',
                options: [
                  { value: 'active', label: 'Active' },
                  { value: 'inactive', label: 'Inactive' },
                  { value: 'archived', label: 'Archived' },
                ],
              },
            },
          },
          'widget-data-format': {
            imageSize: 120,
            nameColor: '#ED7C22',
            statusColors: {
              active: '#16A34A',
              inactive: '#D97706',
              archived: '#6B7280',
            },
          },
        },
      ],
    },
  ],
};

// ── Registrant details section with 3 vertical panels ───────────
const registrantDetailsSection: SectionConfig = {
  'section-id': 'registrant-details',
  'section-title': 'Registrant Details',
  'section-editable': true,
  'section-column-span': 3,
  panels: [
    {
      'panel-id': 'personal-info',
      'panel-orientation': 'vertical',
      widgets: [
        {
          widget: 'text',
          'widget-type': 'input',
          'widget-id': 'first-name',
          'widget-label': 'First Name',
          'widget-data-path': 'registrant.first_name',
        },
        {
          widget: 'text',
          'widget-type': 'input',
          'widget-id': 'last-name',
          'widget-label': 'Last Name',
          'widget-data-path': 'registrant.last_name',
        },
        {
          widget: 'date',
          'widget-type': 'input',
          'widget-id': 'dob',
          'widget-label': 'Date of Birth',
          'widget-data-path': 'registrant.date_of_birth',
        },
        {
          widget: 'text',
          'widget-type': 'input',
          'widget-id': 'gender',
          'widget-label': 'Gender',
          'widget-data-path': 'registrant.gender',
        },
      ],
    },
    {
      'panel-id': 'contact-info',
      'panel-orientation': 'vertical',
      widgets: [
        {
          widget: 'text',
          'widget-type': 'input',
          'widget-id': 'email',
          'widget-label': 'Email',
          'widget-data-path': 'registrant.email',
          'widget-data-validation': { validationType: 'email' },
        },
        {
          widget: 'text',
          'widget-type': 'input',
          'widget-id': 'phone',
          'widget-label': 'Phone Number',
          'widget-data-path': 'registrant.phone',
        },
        {
          widget: 'text',
          'widget-type': 'input',
          'widget-id': 'nationality',
          'widget-label': 'Nationality',
          'widget-data-path': 'registrant.nationality',
        },
        {
          widget: 'text',
          'widget-type': 'input',
          'widget-id': 'language',
          'widget-label': 'Language',
          'widget-data-path': 'registrant.language',
        },
      ],
    },
    {
      'panel-id': 'address-info',
      'panel-orientation': 'vertical',
      widgets: [
        {
          widget: 'text',
          'widget-type': 'input',
          'widget-id': 'street',
          'widget-label': 'Street',
          'widget-data-path': 'registrant.address.street',
        },
        {
          widget: 'text',
          'widget-type': 'input',
          'widget-id': 'city',
          'widget-label': 'City',
          'widget-data-path': 'registrant.address.city',
        },
        {
          widget: 'text',
          'widget-type': 'input',
          'widget-id': 'state',
          'widget-label': 'State',
          'widget-data-path': 'registrant.address.state',
        },
        {
          widget: 'text',
          'widget-type': 'input',
          'widget-id': 'postal-code',
          'widget-label': 'Postal Code',
          'widget-data-path': 'registrant.address.postal_code',
        },
      ],
    },
  ],
};

// Header section first, then a 3-panel registrant details section below
const allSections: SectionConfig[] = [
  headerSection,
  registrantDetailsSection,
];

// ── Example component ───────────────────────────────────────────
export const HeaderSectionExample = () => {
  const store = useMemo(() => createWidgetStore(), []);

  const handleSectionSave = async (changes: SectionChanges) => {
    console.log('Section saved:', changes);
    alert(`Section "${changes.section_id}" saved!\nRecords: ${JSON.stringify(changes.records, null, 2)}\nCheck console for details.`);
  };

  return (
    <WidgetProvider store={store} schemaData={schemaData}>
      <div style={{ padding: '24px', maxWidth: '1241px', margin: '0 auto' }}>
        <h1 style={{ marginBottom: '24px', fontSize: '24px', fontFamily: 'Roboto, sans-serif' }}>
          Registry View — Header Section Widget
        </h1>
        <SectionsContainer
          sections={allSections}
          schemaData={schemaData}
          mode="RegistryView"
          onSectionSave={handleSectionSave}
        />
      </div>
    </WidgetProvider>
  );
};

export default HeaderSectionExample;
