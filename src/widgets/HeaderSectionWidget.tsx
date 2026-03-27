import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { useBaseWidget } from '../hooks/useBaseWidget';
import { BaseWidgetConfig, DataSource } from '../types';
import { useWidgetTranslation } from '../hooks/useWidgetTranslation';
import { WidgetRootState } from '../store';
import { setValues } from '../store/widgetSlice';
import { useWidgetContext } from '../components/WidgetProvider';
import { getValueByPath, setValueByPath } from '../utils/pathUtils';
import {
  getStaticDataSource,
  getApiDataSource,
  getSchemaDataSource,
  transformDataSourceOptions,
} from '../utils/dataSource';
import { dummyProfile } from '../assets';

/**
 * Header Section Widget - full-width header card for registry views
 *
 * Displays a profile image, record name, functional ID, status, and metadata
 * in a two-column internal layout that spans the entire section.
 *
 * ── widget-data-path (object, required) ──────────────────────────
 *   Maps logical field keys to data paths in the store / schemaData.
 *
 *   Key             | Description
 *   --------------- | -----------------------------------------------
 *   image           | Profile image URL        (e.g. "record_image_storage_id")
 *   name            | Record display name      (e.g. "record_name")
 *   functionalId    | Functional record ID     (e.g. "functional_record_id")
 *   status          | Record status value      (e.g. "record_status")
 *   statusReason    | Reason for the status    (e.g. "record_status_reason")
 *   createdBy       | Creator name             (e.g. "created_by")
 *   createdAt       | Creation date            (e.g. "created_at")
 *   lastApprovedBy  | Last approver name       (e.g. "last_approved_by")
 *   lastApprovedAt  | Last approval date       (e.g. "last_approved_at")
 *
 * ── widget-field-config (object, optional) ───────────────────────
 *   Per-field configuration. Each key matches a widget-data-path key.
 *   Currently supported sub-properties:
 *
 *   "data-source"  – A standard DataSource object (static / api / schema)
 *                    that provides options for that field's control when
 *                    the widget is in edit mode.
 *
 *   Example:
 *     "widget-field-config": {
 *       "status": {
 *         "data-source": {
 *           "type": "static",
 *           "options": [
 *             { "value": "active",   "label": "Active" },
 *             { "value": "inactive", "label": "Inactive" },
 *             { "value": "archived", "label": "Archived" }
 *           ]
 *         }
 *       }
 *     }
 *
 * ── Editable fields (when widget-readonly is false) ──────────────
 *   - status        → <select> dropdown, options from widget-field-config.status.data-source
 *   - statusReason  → <input type="text">
 *
 * ── widget-data-format (object, optional) ────────────────────────
 *   Key           | Type                     | Default
 *   ------------- | ------------------------ | ----------------------------
 *   imageSize     | number (px)              | 90
 *   nameColor     | CSS colour string        | '#ED7C22'
 *   statusColors  | Record<string, string>   | green/red/amber defaults
 *
 * ── Full example ─────────────────────────────────────────────────
 * ```json
 * {
 *   "widget": "header-section",
 *   "widget-type": "group",
 *   "widget-id": "registry-header",
 *   "widget-data-path": {
 *     "image": "record_image_storage_id",
 *     "name": "record_name",
 *     "functionalId": "functional_record_id",
 *     "status": "record_status",
 *     "statusReason": "record_status_reason",
 *     "createdBy": "created_by",
 *     "createdAt": "created_at",
 *     "lastApprovedBy": "last_approved_by",
 *     "lastApprovedAt": "last_approved_at"
 *   },
 *   "widget-field-config": {
 *     "status": {
 *       "data-source": {
 *         "type": "static",
 *         "options": [
 *           { "value": "active",   "label": "Active" },
 *           { "value": "inactive", "label": "Inactive" },
 *           { "value": "archived", "label": "Archived" }
 *         ]
 *       }
 *     }
 *   },
 *   "widget-data-format": {
 *     "imageSize": 90,
 *     "nameColor": "#ED7C22",
 *     "statusColors": {
 *       "active":   "#16A34A",
 *       "inactive": "#D97706",
 *       "archived": "#6B7280"
 *     }
 *   }
 * }
 * ```
 */

interface FieldConfig {
  'data-source'?: DataSource;
  [key: string]: any;
}

interface HeaderSectionWidgetProps {
  config: BaseWidgetConfig;
}

const DEFAULT_STATUS_COLORS: Record<string, string> = {
  active: '#16A34A',
  inactive: '#D97706',
  archived: '#6B7280',
};

// ── Hook: load data-source options for a single field ────────────
// Options are loaded in both view and edit modes because view mode
// needs them to resolve display labels (e.g. "active" → "Active").
// For API data sources, loading is deferred to edit mode to avoid
// unnecessary network calls when only labels are needed.
function useFieldDataSource(
  fieldKey: string,
  fieldConfig: FieldConfig | undefined,
  isReadonly: boolean,
) {
  const [options, setOptions] = useState<Array<{ value: any; label: string }>>([]);
  const { dataSourceRequestHandler, schemaData } = useWidgetContext();
  const values = useSelector((state: WidgetRootState) => state.widget.values);

  const dataSource = fieldConfig?.['data-source'] as DataSource | undefined;
  const dsType = dataSource?.type;
  const dsKey = dataSource
    ? `${fieldKey}-${dsType}-${JSON.stringify(dataSource)}`
    : '';

  useEffect(() => {
    if (!dataSource) {
      setOptions([]);
      return;
    }

    // API sources: only fetch when editable to avoid unnecessary calls
    if (dataSource.type === 'api' && isReadonly) {
      return;
    }

    let cancelled = false;

    const load = async () => {
      try {
        let raw: any[] = [];

        if (dataSource.type === 'static') {
          raw = getStaticDataSource(dataSource as any);
        } else if (dataSource.type === 'api') {
          if (!dataSourceRequestHandler) return;
          raw = await getApiDataSource(
            dataSource as any,
            values,
            dataSourceRequestHandler,
          );
        } else if (dataSource.type === 'schema') {
          raw = getSchemaDataSource(dataSource as any, schemaData || {});
        }

        const transformed = transformDataSourceOptions(
          raw,
          (dataSource as any).valueKey,
          (dataSource as any).labelKey,
        );

        if (!cancelled) setOptions(transformed);
      } catch (err) {
        console.error(
          `[HeaderSectionWidget] Error loading data-source for field "${fieldKey}":`,
          err,
        );
        if (!cancelled) setOptions([]);
      }
    };

    load();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dsKey, isReadonly, dataSourceRequestHandler]);

  return options;
}

// ── Main component ───────────────────────────────────────────────
export const HeaderSectionWidget = ({ config }: HeaderSectionWidgetProps) => {
  const {
    config: widgetConfig,
    getFieldValue,
  } = useBaseWidget({ config });

  const dispatch = useDispatch();
  const { translateConfig } = useWidgetTranslation();
  const { schemaData } = useWidgetContext();
  const values = useSelector((state: WidgetRootState) => state.widget.values);

  const isReadonly = widgetConfig['widget-readonly'] !== false;
  const dataPath = widgetConfig['widget-data-path'];

  // ── Per-field config map ──────────────────────────────────────
  const fieldConfigMap = useMemo<Record<string, FieldConfig>>(() => {
    return (widgetConfig as any)['widget-field-config'] || {};
  }, [(widgetConfig as any)['widget-field-config']]);

  // ── Load data source options for the status field ─────────────
  const statusOptions = useFieldDataSource(
    'status',
    fieldConfigMap['status'],
    isReadonly,
  );

  // ── Resolve field values ──────────────────────────────────────
  const paths = useMemo(() => {
    if (!dataPath || typeof dataPath !== 'object') return {} as Record<string, string>;
    return dataPath as Record<string, string>;
  }, [dataPath]);

  const findValue = useCallback(
    (fieldKey: string): any => {
      const path = (paths as Record<string, string>)[fieldKey];
      if (!path) return undefined;

      const searchIn = (source: Record<string, any> | undefined): any => {
        if (!source) return undefined;
        let v = getValueByPath(source, path);
        if (v !== undefined) return v;
        for (const obj of Object.values(source)) {
          if (obj && typeof obj === 'object' && !Array.isArray(obj)) {
            v = getValueByPath(obj, path);
            if (v !== undefined) return v;
          }
        }
        return undefined;
      };

      let result = searchIn(values);
      if (result === undefined) result = searchIn(schemaData);
      return result;
    },
    [paths, values, schemaData],
  );

  const imageUrl = findValue('image') || null;
  const displayName = findValue('name') || '';
  const functionalId = findValue('functionalId') || '';
  const statusValue = findValue('status') || '';
  const statusReason = findValue('statusReason') || '';
  const createdBy = findValue('createdBy') || '';
  const createdAt = findValue('createdAt') || '';
  const lastApprovedBy = findValue('lastApprovedBy') || '';
  const lastApprovedAt = findValue('lastApprovedAt') || '';

  // ── Format options ────────────────────────────────────────────
  const format = (widgetConfig['widget-data-format'] || {}) as Record<string, any>;
  const imageSize = format.imageSize || 90;
  const nameColor = format.nameColor || '#ED7C22';
  const statusColors: Record<string, string> = {
    ...DEFAULT_STATUS_COLORS,
    ...(format.statusColors || {}),
  };

  // ── Value change helpers ──────────────────────────────────────
  const updateFieldValue = useCallback(
    (fieldKey: string, newValue: any) => {
      const path = (paths as Record<string, string>)[fieldKey];
      if (!path) return;
      const updated = setValueByPath({ ...values }, path, newValue);
      dispatch(setValues(updated));
    },
    [paths, values, dispatch],
  );

  // ── Status helpers ────────────────────────────────────────────
  const statusLabel = useMemo(() => {
    if (!statusValue) return '';
    const opt = statusOptions.find(
      (o) => String(o.value).toLowerCase() === String(statusValue).toLowerCase(),
    );
    return opt ? opt.label : String(statusValue);
  }, [statusValue, statusOptions]);

  const statusColor =
    statusColors[String(statusValue).toLowerCase()] || '#6B7280';

  // ── Scoped class for CSS isolation ────────────────────────────
  const cls = `header-section-widget-${widgetConfig['widget-id']}`;

  // ── Indicator dot component ───────────────────────────────────
  const Dot = ({ color }: { color: string }) => (
    <span
      style={{
        display: 'inline-block',
        width: 8,
        height: 8,
        borderRadius: '50%',
        backgroundColor: color,
        flexShrink: 0,
        marginTop: 6,
      }}
    />
  );

  // ── RENDER ────────────────────────────────────────────────────
  return (
    <>
      <style>{`
        .${cls} {
          display: flex;
          flex-direction: row;
          gap: 1.5rem;
          width: 100%;
          font-family: Roboto, sans-serif;
          padding: 35px 0 16px 0;
        }

        .${cls} .hdr-left {
          display: flex;
          flex-direction: row;
          align-items: flex-start;
          gap: 1rem;
          flex: 1 1 55%;
          min-width: 0;
        }

        .${cls} .hdr-right {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
          flex: 0 0 auto;
          min-width: 220px;
        }

        .${cls} .hdr-avatar {
          width: ${imageSize}px;
          height: ${imageSize}px;
          border-radius: 8px;
          object-fit: cover;
          background-color: #e5e7eb;
          border: 2px solid #d1d5db;
          flex-shrink: 0;
        }

        .${cls} .hdr-avatar-placeholder {
          width: ${imageSize}px;
          height: ${imageSize}px;
          border-radius: 8px;
          background-color: #e5e7eb;
          border: 2px solid #d1d5db;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          overflow: hidden;
        }

        .${cls} .hdr-avatar-placeholder img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          border-radius: 8px;
        }

        .${cls} .hdr-info {
          display: flex;
          flex-direction: column;
          gap: 0.35rem;
          min-width: 0;
          flex: 1;
        }

        .${cls} .hdr-name {
          font-size: 1.25rem;
          font-weight: 600;
          color: ${nameColor};
          line-height: 1.4;
          word-wrap: break-word;
        }

        .${cls} .hdr-field-row {
          display: flex;
          align-items: flex-start;
          gap: 0.5rem;
          font-size: 0.875rem;
          line-height: 1.6;
        }

        .${cls} .hdr-field-label {
          color: #6b7280;
          font-weight: 500;
          white-space: nowrap;
        }

        .${cls} .hdr-field-value {
          color: #111827;
          font-weight: 600;
        }

        .${cls} .hdr-status-badge {
          display: inline-block;
          padding: 2px 12px;
          border-radius: 4px;
          font-size: 0.75rem;
          font-weight: 600;
          color: #fff;
        }

        .${cls} .hdr-meta-row {
          display: flex;
          align-items: baseline;
          gap: 0.35rem;
          font-size: 0.875rem;
          line-height: 1.6;
        }

        .${cls} .hdr-meta-label {
          color: #6b7280;
          font-weight: 400;
        }

        .${cls} .hdr-meta-value {
          color: #111827;
          font-weight: 600;
        }

        .${cls} .hdr-select {
          height: 32px;
          padding: 0 8px;
          border: 1px solid #d1d5db;
          border-radius: 6px;
          font-size: 0.875rem;
          font-family: Roboto, sans-serif;
          background: #fff;
          min-width: 140px;
          color: #374151;
        }
        .${cls} .hdr-select:focus {
          outline: none;
          border-color: #ED7C22;
          box-shadow: 0 0 0 2px rgba(237, 124, 34, 0.15);
        }

        .${cls} .hdr-input {
          height: 32px;
          padding: 0 8px;
          border: 1px solid #d1d5db;
          border-radius: 6px;
          font-size: 0.875rem;
          font-family: Roboto, sans-serif;
          background: #fff;
          min-width: 140px;
          color: #374151;
        }
        .${cls} .hdr-input:focus {
          outline: none;
          border-color: #ED7C22;
          box-shadow: 0 0 0 2px rgba(237, 124, 34, 0.15);
        }

        @media (max-width: 768px) {
          .${cls} {
            flex-direction: column;
          }
          .${cls} .hdr-right {
            min-width: 0;
          }
        }
      `}</style>

      <div className={cls}>
        {/* ─── LEFT COLUMN ─── */}
        <div className="hdr-left">
          {/* Avatar */}
          <div>
            {imageUrl ? (
              <img
                src={imageUrl}
                alt={displayName || 'Profile'}
                className="hdr-avatar"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                  const placeholder = (e.target as HTMLImageElement)
                    .parentElement?.querySelector('.hdr-avatar-placeholder') as HTMLElement;
                  if (placeholder) placeholder.style.display = 'flex';
                }}
              />
            ) : null}
            <div
              className="hdr-avatar-placeholder"
              style={{ display: imageUrl ? 'none' : 'flex' }}
            >
              <img src={dummyProfile} alt="Profile Placeholder" />
            </div>
          </div>

          {/* Info fields */}
          <div className="hdr-info">
            {displayName && <div className="hdr-name">{displayName}</div>}

            {/* Functional Record ID */}
            <div className="hdr-field-row">
              <Dot color="#9CA3AF" />
              <span className="hdr-field-label">
                {translateConfig('Functional Record ID') || 'Functional Record ID'} :
              </span>
              <span className="hdr-field-value">{functionalId || '-'}</span>
            </div>

            {/* Record Status */}
            <div className="hdr-field-row">
              <Dot color={isReadonly ? statusColor : '#F59E0B'} />
              <span className="hdr-field-label">
                {translateConfig('Record Status') || 'Record Status'}
              </span>
              {isReadonly ? (
                statusLabel ? (
                  <span
                    className="hdr-status-badge"
                    style={{ backgroundColor: statusColor }}
                  >
                    {statusLabel}
                  </span>
                ) : (
                  <span className="hdr-field-value">-</span>
                )
              ) : (
                <select
                  className="hdr-select"
                  value={statusValue}
                  onChange={(e) => updateFieldValue('status', e.target.value)}
                >
                  <option value="">
                    {translateConfig('Select') || 'Select'}
                  </option>
                  {statusOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Status Reason */}
            <div className="hdr-field-row">
              <Dot color={isReadonly ? '#9CA3AF' : '#F59E0B'} />
              <span className="hdr-field-label">
                {translateConfig('Status Reason') || 'Status Reason'} :
              </span>
              {isReadonly ? (
                <span className="hdr-field-value">{statusReason || '-'}</span>
              ) : (
                <input
                  type="text"
                  className="hdr-input"
                  value={statusReason}
                  placeholder={translateConfig('Enter Reason') || 'Enter Reason'}
                  onChange={(e) => updateFieldValue('statusReason', e.target.value)}
                />
              )}
            </div>
          </div>
        </div>

        {/* ─── RIGHT COLUMN ─── */}
        <div className="hdr-right">
          <div className="hdr-meta-row">
            <span className="hdr-meta-label">
              {translateConfig('Created by') || 'Created by'} :
            </span>
            <span className="hdr-meta-value">{createdBy || '-'}</span>
          </div>

          <div className="hdr-meta-row">
            <span className="hdr-meta-label">
              {translateConfig('Created at') || 'Created at'} :
            </span>
            <span className="hdr-meta-value">{createdAt || '-'}</span>
          </div>

          <div className="hdr-meta-row">
            <span className="hdr-meta-label">
              {translateConfig('Last Approved by') || 'Last Approved by'} :
            </span>
            <span className="hdr-meta-value">{lastApprovedBy || '-'}</span>
          </div>

          <div className="hdr-meta-row">
            <span className="hdr-meta-label">
              {translateConfig('Last Approved at') || 'Last Approved at'} :
            </span>
            <span className="hdr-meta-value">{lastApprovedAt || '-'}</span>
          </div>
        </div>
      </div>
    </>
  );
};
