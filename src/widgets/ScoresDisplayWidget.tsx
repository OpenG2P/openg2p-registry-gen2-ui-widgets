import React, { useEffect, useMemo, useState } from 'react';
import { useSelector } from 'react-redux';
import { ApiDataSource, BaseWidgetConfig, DataSourceRequestHandler } from '../types';
import { useWidgetContext } from '../components/WidgetProvider';
import { WidgetRootState } from '../store';
import { getValueByPath } from '../utils/pathUtils';

type ScoresDisplayApiResponse = {
  scores?: Array<{
    score_type?: string;
    computed_score?: string | number;
    computed_at?: string;
    triggered_by_cr_id?: string;
    [key: string]: unknown;
  }>;
  [key: string]: unknown;
};

interface ScoresDisplayWidgetProps {
  config: BaseWidgetConfig;
  dataSourceRequestHandler?: DataSourceRequestHandler;
  schemaData?: Record<string, unknown>;
}

type ScoresApiParams = Record<string, unknown> & {
  internal_record_id_path?: string;
  internalRecordIdPath?: string;
};

type ScoresApiDataSource = ApiDataSource & {
  params?: ScoresApiParams;
  headers?: Record<string, string>;
};

type OpenG2PEnvelope = {
  response_body?: {
    response_payload?: unknown;
    [key: string]: unknown;
  };
  data?: unknown;
  [key: string]: unknown;
};

function tryFormatDateTime(value: unknown): string {
  if (typeof value !== 'string' || !value) return value ? String(value) : '-';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  try {
    return d.toLocaleString(undefined, {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return value;
  }
}

function pickLatestScore(scores: ScoresDisplayApiResponse['scores']) {
  if (!scores || scores.length === 0) return null;
  const withTime = scores
    .map((s) => {
      const t = typeof s?.computed_at === 'string' ? new Date(s.computed_at).getTime() : NaN;
      return { s, t };
    })
    .filter((x) => !Number.isNaN(x.t));

  if (withTime.length === 0) return scores[0] || null;
  withTime.sort((a, b) => b.t - a.t);
  return withTime[0]?.s || null;
}

/**
 * Scores Display Widget - full-width, view-only widget
 *
 * Expected config (reference):
 * {
 *   "widget": "scores-display",
 *   "widget-type": "group",
 *   "widget-id": "record-scores",
 *   "widget-data-source": {
 *     "type": "api",
 *     "service": "staff-portal-api",
 *     "endpoint": "get_scores",
 *     "method": "POST",
 *     "params": { "internal_record_id_path": "internal_record_id" }
 *   }
 * }
 *
 * The host's `dataSourceRequestHandler` is invoked with:
 * - service: config.widget-data-source.service
 * - endpoint: config.widget-data-source.endpoint
 * - method: config.widget-data-source.method (default POST)
 * - params: { internal_record_id: <resolved from internal_record_id_path> }
 */
export const ScoresDisplayWidget = ({
  config,
  dataSourceRequestHandler: propHandler,
  schemaData: propSchemaData,
}: ScoresDisplayWidgetProps) => {
  const { dataSourceRequestHandler: ctxHandler, schemaData: ctxSchemaData } = useWidgetContext();
  const handler = propHandler || ctxHandler;
  const schemaData = propSchemaData || ctxSchemaData || {};
  const values = useSelector((state: WidgetRootState) => state.widget.values);

  const api = config['widget-data-source'];
  const isApi = api?.type === 'api';
  const apiDs: ScoresApiDataSource | null = isApi ? (api as ScoresApiDataSource) : null;

  const internalIdPath = useMemo(() => {
    if (!apiDs) return undefined;
    const p = apiDs.params || {};
    const fromParams = p.internal_record_id_path || p.internalRecordIdPath;
    const fromConfig =
      typeof (config as Record<string, unknown>).internal_record_id_path === 'string'
        ? ((config as Record<string, unknown>).internal_record_id_path as string)
        : undefined;
    return fromParams || fromConfig;
  }, [apiDs, config]);

  const internalRecordId = useMemo(() => {
    if (!internalIdPath) return undefined;
    const fromValues = getValueByPath(values || {}, internalIdPath);
    if (fromValues !== undefined && fromValues !== null && String(fromValues).trim() !== '') {
      return String(fromValues);
    }
    const fromSchema = getValueByPath(schemaData || {}, internalIdPath);
    if (fromSchema !== undefined && fromSchema !== null && String(fromSchema).trim() !== '') {
      return String(fromSchema);
    }
    return undefined;
  }, [internalIdPath, values, schemaData]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [response, setResponse] = useState<ScoresDisplayApiResponse | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      if (!apiDs) {
        setError('Scores widget requires an API data source.');
        setResponse(null);
        return;
      }
      if (!handler) {
        setError(null);
        setResponse(null);
        return;
      }
      const service = apiDs.service;
      const endpoint = apiDs.endpoint;
      const method = apiDs.method || 'POST';

      if (!service || !endpoint) {
        setError('Scores widget API data source is missing service/endpoint.');
        setResponse(null);
        return;
      }
      if (!internalRecordId) {
        setError(null);
        setResponse(null);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        const rawParams = apiDs.params || {};
        // Never pass the path helper through to the API.
        const { internal_record_id_path, internalRecordIdPath, ...rest } = rawParams;
        void internal_record_id_path;
        void internalRecordIdPath;

        const params: Record<string, unknown> = {
          ...rest,
          internal_record_id: internalRecordId,
        };

        const res = await handler(service, endpoint, method, params, {
          headers: apiDs.headers,
        });

        if (cancelled) return;

        // Accept either direct payload or OpenG2P wrapper objects.
        const envelope: OpenG2PEnvelope | null =
          res && typeof res === 'object' ? (res as OpenG2PEnvelope) : null;

        const payload = envelope?.response_body?.response_payload ?? envelope?.data ?? res;

        if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
          setResponse(payload as ScoresDisplayApiResponse);
        } else {
          setResponse({ scores: Array.isArray(payload) ? payload : [] });
        }
      } catch (e: unknown) {
        if (cancelled) return;
        const maybeErr = e as { message?: unknown } | null;
        const msg =
          maybeErr && typeof maybeErr === 'object' && typeof maybeErr.message === 'string'
            ? maybeErr.message
            : 'Failed to load scores.';
        setError(msg);
        setResponse(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [apiDs, handler, internalRecordId]);

  const latest = useMemo(() => pickLatestScore(response?.scores), [response]);
  const cls = `scores-display-widget-${config['widget-id']}`;

  const scoreType = latest?.score_type ? String(latest.score_type) : '-';
  const scoreValue =
    latest?.computed_score !== undefined && latest?.computed_score !== null && String(latest.computed_score) !== ''
      ? String(latest.computed_score)
      : '-';
  const computedAt = tryFormatDateTime(latest?.computed_at);

  return (
    <>
      <style>{`
        .${cls} {
          width: 100%;
          font-family: Roboto, sans-serif;
          padding: 0;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .${cls} .scores-subtle {
          font-size: 13px;
          color: var(--owt-color-text-muted, #727474);
          font-weight: 400;
        }

        .${cls} .scores-card {
          width: 100%;
          border: none;
          border-radius: 0;
          background: transparent;
          padding: 0;
          display: grid;
          grid-template-columns: 1fr 1fr 1fr;
          gap: 16px;
          align-items: center;
        }

        .${cls} .scores-col {
          min-width: 0;
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .${cls} .scores-label {
          font-size: 12px;
          color: var(--owt-color-text-muted, #727474);
          font-weight: 600;
          letter-spacing: 0.25px;
          text-transform: uppercase;
        }

        .${cls} .scores-value {
          font-size: 16px;
          font-weight: 600;
          color: var(--owt-color-text, #011627);
          line-height: 1.25;
          word-break: break-word;
        }

        .${cls} .scores-value--highlight {
          font-weight: 800;
          color: var(--owt-color-primary-dark, #F07B1A);
        }

        .${cls} .scores-value-wrap {
          display: inline-flex;
          align-items: baseline;
          gap: 10px;
          flex-wrap: wrap;
        }

        .${cls} .scores-value-badge { display: inline; }

        .${cls} .scores-statusline {
          grid-column: 1 / -1;
          margin-top: 2px;
        }

        @media (max-width: 768px) {
          .${cls} .scores-card {
            grid-template-columns: 1fr;
          }
        }
      `}</style>

      <div className={cls}>
        <div className="scores-card">
          <div className="scores-col" aria-live="polite">
            <div className="scores-label">Score Type</div>
            <div className="scores-value-wrap">
              <span className="scores-value-badge">
                <span className="scores-value scores-value--highlight">{scoreType}</span>
              </span>
            </div>
          </div>

          <div className="scores-col">
            <div className="scores-label">Score</div>
            <div className="scores-value-wrap">
              <span className="scores-value-badge">
                <span className="scores-value scores-value--highlight">{scoreValue}</span>
              </span>
            </div>
          </div>

          <div className="scores-col">
            <div className="scores-label">Computed at</div>
            <div className="scores-value">{computedAt}</div>
          </div>

          <div className="scores-statusline">
            {loading ? (
              <div className="scores-subtle">Loading scores…</div>
            ) : error ? (
              <div className="scores-subtle" style={{ color: 'var(--owt-color-error, #B91C1C)' }}>
                {error}
              </div>
            ) : !latest ? (
              <div className="scores-subtle">No scores available.</div>
            ) : null}
          </div>
        </div>
      </div>
    </>
  );
};

