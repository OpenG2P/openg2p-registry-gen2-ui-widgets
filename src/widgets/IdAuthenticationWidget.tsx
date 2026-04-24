import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSelector } from 'react-redux';
import { useWidgetContext } from '../components/WidgetProvider';
import { BaseWidgetConfig, DataSourceRequestHandler } from '../types';
import { WidgetRootState } from '../store';
import { getValueByPath } from '../utils/pathUtils';

type AuthStatus = 'success' | 'failure' | 'not_done' | 'not done' | 'not-done' | 'unknown';

type AuthConfig = {
  /** Service mnemonic (required to call the API unless using defaultAuthorizationUrl only) */
  service?: string;
  /** Endpoint/operation (required to call the API unless using defaultAuthorizationUrl only) */
  endpoint?: string;
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  /**
   * Response key that contains provider authorization URL.
   * Defaults try: authorization_url, authorizationUrl, auth_url, authUrl, url
   */
  authorizationUrlKey?: string;
  /**
   * If the host cannot call the API (no handler) or the request fails, this URL is used
   * for the OIDC / eSignet flow so the widget still works in demos or offline mode.
   */
  defaultAuthorizationUrl?: string;
  /**
   * When false, skips the mount-time provider fetch. Default: true.
   */
  prefetchOnMount?: boolean;
  /**
   * Centered popup size for the provider login page (e.g. eSignet). Clamped to ~92% of the viewport.
   * Defaults: 1024×800.
   */
  popupWidth?: number;
  popupHeight?: number;
  /**
   * Optional: when true, this widget will call `window.location.reload()` after success.
   * Otherwise it only emits browser events for the host to handle.
   */
  reloadOnSuccess?: boolean;
  /**
   * Optional: expected `postMessage` type from the popup to mark success.
   * Defaults to "openg2p:oidc:success"
   */
  successMessageType?: string;
};

type DataPaths = {
  foundationalId?: string;
  lastAuthenticatedOn?: string;
  lastAuthenticationStatus?: string;
  expiryDate?: string;
  authenticationToken?: string;
};

interface IdAuthenticationWidgetProps {
  config: BaseWidgetConfig;
  schemaData?: Record<string, unknown>;
}

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

function tryFormatDate(value: unknown): string {
  if (typeof value !== 'string' || !value) return value ? String(value) : '-';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  try {
    return d.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
    });
  } catch {
    return value;
  }
}

function displayText(value: unknown): string {
  if (value === null || value === undefined || String(value).trim() === '') return '-';
  return String(value);
}

function normalizeStatus(raw: unknown): AuthStatus {
  if (raw === null || raw === undefined || String(raw).trim() === '') return 'unknown';
  const v = String(raw).trim().toLowerCase();
  if (v === 'success' || v === 'succeeded' || v === 'ok') return 'success';
  if (v === 'failure' || v === 'failed' || v === 'error') return 'failure';
  if (v === 'not done' || v === 'not_done' || v === 'not-done' || v === 'pending') return 'not_done';
  return 'unknown';
}

/** Large enough for eSignet / OIDC login; clamped so it always fits the current screen. */
function getCenteredPopupFeatures(width: number, height: number) {
  const dualScreenLeft = window.screenLeft ?? (window as any).screenX ?? 0;
  const dualScreenTop = window.screenTop ?? (window as any).screenY ?? 0;
  const viewportWidth = window.innerWidth || document.documentElement.clientWidth || (typeof screen !== 'undefined' ? screen.width : width);
  const viewportHeight = window.innerHeight || document.documentElement.clientHeight || (typeof screen !== 'undefined' ? screen.height : height);
  const maxW = Math.max(320, Math.floor(viewportWidth * 0.92));
  const maxH = Math.max(400, Math.floor(viewportHeight * 0.92));
  const w = Math.max(320, Math.min(width, maxW));
  const h = Math.max(400, Math.min(height, maxH));

  const left = Math.max(0, Math.floor(viewportWidth / 2 - w / 2 + dualScreenLeft));
  const top = Math.max(0, Math.floor(viewportHeight / 2 - h / 2 + dualScreenTop));

  return [
    'popup=yes',
    'noopener=yes',
    'noreferrer=yes',
    `width=${w}`,
    `height=${h}`,
    `left=${left}`,
    `top=${top}`,
    'scrollbars=yes',
    'resizable=yes',
  ].join(',');
}

function pickAuthorizationUrl(resp: any, explicitKey?: string): string | null {
  if (!resp) return null;

  const tryKey = (k: string): string | null => {
    const v = resp?.[k];
    if (typeof v === 'string' && v) return v;
    return null;
  };

  if (explicitKey) {
    const v = tryKey(explicitKey);
    if (v) return v;
  }

  return (
    tryKey('authorization_url') ||
    tryKey('authorizationUrl') ||
    tryKey('auth_url') ||
    tryKey('authUrl') ||
    tryKey('url') ||
    null
  );
}

function resolveValueFromSources(
  path: string | undefined,
  values: Record<string, unknown>,
  schemaData: Record<string, unknown>,
): unknown {
  if (!path) return undefined;
  const fromValues = getValueByPath(values, path);
  if (fromValues !== undefined) return fromValues;
  return getValueByPath(schemaData, path);
}

async function fetchProviderAuthorizationUrl(
  authConfig: AuthConfig,
  dataSourceRequestHandler: DataSourceRequestHandler,
  _values: Record<string, unknown>,
  _schemaData: Record<string, unknown>,
): Promise<string | null> {
  const response = await dataSourceRequestHandler(
    authConfig.service!,
    authConfig.endpoint!,
    authConfig.method || 'GET',
    {},
  );
  const payload =
    response?.response_body?.response_payload && typeof response.response_body.response_payload === 'object'
      ? response.response_body.response_payload
      : response;
  return pickAuthorizationUrl(payload, authConfig.authorizationUrlKey);
}

export const IdAuthenticationWidget = ({ config, schemaData: propSchemaData }: IdAuthenticationWidgetProps) => {
  const { dataSourceRequestHandler, schemaData: ctxSchemaData } = useWidgetContext();
  const values = useSelector((state: WidgetRootState) => state.widget.values) as unknown as Record<string, unknown>;

  const schemaData = (propSchemaData || ctxSchemaData || {}) as Record<string, unknown>;
  const widgetId = config['widget-id'];

  const dataPath = config['widget-data-path'] as unknown;
  const paths = useMemo<DataPaths>(() => {
    if (!dataPath || typeof dataPath !== 'object') return {};
    return dataPath as DataPaths;
  }, [dataPath]);

  const authConfig = (config as any)['widget-auth-config'] as AuthConfig | undefined;

  const foundationalId = resolveValueFromSources(paths.foundationalId, values, schemaData);
  const lastAuthenticatedOn = resolveValueFromSources(paths.lastAuthenticatedOn, values, schemaData);
  const lastAuthStatusRaw = resolveValueFromSources(paths.lastAuthenticationStatus, values, schemaData);
  const expiryDate = resolveValueFromSources(paths.expiryDate, values, schemaData);
  const psut = resolveValueFromSources(paths.authenticationToken, values, schemaData);

  const status = useMemo(() => normalizeStatus(lastAuthStatusRaw), [lastAuthStatusRaw]);

  /** URL from prefetch (or default); used when opening the OIDC / eSignet popup */
  const [resolvedAuthUrl, setResolvedAuthUrl] = useState<string | null>(null);
  const [providerLoading, setProviderLoading] = useState(false);
  const [authActionLoading, setAuthActionLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const popupRef = useRef<Window | null>(null);
  const pollTimerRef = useRef<number | null>(null);

  const emitHostEvent = useCallback(
    (detail: Record<string, unknown>) => {
      if (typeof window === 'undefined') return;
      window.dispatchEvent(
        new CustomEvent('openg2p:id-authentication', {
          detail: {
            widgetId,
            ...detail,
          },
        }),
      );
    },
    [widgetId],
  );

  const cleanupPopup = useCallback(() => {
    if (pollTimerRef.current) {
      window.clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
    popupRef.current = null;
  }, []);

  useEffect(() => {
    return () => {
      cleanupPopup();
      try {
        popupRef.current?.close?.();
      } catch {
        // ignore
      }
    };
  }, [cleanupPopup]);

  const prefetchKey = useMemo(() => {
    if (!authConfig) return 'no-config';
    return JSON.stringify({
      s: authConfig.service,
      e: authConfig.endpoint,
      m: authConfig.method,
      def: authConfig.defaultAuthorizationUrl,
      prefetch: authConfig.prefetchOnMount,
    });
  }, [authConfig]);

  // Prefetch provider login URL on mount (and when params / config change)
  useEffect(() => {
    if (!authConfig) {
      setResolvedAuthUrl(null);
      setProviderLoading(false);
      return;
    }
    if (authConfig.prefetchOnMount === false) {
      setResolvedAuthUrl(authConfig.defaultAuthorizationUrl || null);
      setProviderLoading(false);
      return;
    }

    const def = authConfig.defaultAuthorizationUrl;
    if (def) {
      setResolvedAuthUrl(def);
    }

    const canCallApi = Boolean(
      dataSourceRequestHandler && authConfig.service && authConfig.endpoint,
    );
    if (!canCallApi) {
      setProviderLoading(false);
      if (!def) {
        setResolvedAuthUrl(null);
      }
      return;
    }

    let cancelled = false;
    setProviderLoading(true);
    (async () => {
      try {
        const url = await fetchProviderAuthorizationUrl(authConfig, dataSourceRequestHandler!, values, schemaData);
        if (cancelled) return;
        if (url) {
          setResolvedAuthUrl(url);
        } else if (!def) {
          setResolvedAuthUrl(null);
        }
      } catch {
        if (cancelled) return;
        if (!def) {
          setResolvedAuthUrl(null);
        }
      } finally {
        if (!cancelled) setProviderLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authConfig, dataSourceRequestHandler, prefetchKey, values, schemaData]);

  const openAuthPopup = useCallback(
    (authUrl: string) => {
      const pw = authConfig?.popupWidth ?? 1024;
      const ph = authConfig?.popupHeight ?? 800;
      const features = getCenteredPopupFeatures(pw, ph);
      const popup = window.open(authUrl, `${widgetId}-oidc`, features);
      if (!popup) {
        setAuthError('Popup blocked. Please allow popups and try again.');
        return;
      }
      popupRef.current = popup;
      popup.focus?.();
      setAuthError(null);
      emitHostEvent({ type: 'popup_opened' });

      if (pollTimerRef.current) {
        window.clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
      pollTimerRef.current = window.setInterval(() => {
        try {
          const closed = !popupRef.current || popupRef.current.closed;
          if (closed) {
            cleanupPopup();
            emitHostEvent({ type: 'popup_closed' });
          }
        } catch {
          // ignore
        }
      }, 500);
    },
    [authConfig, cleanupPopup, emitHostEvent, widgetId],
  );

  const onAuthenticate = useCallback(async () => {
    setAuthError(null);
    if (!authConfig) {
      setAuthError('Missing widget-auth-config.');
      return;
    }

    const def = authConfig.defaultAuthorizationUrl;
    const canCallApi = Boolean(
      dataSourceRequestHandler && authConfig.service && authConfig.endpoint,
    );

    let url = resolvedAuthUrl;
    if (!url && canCallApi) {
      setAuthActionLoading(true);
      try {
        const fetched = await fetchProviderAuthorizationUrl(
          authConfig,
          dataSourceRequestHandler!,
          values,
          schemaData,
        );
        url = fetched || def || null;
        if (fetched) {
          setResolvedAuthUrl(fetched);
        }
      } catch (e: any) {
        url = def || null;
        if (!url) {
          setAuthError(e?.message || 'Could not load provider URL.');
          return;
        }
      } finally {
        setAuthActionLoading(false);
      }
    } else if (!url) {
      url = def || null;
    }

    if (!url) {
      setAuthError(
        'No authorization URL. Set widget-auth-config (service + endpoint, or defaultAuthorizationUrl) and dataSourceRequestHandler on WidgetProvider if using the API.',
      );
      return;
    }
    openAuthPopup(url);
  }, [authConfig, dataSourceRequestHandler, openAuthPopup, resolvedAuthUrl, values, schemaData]);

  useEffect(() => {
    const successType = authConfig?.successMessageType || 'openg2p:oidc:success';
    const handler = (event: MessageEvent) => {
      const data = event?.data as any;
      if (!data || typeof data !== 'object') return;
      if (data.type !== successType) return;
      if (data.widgetId && data.widgetId !== widgetId) return;

      emitHostEvent({ type: 'authenticated', payload: data });
      try {
        popupRef.current?.close?.();
      } catch {
        // ignore
      }
      cleanupPopup();

      if (authConfig?.reloadOnSuccess) {
        window.location.reload();
      }
    };

    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [authConfig?.reloadOnSuccess, authConfig?.successMessageType, cleanupPopup, emitHostEvent, widgetId]);

  const cls = `id-auth-widget-${widgetId}`;

  const statusLabel = useMemo(() => {
    if (status === 'success') return 'Success';
    if (status === 'failure') return 'Failure';
    if (status === 'not_done') return 'Not done';
    return 'Unknown';
  }, [status]);

  const statusColor = useMemo(() => {
    if (status === 'success') return 'var(--owt-color-success, #16A34A)';
    if (status === 'failure') return 'var(--owt-color-danger, #DC2626)';
    if (status === 'not_done') return 'var(--owt-color-warning, #D97706)';
    return 'var(--owt-color-text-muted, #6B7280)';
  }, [status]);

  const buttonBusy =
    authActionLoading ||
    (providerLoading && !resolvedAuthUrl && !authConfig?.defaultAuthorizationUrl);
  const buttonDisabled = !authConfig || buttonBusy;

  return (
    <>
      <style>{`
        .${cls} {
          width: 100%;
          font-family: Roboto, sans-serif;
        }

        /* Two-column field grid; primary action in a bottom band (matches section save/edit pattern). */
        .${cls} .auth-content {
          display: flex;
          flex-direction: column;
          gap: 0;
          min-width: 0;
        }

        .${cls} .auth-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 16px 24px;
          min-width: 0;
        }

        /* Each field: label (left) + value (right), same as DisplayWidget readonly */
        .${cls} .auth-cell {
          display: flex;
          flex-direction: row;
          align-items: flex-start;
          gap: 12px 16px;
          min-width: 0;
        }

        .${cls} .auth-cell.auth-cell--full {
          grid-column: 1 / -1;
        }

        .${cls} .auth-label {
          flex: 0 0 auto;
          min-width: 200px;
          max-width: 40%;
          font-size: 16px;
          color: rgba(0, 0, 0, 0.6);
          font-weight: 500;
          line-height: 1.45;
          margin: 0;
          word-break: break-word;
        }

        .${cls} .auth-value {
          flex: 1 1 auto;
          min-width: 0;
          font-size: 16px;
          color: var(--owt-color-text, #111827);
          font-weight: 500;
          line-height: 1.45;
          word-break: break-word;
        }

        .${cls} .auth-bottom-actions {
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          justify-content: flex-start;
          gap: 8px;
          width: 100%;
          margin-top: 20px;
          margin-bottom: 0;
        }

        .${cls} .auth-status {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          width: fit-content;
          padding: 4px 10px;
          border-radius: 999px;
          background: rgba(2, 6, 23, 0.04);
          border: 1px solid rgba(2, 6, 23, 0.08);
          font-size: 13px;
          font-weight: 700;
          color: var(--owt-color-text, #011627);
        }

        .${cls} .auth-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: ${statusColor};
        }

        .${cls} .auth-token {
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
          font-size: 14px;
          font-weight: 500;
          color: var(--owt-color-text, #011627);
          background: transparent;
          border: none;
          border-radius: 0;
          padding: 0;
          word-break: break-all;
        }

        .${cls} .auth-button {
          /* Match SectionRegistryView Save CTA (SectionRenderer) */
          font-size: 14px;
          font-weight: 500;
          padding: 8px 24px;
          line-height: 1.5;
          border-radius: var(--owt-btn-border-radius, 10px);
          border: 1px solid var(--owt-btn-primary-border, #F07B1A);
          background-color: var(--owt-color-primary, #F5BB1A);
          color: var(--owt-color-bg, #FFFFFF);
          font-family: Roboto, sans-serif;
          cursor: pointer;
          transition: opacity 0.15s ease;
        }

        .${cls} .auth-button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .${cls} .auth-error {
          font-size: 12px;
          color: var(--owt-color-danger, #DC2626);
          font-weight: 700;
          line-height: 1.3;
          text-align: left;
          max-width: 100%;
        }

        @media (max-width: 640px) {
          .${cls} .auth-grid {
            grid-template-columns: 1fr;
          }
          .${cls} .auth-cell {
            flex-direction: column;
            align-items: stretch;
            gap: 4px 0;
          }
          .${cls} .auth-label {
            min-width: 0;
            max-width: none;
          }
        }
      `}</style>

      <div className={cls}>
        <div className="auth-content">
          <div className="auth-grid">
            <div className="auth-cell">
              <div className="auth-label">Foundational ID:</div>
              <div className="auth-value">{displayText(foundationalId)}</div>
            </div>

            <div className="auth-cell">
              <div className="auth-label">Last authenticated on:</div>
              <div className="auth-value">{tryFormatDateTime(lastAuthenticatedOn)}</div>
            </div>

            <div className="auth-cell">
              <div className="auth-label">Last authentication status:</div>
              <div className="auth-value">
                <div className="auth-status" aria-label={`Authentication status: ${statusLabel}`}>
                  <span className="auth-dot" />
                  <span>{statusLabel}</span>
                </div>
              </div>
            </div>

            <div className="auth-cell">
              <div className="auth-label">Expiry date:</div>
              <div className="auth-value">{tryFormatDate(expiryDate)}</div>
            </div>

            <div className="auth-cell auth-cell--full">
              <div className="auth-label">Authentication token (PSUT):</div>
              <div className="auth-value">
                <div className="auth-token">{psut ? String(psut) : '-'}</div>
              </div>
            </div>
          </div>

          <div className="auth-bottom-actions">
            <button type="button" className="auth-button" onClick={onAuthenticate} disabled={buttonDisabled}>
              {buttonBusy ? 'Loading…' : 'Authenticate'}
            </button>
            {authError ? <div className="auth-error">{authError}</div> : null}
          </div>
        </div>
      </div>
    </>
  );
};

