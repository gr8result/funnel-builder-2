function SafeErrorShell({
  code,
  title,
  message,
}) {
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#0f172a",
        padding: 24,
      }}
    >
      <section
        style={{
          width: "min(560px, 100%)",
          borderRadius: 18,
          background: "#111827",
          border: "1px solid #1f2937",
          padding: "40px 32px",
          textAlign: "center",
          color: "#ffffff",
          boxShadow: "0 20px 50px rgba(0,0,0,0.35)",
        }}
      >
        <div
          style={{
            fontSize: 14,
            fontWeight: 700,
            letterSpacing: "0.12em",
            color: "#7dd3fc",
            textTransform: "uppercase",
            marginBottom: 12,
          }}
        >
          Secure Error Page
        </div>
        <h1
          style={{
            margin: 0,
            fontSize: 52,
            lineHeight: 1,
            fontWeight: 800,
          }}
        >
          {code}
        </h1>
        <p
          style={{
            margin: "18px 0 10px",
            fontSize: 24,
            fontWeight: 700,
            color: "#f8fafc",
          }}
        >
          {title}
        </p>
        <p
          style={{
            margin: 0,
            fontSize: 16,
            lineHeight: 1.6,
            color: "#cbd5e1",
          }}
        >
          {message}
        </p>
        <a
          href="/"
          style={{
            display: "inline-block",
            marginTop: 24,
            padding: "12px 20px",
            borderRadius: 10,
            background: "#22c55e",
            color: "#052e16",
            textDecoration: "none",
            fontWeight: 700,
          }}
        >
          Return Home
        </a>
      </section>
    </main>
  );
}

export default function Custom404() {
  return (
    <SafeErrorShell
      code="404"
      title="Page not found"
      message="This page is unavailable. No account details are shown on error pages."
    />
  );
}

Custom404.disableLayout = true;
