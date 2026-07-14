import Head from "next/head";
import { useEffect, useMemo, useRef, useState } from "react";

const TILE_SIZE = 256;
const TILE_SOURCE_KIND = "openseadragon-client-pyramid";

function createDemoPlanDataUrl() {
  if (typeof document === "undefined") {
    return "";
  }

  const canvas = document.createElement("canvas");
  canvas.width = 3200;
  canvas.height = 2200;
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = "#111827";
  ctx.lineWidth = 12;
  ctx.strokeRect(220, 190, 2050, 1450);
  ctx.strokeRect(450, 430, 620, 470);
  ctx.strokeRect(1180, 430, 820, 470);
  ctx.strokeRect(450, 1010, 720, 440);
  ctx.strokeRect(1280, 1010, 720, 440);

  ctx.lineWidth = 5;
  ctx.strokeStyle = "#64748b";
  for (let x = 260; x <= 2240; x += 150) {
    ctx.beginPath();
    ctx.moveTo(x, 170);
    ctx.lineTo(x, 1660);
    ctx.stroke();
  }
  for (let y = 280; y <= 1600; y += 150) {
    ctx.beginPath();
    ctx.moveTo(200, y);
    ctx.lineTo(2300, y);
    ctx.stroke();
  }

  ctx.strokeStyle = "#0f172a";
  ctx.lineWidth = 7;
  ctx.strokeRect(2380, 190, 610, 930);
  ctx.font = "700 72px Arial";
  ctx.fillStyle = "#0f172a";
  ctx.fillText("PROJECT TAKEOFF", 2460, 340);
  ctx.font = "42px Arial";
  ctx.fillText("SCALE 1:100 @ A3", 2460, 440);
  ctx.fillText("GROUND FLOOR PLAN", 2460, 530);
  ctx.fillText("NORTH", 2460, 650);
  ctx.font = "30px Arial";
  ctx.fillText("Tile pyramid demo image", 2460, 760);

  return canvas.toDataURL("image/png");
}

function loadOpenSeadragon() {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("OpenSeadragon requires a browser"));
  }

  return import("openseadragon").then((module) => module.default || module);
}

function readImageFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error || new Error("Failed to read image"));
    reader.readAsDataURL(file);
  });
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Failed to decode raster image"));
    image.src = src;
  });
}

function normaliseRotation(value) {
  return ((Number(value || 0) % 360) + 360) % 360;
}

function getLevelScale(level, maxLevel) {
  return 1 / 2 ** (maxLevel - level);
}

function getLevelSize(width, height, level, maxLevel) {
  const scale = getLevelScale(level, maxLevel);
  return {
    width: Math.max(1, Math.ceil(width * scale)),
    height: Math.max(1, Math.ceil(height * scale)),
  };
}

function canvasToObjectUrl(canvas) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error("Failed to generate tile image"));
        return;
      }
      resolve(URL.createObjectURL(blob));
    }, "image/png");
  });
}

function releaseTilePyramid(tilePyramid) {
  if (!tilePyramid?.tileUrls) {
    return;
  }
  tilePyramid.tileUrls.forEach((url) => URL.revokeObjectURL(url));
}

async function generateTilePyramid(image, onProgress) {
  const width = image.naturalWidth || image.width;
  const height = image.naturalHeight || image.height;
  const maxLevel = Math.ceil(Math.log2(Math.max(width, height)));
  const minLevel = 0;
  const tileUrls = new Map();
  const levelSummaries = [];

  let totalTiles = 0;
  for (let level = minLevel; level <= maxLevel; level += 1) {
    const levelSize = getLevelSize(width, height, level, maxLevel);
    const columns = Math.ceil(levelSize.width / TILE_SIZE);
    const rows = Math.ceil(levelSize.height / TILE_SIZE);
    totalTiles += columns * rows;
    levelSummaries.push({ level, ...levelSize, columns, rows, tiles: columns * rows });
  }

  const tileCanvas = document.createElement("canvas");
  const tileCtx = tileCanvas.getContext("2d", { alpha: false });
  if (!tileCtx) {
    throw new Error("Canvas tile renderer is unavailable");
  }

  let generatedTiles = 0;
  onProgress?.({
    status: "Generating tile pyramid...",
    percent: 0,
    generatedTiles,
    totalTiles,
    levels: levelSummaries.length,
  });

  for (const summary of levelSummaries) {
    const levelScale = getLevelScale(summary.level, maxLevel);

    for (let y = 0; y < summary.rows; y += 1) {
      for (let x = 0; x < summary.columns; x += 1) {
        const tileWidth = Math.min(TILE_SIZE, summary.width - x * TILE_SIZE);
        const tileHeight = Math.min(TILE_SIZE, summary.height - y * TILE_SIZE);
        tileCanvas.width = tileWidth;
        tileCanvas.height = tileHeight;
        tileCtx.fillStyle = "#ffffff";
        tileCtx.fillRect(0, 0, tileWidth, tileHeight);
        tileCtx.imageSmoothingEnabled = true;
        tileCtx.imageSmoothingQuality = "high";
        tileCtx.drawImage(
          image,
          (x * TILE_SIZE) / levelScale,
          (y * TILE_SIZE) / levelScale,
          tileWidth / levelScale,
          tileHeight / levelScale,
          0,
          0,
          tileWidth,
          tileHeight,
        );

        tileUrls.set(`${summary.level}/${x}_${y}`, await canvasToObjectUrl(tileCanvas));
        generatedTiles += 1;

        if (generatedTiles % 10 === 0 || generatedTiles === totalTiles) {
          onProgress?.({
            status: `Generating tiles: ${generatedTiles} of ${totalTiles}`,
            percent: Math.round((generatedTiles / totalTiles) * 100),
            generatedTiles,
            totalTiles,
            levels: levelSummaries.length,
            currentLevel: summary.level,
          });
          await new Promise((resolve) => window.requestAnimationFrame(resolve));
        }
      }
    }
  }

  return {
    width,
    height,
    tileSize: TILE_SIZE,
    minLevel,
    maxLevel,
    levelSummaries,
    tileUrls,
    totalTiles,
    getTileUrl(level, x, y) {
      return tileUrls.get(`${level}/${x}_${y}`) || "";
    },
  };
}

function createOpenSeadragonTileSource(tilePyramid) {
  return {
    id: TILE_SOURCE_KIND,
    width: tilePyramid.width,
    height: tilePyramid.height,
    tileSize: tilePyramid.tileSize,
    minLevel: tilePyramid.minLevel,
    maxLevel: tilePyramid.maxLevel,
    getTileUrl(level, x, y) {
      return tilePyramid.getTileUrl(level, x, y);
    },
  };
}

export default function TakeoffViewerSpikePage() {
  const containerRef = useRef(null);
  const viewerRef = useRef(null);
  const tilePyramidRef = useRef(null);
  const [OpenSeadragonLib, setOpenSeadragonLib] = useState(null);
  const [tilePyramid, setTilePyramid] = useState(null);
  const [imageInfo, setImageInfo] = useState({ width: 0, height: 0, name: "No raster image loaded" });
  const [rotation, setRotation] = useState(0);
  const [status, setStatus] = useState("Loading OpenSeadragon...");
  const [progress, setProgress] = useState(null);
  const [error, setError] = useState("");
  const [overlayTick, setOverlayTick] = useState(0);
  const [overlayPoints, setOverlayPoints] = useState([]);

  const screenPoints = useMemo(() => {
    const viewer = viewerRef.current;
    if (!viewer?.viewport || !OpenSeadragonLib) {
      return [];
    }

    return overlayPoints.map((point) => {
      const screenPoint = viewer.viewport.imageToViewerElementCoordinates(
        new OpenSeadragonLib.Point(point.x, point.y),
      );
      return { ...point, screenX: screenPoint.x, screenY: screenPoint.y };
    });
  }, [OpenSeadragonLib, overlayPoints, overlayTick]);

  const tileStats = useMemo(() => {
    if (!tilePyramid) {
      return "No tiles generated";
    }
    return `${tilePyramid.levelSummaries.length} levels, ${tilePyramid.totalTiles} PNG tiles, ${tilePyramid.tileSize}px tiles`;
  }, [tilePyramid]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    window.__TAKEOFF_SPIKE_POINTS__ = overlayPoints;
    window.__TAKEOFF_SPIKE_SCREEN_POINTS__ = screenPoints;
    window.__TAKEOFF_SPIKE_ROTATION__ = rotation;
    window.__TAKEOFF_SPIKE_TILE_LEVELS__ = tilePyramid?.levelSummaries || [];
    window.__TAKEOFF_SPIKE_TILE_COUNT__ = tilePyramid?.totalTiles || 0;
    window.__TAKEOFF_SPIKE_TILE_SOURCE_KIND__ = tilePyramid ? TILE_SOURCE_KIND : null;
  }, [overlayPoints, rotation, screenPoints, tilePyramid]);

  useEffect(() => {
    let alive = true;
    loadOpenSeadragon()
      .then((library) => {
        if (!alive) {
          return;
        }
        setOpenSeadragonLib(library);
        return buildTilesFromDataUrl(createDemoPlanDataUrl(), "Generated raster plan");
      })
      .catch((loadError) => {
        setError(loadError.message || "Failed to load viewer library");
        setStatus("Viewer failed to initialise.");
      });

    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!OpenSeadragonLib || !containerRef.current || !tilePyramid) {
      return undefined;
    }

    viewerRef.current?.destroy?.();
    const viewer = OpenSeadragonLib({
      element: containerRef.current,
      prefixUrl: "",
      mouseNavEnabled: true,
      showNavigator: true,
      navigatorAutoFade: false,
      showNavigationControl: false,
      immediateRender: true,
      blendTime: 0,
      animationTime: 0.08,
      springStiffness: 12,
      minZoomImageRatio: 0.03,
      maxZoomPixelRatio: 12,
      zoomPerScroll: 1.22,
      visibilityRatio: 0.02,
      constrainDuringPan: false,
      gestureSettingsMouse: {
        clickToZoom: false,
        dblClickToZoom: false,
        dragToPan: true,
        flickEnabled: true,
        pinchToZoom: true,
        scrollToZoom: true,
      },
      tileSources: createOpenSeadragonTileSource(tilePyramid),
    });

    viewerRef.current = viewer;
    if (typeof window !== "undefined") {
      window.__TAKEOFF_SPIKE_VIEWER__ = viewer;
    }
    viewer.addHandler("open", () => {
      viewer.viewport.setRotation(rotation, false);
      viewer.viewport.goHome(false);
      setOverlayTick((value) => value + 1);
      setStatus(`Tiled viewer running. ${tileStats}.`);
    });
    viewer.addHandler("tile-loaded", () => setOverlayTick((value) => value + 1));
    viewer.addHandler("animation", () => setOverlayTick((value) => value + 1));
    viewer.addHandler("animation-finish", () => setOverlayTick((value) => value + 1));
    viewer.addHandler("resize", () => setOverlayTick((value) => value + 1));
    viewer.addHandler("canvas-click", (event) => {
      if (event.quick && event.position) {
        const imagePoint = viewer.viewport.viewerElementToImageCoordinates(event.position);
        setOverlayPoints((points) => [
          ...points,
          {
            id: String(points.length + 1),
            x: Math.round(imagePoint.x),
            y: Math.round(imagePoint.y),
          },
        ]);
      }
    });

    return () => {
      viewer.destroy();
      if (viewerRef.current === viewer) {
        viewerRef.current = null;
      }
    };
  }, [OpenSeadragonLib, tilePyramid, tileStats]);

  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer?.viewport) {
      return;
    }
    viewer.viewport.setRotation(rotation, false);
    setOverlayTick((value) => value + 1);
  }, [rotation]);

  useEffect(() => {
    return () => {
      releaseTilePyramid(tilePyramidRef.current);
    };
  }, []);

  async function buildTilesFromDataUrl(dataUrl, name) {
    setError("");
    setProgress({ status: "Decoding raster image...", percent: 0 });
    setStatus("Preparing raster image...");

    try {
      const image = await loadImage(dataUrl);
      setImageInfo({ width: image.naturalWidth, height: image.naturalHeight, name });
      setOverlayPoints([
        { id: "A", x: Math.round(image.naturalWidth * 0.18), y: Math.round(image.naturalHeight * 0.18) },
        { id: "B", x: Math.round(image.naturalWidth * 0.82), y: Math.round(image.naturalHeight * 0.18) },
        { id: "C", x: Math.round(image.naturalWidth * 0.82), y: Math.round(image.naturalHeight * 0.82) },
        { id: "D", x: Math.round(image.naturalWidth * 0.18), y: Math.round(image.naturalHeight * 0.82) },
      ]);

      const nextPyramid = await generateTilePyramid(image, setProgress);
      releaseTilePyramid(tilePyramidRef.current);
      tilePyramidRef.current = nextPyramid;
      setTilePyramid(nextPyramid);
      setRotation(0);
      setProgress(null);
      setStatus(`Tile pyramid ready: ${nextPyramid.levelSummaries.length} levels, ${nextPyramid.totalTiles} tiles.`);
    } catch (tileError) {
      setProgress(null);
      setError("Tile generation failed. Try a smaller raster image or refresh the spike page.");
      setStatus(tileError.message || "Tile generation failed.");
    }
  }

  async function handleFileChange(event) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    if (!file.type.startsWith("image/")) {
      setError("This spike accepts raster image files only. Convert PDF to PNG before testing the tiled viewer.");
      event.target.value = "";
      return;
    }

    setStatus("Reading raster image...");
    setProgress({ status: "Reading raster image...", percent: 0 });
    const url = await readImageFile(file);
    await buildTilesFromDataUrl(url, file.name);
    event.target.value = "";
  }

  function fitToPage() {
    viewerRef.current?.viewport?.goHome(false);
  }

  function rotateBy(delta) {
    setRotation((value) => normaliseRotation(value + delta));
  }

  return (
    <>
      <Head>
        <title>Takeoff Viewer Spike</title>
      </Head>
      <main style={styles.page}>
        <header style={styles.header}>
          <div>
            <div style={styles.eyebrow}>Dev spike only</div>
            <h1 style={styles.title}>Tiled Takeoff Viewer Foundation Spike</h1>
            <p style={styles.subtitle}>
              Tests local OpenSeadragon tiled pan/zoom, fit-to-page, rotation, and image-coordinate overlays without touching production.
            </p>
          </div>
          <label style={{ ...styles.uploadButton, opacity: progress ? 0.55 : 1 }}>
            Upload raster image
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={handleFileChange}
              disabled={Boolean(progress)}
              style={styles.fileInput}
            />
          </label>
        </header>

        <section style={styles.toolbar}>
          <button type="button" style={styles.button} onClick={fitToPage}>Fit to page</button>
          <button type="button" style={styles.button} onClick={() => rotateBy(90)}>Rotate 90</button>
          <button type="button" style={styles.button} onClick={() => rotateBy(180)}>Rotate 180</button>
          <button type="button" style={styles.button} onClick={() => rotateBy(270)}>Rotate 270</button>
          <button type="button" style={styles.button} onClick={() => setOverlayPoints([])}>Clear points</button>
          <span style={styles.badge}>Local OSD</span>
          <span style={styles.badge}>Tile source: {tilePyramid ? TILE_SOURCE_KIND : "not ready"}</span>
          <span style={styles.meta}>{imageInfo.name} | {imageInfo.width} x {imageInfo.height}px | rotation {rotation} deg</span>
        </section>

        {error ? <section style={styles.error}>{error}</section> : null}

        <section style={styles.viewerWrap}>
          <div ref={containerRef} style={styles.viewer} />
          <div style={styles.overlayLayer} aria-hidden="true">
            {screenPoints.length >= 2 ? (
              <svg style={styles.svg}>
                <polyline
                  points={screenPoints.map((point) => `${point.screenX},${point.screenY}`).join(" ")}
                  fill="none"
                  stroke="#f97316"
                  strokeWidth="3"
                  strokeLinejoin="round"
                />
              </svg>
            ) : null}
            {screenPoints.map((point) => (
              <div key={point.id} style={{ ...styles.point, left: point.screenX, top: point.screenY }}>
                {point.id}
              </div>
            ))}
          </div>
          {progress ? (
            <div style={styles.loadingOverlay}>
              <div style={styles.loadingPanel}>
                <strong>{progress.status}</strong>
                <div style={styles.progressTrack}>
                  <div style={{ ...styles.progressBar, width: `${progress.percent || 0}%` }} />
                </div>
                <span>
                  {progress.generatedTiles != null
                    ? `${progress.generatedTiles} / ${progress.totalTiles} tiles`
                    : "Preparing tiles"}
                </span>
              </div>
            </div>
          ) : null}
          <div style={styles.status}>
            <div>{status}</div>
            <div style={styles.statusSub}>{tileStats}</div>
          </div>
        </section>

        <section style={styles.notes}>
          <strong>Spike checks:</strong> this page now creates a client-side PNG tile pyramid and passes a custom tile source
          to OpenSeadragon. Wheel zoom and drag pan are native OpenSeadragon interactions, Fit calls viewer home, and overlay
          points are stored in image pixels then projected to screen coordinates during viewer animation.
        </section>
      </main>
    </>
  );
}

const styles = {
  page: {
    height: "100vh",
    background: "#f8fafc",
    color: "#0f172a",
    padding: 18,
    fontFamily: "Inter, system-ui, sans-serif",
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
  },
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16,
    marginBottom: 12,
  },
  eyebrow: {
    color: "#0f766e",
    fontSize: 12,
    fontWeight: 900,
    textTransform: "uppercase",
  },
  title: {
    margin: "2px 0",
    fontSize: 28,
    lineHeight: 1.1,
  },
  subtitle: {
    margin: 0,
    color: "#475569",
    fontSize: 13,
  },
  uploadButton: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    background: "#0f766e",
    color: "#ffffff",
    borderRadius: 7,
    padding: "10px 13px",
    fontWeight: 900,
    cursor: "pointer",
  },
  fileInput: {
    display: "none",
  },
  toolbar: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    background: "#ffffff",
    border: "1px solid #cbd5e1",
    borderRadius: 8,
    padding: 8,
    marginBottom: 12,
    flexWrap: "wrap",
  },
  button: {
    background: "#ffffff",
    color: "#0f172a",
    border: "1px solid #cbd5e1",
    borderRadius: 6,
    padding: "8px 10px",
    fontWeight: 850,
    cursor: "pointer",
  },
  meta: {
    marginLeft: "auto",
    color: "#475569",
    fontSize: 12,
    fontWeight: 800,
  },
  badge: {
    display: "inline-flex",
    alignItems: "center",
    minHeight: 32,
    border: "1px solid #99f6e4",
    borderRadius: 6,
    background: "#f0fdfa",
    color: "#115e59",
    padding: "0 9px",
    fontSize: 12,
    fontWeight: 900,
  },
  error: {
    background: "#fef2f2",
    border: "1px solid #fecaca",
    color: "#991b1b",
    borderRadius: 8,
    padding: "10px 12px",
    marginBottom: 12,
    fontSize: 13,
    fontWeight: 850,
  },
  viewerWrap: {
    position: "relative",
    flex: "1 1 auto",
    minHeight: 360,
    background: "#0f172a",
    border: "1px solid #cbd5e1",
    overflow: "hidden",
  },
  viewer: {
    position: "absolute",
    inset: 0,
  },
  overlayLayer: {
    position: "absolute",
    inset: 0,
    pointerEvents: "none",
  },
  svg: {
    position: "absolute",
    inset: 0,
    width: "100%",
    height: "100%",
    pointerEvents: "none",
  },
  point: {
    position: "absolute",
    width: 26,
    height: 26,
    marginLeft: -13,
    marginTop: -13,
    borderRadius: 999,
    border: "2px solid #ffffff",
    background: "#2563eb",
    color: "#ffffff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 11,
    fontWeight: 900,
    boxShadow: "0 4px 12px rgba(15, 23, 42, 0.35)",
  },
  loadingOverlay: {
    position: "absolute",
    inset: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "rgba(15, 23, 42, 0.45)",
    color: "#ffffff",
  },
  loadingPanel: {
    width: 360,
    maxWidth: "calc(100% - 40px)",
    background: "rgba(15, 23, 42, 0.95)",
    border: "1px solid rgba(255, 255, 255, 0.18)",
    borderRadius: 8,
    padding: 16,
    boxShadow: "0 18px 48px rgba(0, 0, 0, 0.35)",
  },
  progressTrack: {
    height: 10,
    background: "#334155",
    borderRadius: 999,
    overflow: "hidden",
    margin: "10px 0 7px",
  },
  progressBar: {
    height: "100%",
    background: "#22c55e",
    transition: "width 120ms linear",
  },
  status: {
    position: "absolute",
    left: 12,
    bottom: 12,
    background: "rgba(15, 23, 42, 0.88)",
    color: "#ffffff",
    borderRadius: 6,
    padding: "7px 9px",
    fontSize: 12,
    fontWeight: 800,
  },
  statusSub: {
    color: "#bae6fd",
    fontSize: 11,
    marginTop: 3,
  },
  notes: {
    marginTop: 12,
    background: "#ffffff",
    border: "1px solid #cbd5e1",
    borderRadius: 8,
    padding: 12,
    color: "#334155",
    fontSize: 13,
    lineHeight: 1.45,
    flex: "0 0 auto",
  },
};
