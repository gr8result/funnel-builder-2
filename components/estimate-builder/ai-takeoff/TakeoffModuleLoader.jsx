import React from "react";

const STARTUP_TIMEOUT_MS = 15000;
const TAKEOFF_STORAGE_KEYS = [
  "gr8:takeoff:v1",
  "takeoff-engine-test-state",
];

export default function TakeoffModuleLoader({ sheet, useNewTakeoffEngine }) {
  const [loadAttempt, setLoadAttempt] = React.useState(0);
  const [Component, setComponent] = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState(null);
  const [detailsVisible, setDetailsVisible] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    let timeoutId = null;

    async function initialiseTakeoff() {
      console.info("[Takeoff] component mounted");
      setLoading(true);
      setError(null);
      setDetailsVisible(false);

      timeoutId = window.setTimeout(() => {
        if (cancelled) return;
        const timeoutError = new Error("Takeoff Engine could not be loaded.");
        console.error("[Takeoff] initialisation failed", timeoutError);
        setError(timeoutError);
        setLoading(false);
      }, STARTUP_TIMEOUT_MS);

      try {
        console.info("[Takeoff] loading saved state");
        console.info("[Takeoff] loading PDF metadata");
        const module = await import("./AIPlanTakeoffPage");
        const LoadedComponent = module.default ?? module.AIPlanTakeoffPage;
        if (!LoadedComponent) {
          throw new Error("AIPlanTakeoffPage did not export a React component.");
        }
        if (cancelled) return;
        setComponent(() => LoadedComponent);
        console.info("[Takeoff] initialisation complete");
      } catch (loadError) {
        if (cancelled) return;
        console.error("[Takeoff] initialisation failed", loadError);
        setError(asError(loadError));
      } finally {
        if (timeoutId) window.clearTimeout(timeoutId);
        if (!cancelled) setLoading(false);
      }
    }

    void initialiseTakeoff();

    return () => {
      cancelled = true;
      if (timeoutId) window.clearTimeout(timeoutId);
    };
  }, [loadAttempt]);

  function retry() {
    setComponent(null);
    setLoadAttempt((current) => current + 1);
  }

  function clearCache() {
    clearTakeoffCache();
    retry();
  }

  function returnToDashboard() {
    sheet?.setPage?.("projectDashboard");
  }

  if (loading) return <TakeoffLoadingState />;

  if (error || !Component) {
    return (
      <TakeoffStartupError
        title="Takeoff Engine could not be loaded."
        error={error || new Error("Takeoff Engine component was not available after loading.")}
        detailsVisible={detailsVisible}
        onRetry={retry}
        onClearCache={clearCache}
        onToggleDetails={() => setDetailsVisible((current) => !current)}
        onReturnToDashboard={returnToDashboard}
      />
    );
  }

  return (
    <TakeoffErrorBoundary key={loadAttempt} onRetry={retry} onClearCache={clearCache} onReturnToDashboard={returnToDashboard}>
      <Component sheet={sheet} useNewTakeoffEngine={useNewTakeoffEngine} />
    </TakeoffErrorBoundary>
  );
}

function TakeoffLoadingState() {
  return (
    <div style={styles.loading} role="status">
      Loading AI Plan Takeoff...
    </div>
  );
}

class TakeoffErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null, detailsVisible: false };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error) {
    console.error("[Takeoff] initialisation failed", error);
  }

  render() {
    if (this.state.error) {
      return (
        <TakeoffStartupError
          title="Takeoff Engine Error"
          error={asError(this.state.error)}
          detailsVisible={this.state.detailsVisible}
          onRetry={() => {
            this.setState({ error: null, detailsVisible: false });
            this.props.onRetry?.();
          }}
          onClearCache={this.props.onClearCache}
          onToggleDetails={() => this.setState((current) => ({ detailsVisible: !current.detailsVisible }))}
          onReturnToDashboard={this.props.onReturnToDashboard}
        />
      );
    }

    return this.props.children;
  }
}

function TakeoffStartupError({
  title,
  error,
  detailsVisible,
  onRetry,
  onClearCache,
  onToggleDetails,
  onReturnToDashboard,
}) {
  return (
    <section style={styles.errorPanel} role="alert">
      <h2 style={styles.errorTitle}>{title}</h2>
      <p style={styles.errorMessage}>{error.message}</p>
      <div style={styles.actions}>
        <button type="button" style={styles.primaryButton} onClick={onRetry}>Retry</button>
        <button type="button" style={styles.secondaryButton} onClick={onClearCache}>Clear Takeoff Cache</button>
        <button type="button" style={styles.secondaryButton} onClick={onToggleDetails}>View Error Details</button>
        <button type="button" style={styles.secondaryButton} onClick={onReturnToDashboard}>Return to Project Dashboard</button>
      </div>
      {detailsVisible ? <pre style={styles.details}>{error.stack || error.message}</pre> : null}
    </section>
  );
}

function clearTakeoffCache() {
  if (typeof window === "undefined") return;
  for (const key of TAKEOFF_STORAGE_KEYS) {
    try {
      window.localStorage?.removeItem(key);
    } catch {}
  }
  try {
    const keys = [];
    for (let index = 0; index < window.localStorage.length; index += 1) {
      const key = window.localStorage.key(index);
      if (key && /^takeoff-engine[:.-]/i.test(key)) keys.push(key);
    }
    keys.forEach((key) => window.localStorage.removeItem(key));
  } catch {}
}

function asError(error) {
  if (error instanceof Error) return error;
  return new Error(typeof error === "string" ? error : JSON.stringify(error));
}

const styles = {
  loading: {
    padding: 40,
    textAlign: "center",
    color: "#64748b",
    fontWeight: 800,
  },
  errorPanel: {
    margin: 0,
    minHeight: 420,
    border: "1px solid #fecaca",
    background: "#fff7f7",
    color: "#7f1d1d",
    padding: 24,
  },
  errorTitle: {
    margin: "0 0 8px",
    color: "#7f1d1d",
    fontSize: 24,
  },
  errorMessage: {
    margin: "0 0 16px",
    color: "#991b1b",
    fontWeight: 800,
  },
  actions: {
    display: "flex",
    flexWrap: "wrap",
    gap: 10,
  },
  primaryButton: {
    border: "1px solid #0f766e",
    background: "#0f766e",
    color: "#ffffff",
    borderRadius: 6,
    padding: "9px 12px",
    fontSize: 13,
    fontWeight: 900,
    cursor: "pointer",
  },
  secondaryButton: {
    border: "1px solid #cbd5e1",
    background: "#ffffff",
    color: "#0f172a",
    borderRadius: 6,
    padding: "9px 12px",
    fontSize: 13,
    fontWeight: 900,
    cursor: "pointer",
  },
  details: {
    marginTop: 16,
    maxHeight: 260,
    overflow: "auto",
    border: "1px solid #fecaca",
    borderRadius: 6,
    background: "#ffffff",
    color: "#450a0a",
    padding: 12,
    whiteSpace: "pre-wrap",
  },
};
