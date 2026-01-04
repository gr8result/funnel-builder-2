// /pages/modules/tools/image-editor.js
// Simple placeholder "advanced editor" page – no real editing yet

import { useRouter } from "next/router";
import Head from "next/head";

export default function ImageEditorPage() {
  const router = useRouter();
  const { src } = router.query;

  return (
    <>
      <Head>
        <title>Advanced Image Editor | GR8 RESULT</title>
      </Head>
      <div
        style={{
          minHeight: "100vh",
          background: "#020617",
          color: "#f9fafb",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          padding: "30px 16px",
        }}
      >
        <h1 style={{ fontSize: 32, marginBottom: 10 }}>Advanced Image Editor</h1>
        <p
          style={{
            fontSize: 18,
            maxWidth: 800,
            textAlign: "center",
            color: "#9ca3af",
            marginBottom: 24,
          }}
        >
          This is a placeholder page opened from the email builder when you click{" "}
          <strong>&quot;Open in advanced editor&quot;</strong>. Here you can
          embed Canva, Photopea, or any other image editor.
        </p>

        {src && (
          <div
            style={{
              borderRadius: 12,
              border: "1px solid #1f2937",
              background: "#0b1120",
              padding: 16,
              marginBottom: 24,
            }}
          >
            <div style={{ marginBottom: 8, fontSize: 18 }}>Current image:</div>
            <img
              src={src}
              alt="Selected from email builder"
              style={{
                maxWidth: "80vw",
                maxHeight: "60vh",
                borderRadius: 12,
                objectFit: "contain",
              }}
            />
          </div>
        )}

        <a
          href="https://www.canva.com"
          target="_blank"
          rel="noreferrer"
          style={{
            display: "inline-block",
            padding: "12px 28px",
            borderRadius: 999,
            background:
              "linear-gradient(135deg,#22c55e 0%,#3b82f6 50%,#a855f7 100%)",
            color: "#020617",
            fontSize: 18,
            fontWeight: 700,
            textDecoration: "none",
            marginBottom: 16,
          }}
        >
          Open Canva (example)
        </a>

        <p
          style={{
            fontSize: 16,
            color: "#9ca3af",
            maxWidth: 800,
            textAlign: "center",
          }}
        >
          Workflow idea: edit the image in your preferred tool, download the
          finished PNG/JPG, then upload it back into the{" "}
          <strong>Image Library</strong> inside the Email Builder.
        </p>
      </div>
    </>
  );
}
