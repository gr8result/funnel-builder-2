import { useEffect, useRef, useState } from "react";
import { garageDoorProfileImage, garageDoorRangeImage } from "../../lib/builders/clientSelectionWorkflow.js";
import { supabase } from "../../lib/supabaseClient.js";

const previewCache = new Map();

async function previewHeaders() {
  const { data } = await supabase.auth.getSession();
  const token = data?.session?.access_token;
  return { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

export default function GarageDoorReviewPreview({ product, profile = "", colour, openingWidth = "", openingHeight = "" }) {
  const entity = product?.metadata?.productEntity || product || {};
  const productId = entity.productId || product?.productId || product?.id || entity.productCode || "";
  const colourId = colour?.colourId || "";
  const recipeKey = JSON.stringify([productId, profile, colourId, openingWidth, openingHeight]);
  const referenceImage = garageDoorProfileImage(profile, product) || garageDoorRangeImage(product);
  const [result, setResult] = useState(null);
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState("");
  const [availability, setAvailability] = useState(null);
  const [showReference, setShowReference] = useState(false);
  const requestRef = useRef(null);
  const currentRecipeRef = useRef(recipeKey);
  currentRecipeRef.current = recipeKey;

  useEffect(() => {
    requestRef.current?.abort();
    setResult(previewCache.get(recipeKey) || null);
    setStatus("idle");
    setError("");
    setShowReference(false);
    return () => requestRef.current?.abort();
  }, [recipeKey]);

  useEffect(() => {
    const controller = new AbortController();
    (async () => {
      try {
        const headers = await previewHeaders();
        if (controller.signal.aborted) return;
        const response = await fetch("/api/product-library/garage-door-preview", { headers, signal: controller.signal });
        const data = await response.json();
        if (!controller.signal.aborted && response.ok && data.ok) setAvailability(data);
      } catch {
        // A status check failure leaves the explicit Generate action available.
      }
    })();
    return () => controller.abort();
  }, []);

  async function generatePreview() {
    if (status === "loading") return;
    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;
    const requestedRecipe = recipeKey;
    setStatus("loading");
    setError("");
    const timeout = setTimeout(() => controller.abort(), 165000);
    try {
      const headers = await previewHeaders();
      if (controller.signal.aborted) return;
      const response = await fetch("/api/product-library/garage-door-preview", {
        method: "POST",
        headers,
        signal: controller.signal,
        body: JSON.stringify({ productId, profile, colourId, openingWidth, openingHeight }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.ok || !/^data:image\/(?:png|webp|jpeg);base64,/.test(data.imageUrl || "")) {
        throw new Error(data.error || "The colour preview could not be generated. Please try again.");
      }
      if (currentRecipeRef.current !== requestedRecipe || controller.signal.aborted) return;
      const next = { recipeKey: requestedRecipe, imageUrl: data.imageUrl };
      previewCache.set(requestedRecipe, next);
      while (previewCache.size > 8) previewCache.delete(previewCache.keys().next().value);
      setResult(next);
      setShowReference(false);
      setStatus("ready");
    } catch (cause) {
      if (currentRecipeRef.current !== requestedRecipe || requestRef.current !== controller) return;
      setError(cause?.name === "AbortError" ? "This preview took too long. Please try again." : cause.message);
      setStatus("error");
    } finally {
      clearTimeout(timeout);
    }
  }

  const generatedImage = result?.recipeKey === recipeKey ? result.imageUrl : "";
  const imageUrl = generatedImage && !showReference ? generatedImage : referenceImage;
  const unavailable = availability?.available === false;
  const canGenerate = Boolean(productId && profile && colourId && referenceImage);

  return (
    <section data-testid="garage-door-review-preview" className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
        <div>
          <h3 className="text-lg font-bold text-slate-900">Your door in your chosen colour</h3>
          <p className="mt-1 text-sm text-slate-600">{profile}{colour?.officialName ? ` · ${colour.officialName}` : ""}</p>
        </div>
        {colour?.swatchValue && (
          <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700">
            <span aria-hidden="true" className="h-6 w-6 rounded-full border border-slate-300" style={{ background: colour.swatchValue }} />
            {colour.officialName}
          </div>
        )}
      </div>
      <div className="relative flex min-h-[260px] items-center justify-center bg-slate-50 p-3 sm:min-h-[360px] sm:p-5" aria-busy={status === "loading"}>
        {imageUrl ? (
          <img data-testid="garage-door-preview-image" src={imageUrl} alt={generatedImage && !showReference ? `AI colour preview of ${profile} in ${colour?.officialName}` : `${profile} supplier reference; original colour shown`} className="max-h-[540px] w-full object-contain" />
        ) : <p className="text-sm text-slate-500">Choose a door profile to see its supplier image.</p>}
        <span className="absolute left-5 top-4 rounded-full bg-white/95 px-3 py-1 text-xs font-semibold text-slate-700 shadow-sm">
          {generatedImage && !showReference ? "AI colour preview" : "Supplier reference · original colour"}
        </span>
        {status === "loading" && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/80 p-6" role="status">
            <div className="rounded-xl border border-slate-200 bg-white px-6 py-4 text-center shadow-sm">
              <div className="mx-auto mb-3 h-7 w-7 animate-spin rounded-full border-[3px] border-slate-200 border-t-teal-700" />
              <p className="font-semibold text-slate-900">Creating your colour preview…</p>
              <p className="mt-1 text-sm text-slate-600">This can take a couple of minutes.</p>
            </div>
          </div>
        )}
      </div>
      <div className="space-y-3 px-5 py-4">
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" data-testid="garage-door-generate-preview" onClick={generatePreview} disabled={!canGenerate || status === "loading" || unavailable} className="rounded-lg bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-50">
            {status === "loading" ? "Creating preview…" : status === "error" ? "Try again" : generatedImage ? "Refresh colour preview" : "Generate colour preview"}
          </button>
          {generatedImage && <button type="button" className="text-sm font-semibold text-slate-700 underline underline-offset-4" onClick={() => setShowReference((value) => !value)}>{showReference ? "Show colour preview" : "Compare with supplier image"}</button>}
        </div>
        {unavailable && <p role="status" className="text-sm text-slate-600">{availability.message || "AI colour previews are not connected yet. You can still save your selection."}</p>}
        {error && <p data-testid="garage-door-preview-error" role="alert" className="text-sm text-red-700">{error}</p>}
        <p className="text-xs leading-5 text-slate-500">AI previews are indicative and may vary in profile detail or colour. Confirm your chosen profile and finish against the supplier’s physical samples before ordering. Your opening measurements remain in the selection summary.</p>
      </div>
    </section>
  );
}
