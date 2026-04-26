// /pages/modules/tools/image-editor.js
import Head from "next/head";
import { useRouter } from "next/router";
import ImageEditorCard from "../../../components/image-editor/ImageEditorCard";

export default function ImageEditorPage() {
  const router = useRouter();
  const { src } = router.query;

  return (
    <>
      <Head>
        <title>Image Editor | GR8 RESULT</title>
      </Head>
      <div style={{ minHeight: "100vh", background: "#020617", padding: "24px 16px" }}>
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
            <div style={{ marginBottom: 8, fontSize: 18, color: "#fff" }}>Current image:</div>
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
            margin: "16px 0",
          }}
        >
          Workflow idea: edit the image in your preferred tool, download the
          finished PNG/JPG, then upload it back into the <strong>Image Library</strong>
          {" "}inside the Email Builder.
        </p>

        <ImageEditorCard initialSrc={src || null} />
      </div>
    </>
  );
}
