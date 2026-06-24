import { useEffect, useState } from "react";
import Head from "next/head";
import { useRouter } from "next/router";

const TEMPLATE_DB_NAME = "estimate-builder-template-db";
const TEMPLATE_STORE_NAME = "templates";
const JOB_STORE_NAME = "jobs";
const ACTIVE_JOB_KEY = "active-job";

function openTemplateDb() {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined" || !window.indexedDB) {
      reject(new Error("IndexedDB is not available."));
      return;
    }
    const request = window.indexedDB.open(TEMPLATE_DB_NAME, 2);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(TEMPLATE_STORE_NAME)) {
        db.createObjectStore(TEMPLATE_STORE_NAME);
      }
      if (!db.objectStoreNames.contains(JOB_STORE_NAME)) {
        db.createObjectStore(JOB_STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("Could not open template storage."));
  });
}

async function loadTemplateRecord(key) {
  const db = await openTemplateDb();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(TEMPLATE_STORE_NAME, "readonly");
    const request = transaction.objectStore(TEMPLATE_STORE_NAME).get(key);
    request.onsuccess = () => resolve(request.result?.workbook || request.result || null);
    request.onerror = () => reject(request.error || new Error("Could not load template."));
    transaction.oncomplete = () => db.close();
    transaction.onerror = () => {
      db.close();
      reject(transaction.error || new Error("Could not read template storage."));
    };
  });
}

async function saveRecoveredJob(workbook, key) {
  const db = await openTemplateDb();
  return new Promise((resolve, reject) => {
    const record = {
      type: "job",
      key: `job:recovered-${String(key || "template").replace(/[^a-z0-9:-]+/gi, "-")}`,
      name: workbook?.templateName || "Recovered estimate job",
      savedAt: workbook?.savedAt || new Date().toISOString(),
      workbook,
    };
    const transaction = db.transaction(JOB_STORE_NAME, "readwrite");
    const store = transaction.objectStore(JOB_STORE_NAME);
    store.put(record, record.key);
    store.put(record, ACTIVE_JOB_KEY);
    transaction.oncomplete = () => {
      db.close();
      resolve();
    };
    transaction.onerror = () => {
      db.close();
      reject(transaction.error || new Error("Could not save recovered job."));
    };
  });
}

export default function RecoverEstimateTemplatePage() {
  const router = useRouter();
  const [status, setStatus] = useState("Loading saved template...");

  useEffect(() => {
    if (!router.isReady) return;
    const key = String(router.query.key || "").trim();
    if (!key) {
      setStatus("No template key was provided.");
      return;
    }
    let cancelled = false;
    loadTemplateRecord(key)
      .then((template) => {
        if (cancelled) return;
        if (!template) {
          setStatus(`Template not found: ${key}`);
          return;
        }
        const savedAt = new Date().toISOString();
        const workbook = { ...template, page: "dataInput", savedAt };
        window.localStorage.setItem("estimate-builder-active-draft", JSON.stringify(workbook));
        return saveRecoveredJob(workbook, key);
      })
      .then(() => {
        if (cancelled) return;
        setStatus("Recovered. Opening Estimate Builder...");
        window.location.replace("/modules/estimate-builder");
      })
      .catch((error) => {
        if (!cancelled) setStatus(error?.message || "The template could not be recovered.");
      });
    return () => {
      cancelled = true;
    };
  }, [router.isReady, router.query.key]);

  return (
    <>
      <Head><title>Recover Estimate Template</title></Head>
      <main style={styles.page}>
        <section style={styles.panel}>
          <h1 style={styles.title}>Recovering Estimate Template</h1>
          <p style={styles.status}>{status}</p>
        </section>
      </main>
    </>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    display: "grid",
    placeItems: "center",
    background: "#f1f5f9",
    color: "#0f172a",
    padding: 24,
  },
  panel: {
    width: "min(560px, 100%)",
    background: "#ffffff",
    border: "1px solid #cbd5e1",
    borderRadius: 8,
    padding: 24,
  },
  title: {
    margin: "0 0 8px",
    fontSize: 28,
    lineHeight: 1.15,
  },
  status: {
    margin: 0,
    color: "#475569",
    fontSize: 16,
  },
};
