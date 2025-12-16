import React from 'react';
import { SectionConfig } from '../types';
import { UseBaseWidgetOptions } from '../hooks/useBaseWidget';
import { PanelRenderer } from './PanelRenderer';
import { useWidgetTranslation } from '../hooks/useWidgetTranslation';

export interface SectionRendererProps {
  section: SectionConfig;
  apiAdapter?: UseBaseWidgetOptions['apiAdapter'];
  schemaData?: UseBaseWidgetOptions['schemaData'];
  onValueChange?: UseBaseWidgetOptions['onValueChange'];
}

/**
 * Renders a section with its panels
 * 
 * Layout behavior:
 * - Section width is based on max 3 panels (or more on high resolution)
 * - Panels wrap when they exceed available width
 * - Sections can sit side-by-side if there's space
 */
export const SectionRenderer = ({
  section,
  apiAdapter,
  schemaData,
  onValueChange,
}: SectionRendererProps) => {
  const { translateConfig } = useWidgetTranslation();

  const sectionId = section['section-id'];
  const gridId = `section-panels-${sectionId}`;
  const sectionClassId = `section-${sectionId}`;

  return (
    <>
      <style>{`
        .${sectionClassId} {
          /* Section width: sum of max 3 panels (or more on high resolution) */
          /* Base: full width to accommodate 3 panels */
          /* On larger screens: can be narrower to allow side-by-side sections */
          flex: 1 1 100%;
          min-width: 0;
        }
        @media (min-width: 1024px) {
          .${sectionClassId} {
            /* Desktop: section width for 3 panels, allows 2 sections side-by-side */
            flex: 1 1 calc(50% - 0.75rem);
            min-width: calc(3 * (33.333% - 1rem) + 2rem); /* 3 panels + gaps */
          }
        }
        @media (min-width: 1280px) {
          .${sectionClassId} {
            /* Large: can fit 3 sections side-by-side */
            flex: 1 1 calc(33.333% - 1rem);
          }
        }
        
        #${gridId} {
          display: flex;
          flex-wrap: wrap;
          gap: 1.5rem;
          width: 100%;
        }
        #${gridId} > .panel-wrapper {
          flex: 1 1 100%;
          min-width: 0;
        }
        /* Mobile: 1 panel per row */
        @media (min-width: 640px) {
          #${gridId} > .panel-wrapper {
            flex: 1 1 calc(50% - 0.75rem);
          }
        }
        /* Tablet/Desktop: 3 panels per row (max) */
        @media (min-width: 1024px) {
          #${gridId} > .panel-wrapper {
            flex: 1 1 calc(33.333% - 1rem);
          }
        }
        /* Large screens: 4 panels per row */
        @media (min-width: 1280px) {
          #${gridId} > .panel-wrapper {
            flex: 1 1 calc(25% - 1.125rem);
          }
        }
        /* XL screens: 5 panels per row */
        @media (min-width: 1536px) {
          #${gridId} > .panel-wrapper {
            flex: 1 1 calc(20% - 1.2rem);
          }
        }
      `}</style>
      <div 
        className={`section ${sectionClassId} px-4 sm:px-6 lg:px-8`}
        data-section-id={sectionId}
      >
        {section['section-title'] && (
          <h2 className="text-xl font-semibold mb-4">{translateConfig(section['section-title'])}</h2>
        )}
        <div id={gridId} className="section-panels">
          {section.panels.map((panel, index) => (
            <div
              key={panel['panel-id'] || `section-panel-${index}`}
              className="panel-wrapper"
            >
              <PanelRenderer
                panel={panel}
                apiAdapter={apiAdapter}
                schemaData={schemaData}
                onValueChange={onValueChange}
              />
            </div>
          ))}
        </div>
      </div>
    </>
  );
};

