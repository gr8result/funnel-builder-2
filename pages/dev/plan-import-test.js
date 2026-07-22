/* eslint-disable @next/next/no-img-element, no-await-in-loop */
import Head from 'next/head';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

const PDFJS_URL = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
const PDFJS_WORKER_URL = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
const TESSERACT_URL = 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js';

const CANDIDATE_ROTATIONS = [0, 90, 180, 270];
const ARCHITECTURAL_KEYWORDS = [
  'FLOOR PLAN',
  'GROUND FLOOR',
  'FIRST FLOOR',
  'BEDROOM',
  'KITCHEN',
  'BATHROOM',
  'GARAGE',
  'LIVING',
  'DINING',
  'LAUNDRY',
  'SCALE',
  'DRAWING',
  'PROJECT',
  'CLIENT',
];

const SCORE_WEIGHTS = {
  metadata: 5,
  nativeHorizontal: 35,
  nativeDirection: 12,
  ocrConfidence: 20,
  ocrHorizontal: 12,
  keywords: 16,
  titleBlock: 10,
  lineDistribution: 10,
};

function loadScript(src) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) {
      resolve();
      return;
    }
    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.onload = resolve;
    script.onerror = () => reject(new Error(`Unable to load ${src}`));
    document.head.appendChild(script);
  });
}

async function ensurePdfJs() {
  await loadScript(PDFJS_URL);
  window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER_URL;
  return window.pdfjsLib;
}

async function ensureTesseract() {
  await loadScript(TESSERACT_URL);
  return window.Tesseract;
}

function normalizeRotation(value) {
  return ((Math.round(value / 90) * 90) % 360 + 360) % 360;
}

function getTextAngle(item) {
  const [a, b] = item.transform || [1, 0];
  return normalizeRotation((Math.atan2(b, a) * 180) / Math.PI);
}

function rotatePoint(x, y, width, height, rotation) {
  if (rotation === 90) return { x: height - y, y: x };
  if (rotation === 180) return { x: width - x, y: height - y };
  if (rotation === 270) return { x: y, y: width - x };
  return { x, y };
}

function candidateSize(width, height, rotation) {
  return rotation === 90 || rotation === 270
    ? { width: height, height: width }
    : { width, height };
}

function keywordCount(text) {
  const upper = text.toUpperCase();
  return ARCHITECTURAL_KEYWORDS.reduce((count, keyword) => {
    return count + (upper.match(new RegExp(`\\b${keyword}\\b`, 'g')) || []).length;
  }, 0);
}

function scoreLineDistribution(canvas) {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const { width, height } = canvas;
  const data = ctx.getImageData(0, 0, width, height).data;
  let horizontal = 0;
  let vertical = 0;
  const step = Math.max(2, Math.floor(Math.min(width, height) / 280));

  for (let y = step; y < height - step; y += step) {
    let run = 0;
    for (let x = step; x < width - step; x += step) {
      const i = (y * width + x) * 4;
      const dark = data[i] < 145 && data[i + 1] < 145 && data[i + 2] < 145;
      run = dark ? run + 1 : 0;
      if (run >= 8) horizontal += 1;
    }
  }

  for (let x = step; x < width - step; x += step) {
    let run = 0;
    for (let y = step; y < height - step; y += step) {
      const i = (y * width + x) * 4;
      const dark = data[i] < 145 && data[i + 1] < 145 && data[i + 2] < 145;
      run = dark ? run + 1 : 0;
      if (run >= 8) vertical += 1;
    }
  }

  const total = horizontal + vertical;
  const balance = total ? 1 - Math.abs(horizontal - vertical) / total : 0;
  return {
    horizontal,
    vertical,
    contribution: Math.round(balance * SCORE_WEIGHTS.lineDistribution),
  };
}

function scoreNativeText(textItems, pageWidth, pageHeight, rotation, metadataRotation) {
  const size = candidateSize(pageWidth, pageHeight, rotation);
  const expectedAngle = normalizeRotation(360 - rotation);
  let horizontalWords = 0;
  let directionalMatches = 0;
  let titleBlockHits = 0;
  let readableText = '';

  textItems.forEach((item) => {
    const text = (item.str || '').trim();
    if (!text) return;
    const wordCount = text.split(/\s+/).filter(Boolean).length;
    const angle = getTextAngle(item);
    const angleDelta = Math.min(
      Math.abs(angle - expectedAngle),
      360 - Math.abs(angle - expectedAngle),
    );
    const rotated = rotatePoint(item.transform?.[4] || 0, item.transform?.[5] || 0, pageWidth, pageHeight, rotation);
    const inTitleZone = rotated.x > size.width * 0.58 && rotated.y > size.height * 0.58;

    readableText += ` ${text}`;
    if (angleDelta <= 15) horizontalWords += wordCount;
    if (angleDelta <= 15 && text.length > 1) directionalMatches += 1;
    if (inTitleZone && ARCHITECTURAL_KEYWORDS.some((keyword) => text.toUpperCase().includes(keyword))) {
      titleBlockHits += 1;
    }
  });

  const nativeItems = textItems.filter((item) => (item.str || '').trim()).length;
  const keywords = keywordCount(readableText);
  const metadataMatch = normalizeRotation(metadataRotation) === rotation;
  const nativeHorizontalContribution = Math.min(
    SCORE_WEIGHTS.nativeHorizontal,
    Math.round((horizontalWords / Math.max(1, nativeItems * 2)) * SCORE_WEIGHTS.nativeHorizontal),
  );
  const nativeDirectionContribution = Math.min(
    SCORE_WEIGHTS.nativeDirection,
    Math.round((directionalMatches / Math.max(1, nativeItems)) * SCORE_WEIGHTS.nativeDirection),
  );
  const keywordContribution = Math.min(SCORE_WEIGHTS.keywords, keywords * 3);
  const titleContribution = Math.min(SCORE_WEIGHTS.titleBlock, titleBlockHits * 5);

  return {
    nativeItems,
    horizontalWords,
    directionalMatches,
    keywords,
    titleBlockHits,
    readableText,
    contributions: {
      metadata: metadataMatch ? SCORE_WEIGHTS.metadata : 0,
      nativeHorizontal: nativeHorizontalContribution,
      nativeDirection: nativeDirectionContribution,
      keywords: keywordContribution,
      titleBlock: titleContribution,
    },
  };
}

function createRotatedCanvas(sourceCanvas, rotation, maxThumbSide = 320) {
  const sourceWidth = sourceCanvas.width;
  const sourceHeight = sourceCanvas.height;
  const rotatedSize = candidateSize(sourceWidth, sourceHeight, rotation);
  const scale = Math.min(maxThumbSide / rotatedSize.width, maxThumbSide / rotatedSize.height, 1);
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(rotatedSize.width * scale));
  canvas.height = Math.max(1, Math.round(rotatedSize.height * scale));
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.save();
  ctx.scale(scale, scale);
  if (rotation === 90) {
    ctx.translate(rotatedSize.width, 0);
    ctx.rotate(Math.PI / 2);
  } else if (rotation === 180) {
    ctx.translate(rotatedSize.width, rotatedSize.height);
    ctx.rotate(Math.PI);
  } else if (rotation === 270) {
    ctx.translate(0, rotatedSize.height);
    ctx.rotate((3 * Math.PI) / 2);
  }
  ctx.drawImage(sourceCanvas, 0, 0);
  ctx.restore();
  return canvas;
}

function contributionTotal(contributions) {
  return Object.values(contributions).reduce((sum, value) => sum + value, 0);
}

function getPersistenceKey(fileHash, pageNumber) {
  return `plan-import-test:confirmed-rotation:${fileHash}:page-${pageNumber}`;
}

async function hashFile(file) {
  const buffer = await file.arrayBuffer();
  const digest = await crypto.subtle.digest('SHA-256', buffer);
  const bytes = Array.from(new Uint8Array(digest));
  return {
    bytes: new Uint8Array(buffer),
    hash: bytes.map((byte) => byte.toString(16).padStart(2, '0')).join('').slice(0, 24),
  };
}

export default function PlanImportTest() {
  const [status, setStatus] = useState('Upload a PDF to begin.');
  const [error, setError] = useState('');
  const [fileName, setFileName] = useState('');
  const [fileHash, setFileHash] = useState('');
  const [pages, setPages] = useState([]);
  const [activePageIndex, setActivePageIndex] = useState(0);
  const [selectedRotation, setSelectedRotation] = useState(0);
  const [confirmedRotations, setConfirmedRotations] = useState({});
  const viewerCanvasRef = useRef(null);
  const originalPdfBytesRef = useRef(null);

  const activePage = pages[activePageIndex];
  const recommended = activePage?.candidates?.[0]?.rotation ?? 0;
  const selectedCandidate = activePage?.candidates?.find((candidate) => candidate.rotation === selectedRotation);

  const sortedPages = useMemo(() => pages.map((page, index) => ({ ...page, index })), [pages]);

  const drawViewer = useCallback((rotation) => {
    const page = pages[activePageIndex];
    const viewer = viewerCanvasRef.current;
    if (!page || !viewer) return;
    const image = page.sourceCanvas;
    const size = candidateSize(image.width, image.height, rotation);
    const parent = viewer.parentElement;
    const maxWidth = Math.max(320, parent.clientWidth - 40);
    const maxHeight = Math.max(360, window.innerHeight - 280);
    const scale = Math.min(maxWidth / size.width, maxHeight / size.height);
    viewer.width = Math.round(size.width * scale);
    viewer.height = Math.round(size.height * scale);
    const ctx = viewer.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, viewer.width, viewer.height);
    ctx.save();
    ctx.scale(scale, scale);
    if (rotation === 90) {
      ctx.translate(size.width, 0);
      ctx.rotate(Math.PI / 2);
    } else if (rotation === 180) {
      ctx.translate(size.width, size.height);
      ctx.rotate(Math.PI);
    } else if (rotation === 270) {
      ctx.translate(0, size.height);
      ctx.rotate((3 * Math.PI) / 2);
    }
    ctx.drawImage(image, 0, 0);
    ctx.restore();
  }, [activePageIndex, pages]);

  useEffect(() => {
    const page = pages[activePageIndex];
    if (!page) return;
    const persisted = confirmedRotations[page.pageNumber];
    setSelectedRotation(typeof persisted === 'number' ? persisted : page.recommendedRotation);
  }, [activePageIndex, confirmedRotations, pages]);

  useEffect(() => {
    drawViewer(selectedRotation);
    const onResize = () => drawViewer(selectedRotation);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [drawViewer, selectedRotation]);

  const analyzePage = useCallback(async (pdfPage, pageNumber, pdfjs, tesseract) => {
    const metadataRotation = normalizeRotation(pdfPage.rotate || 0);
    const textContent = await pdfPage.getTextContent().catch(() => ({ items: [] }));
    const viewport = pdfPage.getViewport({ scale: 2.4, rotation: 0 });
    const sourceCanvas = document.createElement('canvas');
    sourceCanvas.width = Math.ceil(viewport.width);
    sourceCanvas.height = Math.ceil(viewport.height);
    const sourceContext = sourceCanvas.getContext('2d', { alpha: false });
    sourceContext.fillStyle = '#ffffff';
    sourceContext.fillRect(0, 0, sourceCanvas.width, sourceCanvas.height);
    await pdfPage.render({ canvasContext: sourceContext, viewport }).promise;

    const textItems = textContent.items || [];
    const shouldOcr = textItems.filter((item) => (item.str || '').trim()).length < 8;
    const candidates = [];

    for (const rotation of CANDIDATE_ROTATIONS) {
      const thumbCanvas = createRotatedCanvas(sourceCanvas, rotation);
      const nativeScore = scoreNativeText(textItems, viewport.width, viewport.height, rotation, metadataRotation);
      const lineScore = scoreLineDistribution(thumbCanvas);
      let ocr = {
        confidence: null,
        text: '',
        words: 0,
        contributionConfidence: 0,
        contributionHorizontal: 0,
      };

      if (shouldOcr && tesseract) {
        const result = await tesseract.recognize(thumbCanvas, 'eng');
        const confidence = Math.round(result?.data?.confidence || 0);
        const text = result?.data?.text || '';
        const words = text.split(/\s+/).filter((word) => /[A-Za-z0-9]{2,}/.test(word)).length;
        const keywords = keywordCount(text);
        ocr = {
          confidence,
          text,
          words,
          contributionConfidence: Math.round((confidence / 100) * SCORE_WEIGHTS.ocrConfidence),
          contributionHorizontal: Math.min(SCORE_WEIGHTS.ocrHorizontal, Math.round(words / 8)),
          keywords,
        };
      }

      const contributions = {
        ...nativeScore.contributions,
        ocrConfidence: ocr.contributionConfidence,
        ocrHorizontal: ocr.contributionHorizontal,
        ocrKeywords: Math.min(SCORE_WEIGHTS.keywords, (ocr.keywords || 0) * 3),
        lineDistribution: lineScore.contribution,
      };
      const score = contributionTotal(contributions);

      candidates.push({
        rotation,
        thumbnailUrl: thumbCanvas.toDataURL('image/png'),
        score,
        metadataRotation,
        nativeItems: nativeScore.nativeItems,
        readableHorizontalWords: nativeScore.horizontalWords,
        architecturalKeywords: nativeScore.keywords + (ocr.keywords || 0),
        ocrConfidence: ocr.confidence,
        lineHorizontal: lineScore.horizontal,
        lineVertical: lineScore.vertical,
        contributions,
        reasons: [
          `Metadata contribution: ${contributions.metadata}`,
          `Native horizontal contribution: ${contributions.nativeHorizontal}`,
          `Native direction contribution: ${contributions.nativeDirection}`,
          `Keyword contribution: ${contributions.keywords + contributions.ocrKeywords}`,
          `OCR contribution: ${contributions.ocrConfidence + contributions.ocrHorizontal}`,
          `Line distribution contribution: ${contributions.lineDistribution}`,
        ],
      });
    }

    candidates.sort((a, b) => b.score - a.score);
    return {
      pageNumber,
      metadataRotation,
      nativeTextItems: textItems.filter((item) => (item.str || '').trim()).length,
      renderedWidth: sourceCanvas.width,
      renderedHeight: sourceCanvas.height,
      usedOcr: shouldOcr,
      sourceCanvas,
      recommendedRotation: candidates[0]?.rotation || 0,
      candidates,
    };
  }, []);

  const handleUpload = useCallback(async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setError('');
    setPages([]);
    setFileName(file.name);
    setStatus('Loading PDF libraries...');

    try {
      const [{ bytes, hash }, pdfjs] = await Promise.all([hashFile(file), ensurePdfJs()]);
      originalPdfBytesRef.current = bytes;
      setFileHash(hash);
      setStatus('Opening original PDF without modifying it...');
      const pdf = await pdfjs.getDocument({ data: bytes }).promise;
      const tesseract = await ensureTesseract().catch(() => null);
      const loadedPages = [];
      const persisted = {};

      for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
        setStatus(`Analyzing page ${pageNumber} of ${pdf.numPages}...`);
        const pdfPage = await pdf.getPage(pageNumber);
        const analyzed = await analyzePage(pdfPage, pageNumber, pdfjs, tesseract);
        const saved = window.localStorage.getItem(getPersistenceKey(hash, pageNumber));
        if (saved !== null) persisted[pageNumber] = normalizeRotation(Number(saved));
        loadedPages.push(analyzed);
      }

      setConfirmedRotations(persisted);
      setPages(loadedPages);
      setActivePageIndex(0);
      setStatus(`Loaded ${pdf.numPages} page${pdf.numPages === 1 ? '' : 's'}. Scores are ready for review.`);
    } catch (uploadError) {
      setError(uploadError.message || 'Unable to load PDF.');
      setStatus('Upload failed.');
    }
  }, [analyzePage]);

  const confirmRotation = useCallback(() => {
    const page = pages[activePageIndex];
    if (!page || !fileHash) return;
    const rotation = normalizeRotation(selectedRotation);
    window.localStorage.setItem(getPersistenceKey(fileHash, page.pageNumber), String(rotation));
    setConfirmedRotations((current) => ({ ...current, [page.pageNumber]: rotation }));
    setStatus(`Confirmed ${rotation} degrees for page ${page.pageNumber}. Reload-safe value saved separately from the PDF.`);
  }, [activePageIndex, fileHash, pages, selectedRotation]);

  const reloadPersistence = useCallback(() => {
    if (!fileHash || !pages.length) return;
    const persisted = {};
    pages.forEach((page) => {
      const saved = window.localStorage.getItem(getPersistenceKey(fileHash, page.pageNumber));
      if (saved !== null) persisted[page.pageNumber] = normalizeRotation(Number(saved));
    });
    setConfirmedRotations(persisted);
    setStatus('Reloaded saved orientation values from browser storage.');
  }, [fileHash, pages]);

  const verifyReloadPersistence = useCallback(async () => {
    if (!fileHash || !originalPdfBytesRef.current) {
      setStatus('Upload a PDF before running the reload persistence check.');
      return;
    }

    try {
      setStatus('Reopening the preserved original PDF bytes and checking saved rotations...');
      const pdfjs = await ensurePdfJs();
      const tesseract = await ensureTesseract().catch(() => null);
      const pdf = await pdfjs.getDocument({ data: originalPdfBytesRef.current.slice() }).promise;
      const reloadedPages = [];
      const persisted = {};

      for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
        setStatus(`Reload verification: analyzing page ${pageNumber} of ${pdf.numPages}...`);
        const pdfPage = await pdf.getPage(pageNumber);
        const analyzed = await analyzePage(pdfPage, pageNumber, pdfjs, tesseract);
        const saved = window.localStorage.getItem(getPersistenceKey(fileHash, pageNumber));
        if (saved !== null) persisted[pageNumber] = normalizeRotation(Number(saved));
        reloadedPages.push(analyzed);
      }

      setPages(reloadedPages);
      setConfirmedRotations(persisted);
      setActivePageIndex(0);
      setStatus('Reload verification complete: confirmed rotations were reloaded separately from the original PDF.');
    } catch (reloadError) {
      setError(reloadError.message || 'Reload verification failed.');
      setStatus('Reload verification failed.');
    }
  }, [analyzePage, fileHash]);

  const rotateSelected = useCallback((delta) => {
    setSelectedRotation((rotation) => normalizeRotation(rotation + delta));
  }, []);

  return (
    <>
      <Head>
        <title>Plan Import Orientation Test</title>
      </Head>
      <main className="page">
        <section className="topbar">
          <div>
            <p className="eyebrow">Development harness</p>
            <h1>PDF orientation test</h1>
            <p className="status">{status}</p>
            {error ? <p className="error">{error}</p> : null}
          </div>
          <label className="upload">
            <span>Upload PDF</span>
            <input type="file" accept="application/pdf" onChange={handleUpload} />
          </label>
        </section>

        {pages.length ? (
          <>
            <section className="summary">
              <div>
                <span>File</span>
                <strong>{fileName}</strong>
              </div>
              <div>
                <span>Hash key</span>
                <strong>{fileHash}</strong>
              </div>
              <div>
                <span>Pages</span>
                <strong>{pages.length}</strong>
              </div>
              <button type="button" onClick={reloadPersistence}>Reload saved orientation</button>
              <button type="button" onClick={verifyReloadPersistence}>Verify reload persistence</button>
            </section>

            <section className="pageTabs" aria-label="PDF pages">
              {sortedPages.map((page) => (
                <button
                  type="button"
                  key={page.pageNumber}
                  className={page.index === activePageIndex ? 'active' : ''}
                  onClick={() => setActivePageIndex(page.index)}
                >
                  Page {page.pageNumber}
                  <small>{confirmedRotations[page.pageNumber] ?? page.recommendedRotation} deg</small>
                </button>
              ))}
            </section>

            {activePage ? (
              <section className="workspace">
                <div className="diagnostics">
                  <div className="pageMeta">
                    <div>
                      <span>PDF metadata rotation</span>
                      <strong>{activePage.metadataRotation} degrees</strong>
                    </div>
                    <div>
                      <span>Native text items</span>
                      <strong>{activePage.nativeTextItems}</strong>
                    </div>
                    <div>
                      <span>Rendered analysis size</span>
                      <strong>{activePage.renderedWidth} x {activePage.renderedHeight}</strong>
                    </div>
                    <div>
                      <span>OCR used</span>
                      <strong>{activePage.usedOcr ? 'Yes' : 'No'}</strong>
                    </div>
                  </div>

                  <div className="candidateGrid">
                    {CANDIDATE_ROTATIONS.map((rotation) => {
                      const candidate = activePage.candidates.find((item) => item.rotation === rotation);
                      if (!candidate) return null;
                      const isRecommended = candidate.rotation === recommended;
                      const isSelected = candidate.rotation === selectedRotation;
                      return (
                        <button
                          type="button"
                          key={candidate.rotation}
                          className={`candidate ${isSelected ? 'selected' : ''}`}
                          onClick={() => setSelectedRotation(candidate.rotation)}
                        >
                          <img src={candidate.thumbnailUrl} alt={`Page ${activePage.pageNumber} rotated ${candidate.rotation} degrees`} />
                          <span className="candidateTitle">
                            <strong>Rotation: {candidate.rotation} degrees</strong>
                            <em>{isRecommended ? 'Recommended: Yes' : 'Recommended: No'}</em>
                          </span>
                          <span className="metrics">
                            <span>Native text items: {candidate.nativeItems}</span>
                            <span>Readable horizontal words: {candidate.readableHorizontalWords}</span>
                            <span>Architectural keywords: {candidate.architecturalKeywords}</span>
                            <span>OCR confidence: {candidate.ocrConfidence === null ? 'Not used' : `${candidate.ocrConfidence}%`}</span>
                            <span>Lines H/V: {candidate.lineHorizontal}/{candidate.lineVertical}</span>
                            <span>Final score: {candidate.score}</span>
                          </span>
                          <span className="reasons">
                            {candidate.reasons.map((reason) => (
                              <small key={reason}>{reason}</small>
                            ))}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="viewerPanel">
                  <div className="controls">
                    <button type="button" onClick={() => rotateSelected(-90)}>Rotate Left</button>
                    <button type="button" onClick={() => rotateSelected(90)}>Rotate Right</button>
                    <button type="button" className="primary" onClick={confirmRotation}>Confirm Orientation</button>
                  </div>
                  <div className="viewerMeta">
                    <span>Selected: {selectedRotation} degrees</span>
                    <span>Recommended: {recommended} degrees</span>
                    <span>Confirmed: {confirmedRotations[activePage.pageNumber] ?? 'Not saved'}</span>
                    <span>Score: {selectedCandidate?.score ?? 0}</span>
                  </div>
                  <div className="viewer">
                    <canvas ref={viewerCanvasRef} />
                  </div>
                </div>
              </section>
            ) : null}
          </>
        ) : (
          <section className="empty">
            <p>This isolated route tests PDF import, page rendering, rotation metadata, native text extraction, OCR fallback, candidate scoring, manual selection and persistence only.</p>
          </section>
        )}
      </main>

      <style jsx>{`
        .page {
          min-height: 100vh;
          background: #f5f7f9;
          color: #14202b;
          font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
          padding: 24px;
        }

        .topbar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 24px;
          padding-bottom: 18px;
          border-bottom: 1px solid #d9e0e7;
        }

        h1 {
          margin: 0;
          font-size: 30px;
          letter-spacing: 0;
        }

        .eyebrow {
          margin: 0 0 4px;
          color: #617180;
          font-size: 13px;
          text-transform: uppercase;
          letter-spacing: 0;
        }

        .status,
        .error {
          margin: 8px 0 0;
          color: #465766;
        }

        .error {
          color: #b42318;
          font-weight: 700;
        }

        .upload,
        button {
          border: 1px solid #b9c5d0;
          background: #ffffff;
          color: #14202b;
          border-radius: 6px;
          min-height: 40px;
          padding: 9px 13px;
          font-weight: 700;
          cursor: pointer;
        }

        .upload input {
          display: none;
        }

        .summary,
        .pageMeta,
        .viewerMeta {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
          gap: 12px;
        }

        .summary {
          align-items: center;
          margin: 18px 0;
        }

        .summary div,
        .pageMeta div,
        .viewerMeta span {
          background: #ffffff;
          border: 1px solid #d9e0e7;
          border-radius: 6px;
          padding: 10px 12px;
        }

        .summary span,
        .pageMeta span {
          display: block;
          color: #617180;
          font-size: 12px;
          margin-bottom: 4px;
        }

        .pageTabs {
          display: flex;
          gap: 8px;
          overflow-x: auto;
          padding-bottom: 12px;
        }

        .pageTabs button {
          display: grid;
          gap: 2px;
          min-width: 94px;
        }

        .pageTabs small {
          color: #617180;
        }

        .pageTabs .active,
        .candidate.selected {
          border-color: #1769aa;
          box-shadow: 0 0 0 2px rgba(23, 105, 170, 0.18);
        }

        .workspace {
          display: grid;
          grid-template-columns: minmax(0, 1.25fr) minmax(360px, 0.75fr);
          gap: 18px;
          align-items: start;
        }

        .diagnostics,
        .viewerPanel,
        .empty {
          background: #ffffff;
          border: 1px solid #d9e0e7;
          border-radius: 6px;
          padding: 16px;
        }

        .candidateGrid {
          display: grid;
          grid-template-columns: repeat(4, minmax(180px, 1fr));
          gap: 12px;
          margin-top: 14px;
        }

        .candidate {
          display: grid;
          gap: 10px;
          text-align: left;
          align-content: start;
          min-height: 100%;
          padding: 10px;
        }

        .candidate img {
          width: 100%;
          aspect-ratio: 1 / 1;
          object-fit: contain;
          background: #eef2f5;
          border: 1px solid #d9e0e7;
        }

        .candidateTitle,
        .metrics,
        .reasons {
          display: grid;
          gap: 4px;
        }

        .candidateTitle em {
          color: #1769aa;
          font-style: normal;
          font-size: 13px;
        }

        .metrics span,
        .reasons small,
        .viewerMeta span {
          font-size: 12px;
          color: #3c4d5b;
        }

        .controls {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin-bottom: 12px;
        }

        .primary {
          background: #1769aa;
          border-color: #1769aa;
          color: #ffffff;
        }

        .viewerMeta {
          margin-bottom: 12px;
        }

        .viewer {
          min-height: 420px;
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: auto;
          background: #eef2f5;
          border: 1px solid #d9e0e7;
          border-radius: 6px;
          padding: 16px;
        }

        .viewer canvas {
          display: block;
          background: #ffffff;
          box-shadow: 0 8px 24px rgba(20, 32, 43, 0.14);
          max-width: 100%;
          height: auto;
        }

        .empty {
          max-width: 760px;
          margin-top: 24px;
          color: #465766;
        }

        @media (max-width: 1180px) {
          .workspace,
          .candidateGrid {
            grid-template-columns: 1fr;
          }

          .candidateGrid {
            grid-template-columns: repeat(2, minmax(180px, 1fr));
          }
        }

        @media (max-width: 680px) {
          .page {
            padding: 14px;
          }

          .topbar {
            align-items: stretch;
            flex-direction: column;
          }

          .candidateGrid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </>
  );
}
