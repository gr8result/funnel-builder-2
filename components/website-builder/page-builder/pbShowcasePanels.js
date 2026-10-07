import { styles } from "./pbStyles";
import { NumberField, ColorSelector } from "./pbPropertiesPanels";
import { parsePixelValue } from "./pbEditorUtils";
import { useState } from "react";
import { openSharedMediaPicker } from "../../../lib/openSharedMediaPicker";

export function TemplateShowcasePropertiesPanel({ block, index, onChange }) {
  const props = block?.props || {};
  const templates = Array.isArray(props.templates) ? props.templates : [];
  const stats = Array.isArray(props.stats) ? props.stats : [];
  const update = (patch) => onChange(index, { ...props, ...patch });
  const updateTemplate = (itemIndex, patch) => {
    update({
      templates: templates.map((item, currentIndex) => (
        currentIndex === itemIndex ? { ...item, ...patch } : item
      )),
    });
  };
  const updateStat = (itemIndex, patch) => {
    update({
      stats: stats.map((item, currentIndex) => (
        currentIndex === itemIndex ? { ...item, ...patch } : item
      )),
    });
  };

  return (
    <div style={styles.properties}>
      <h3 style={styles.propertiesTitle}>Edit: Template Showcase</h3>
      <div style={styles.propertyGrid}>
        <div style={styles.sectionCard}>
          <label style={styles.propertyLabel}>Eyebrow</label>
          <input type="text" value={String(props.eyebrow || "")} onChange={(e) => update({ eyebrow: e.target.value })} style={styles.propertyInput} />
          <label style={{ ...styles.propertyLabel, marginTop: 10 }}>Headline</label>
          <textarea value={String(props.headline || "")} onChange={(e) => update({ headline: e.target.value })} style={{ ...styles.propertyInput, minHeight: 76, resize: "vertical" }} />
          <label style={{ ...styles.propertyLabel, marginTop: 10 }}>Subheadline</label>
          <textarea value={String(props.subheadline || "")} onChange={(e) => update({ subheadline: e.target.value })} style={{ ...styles.propertyInput, minHeight: 92, resize: "vertical" }} />
        </div>

        <div style={styles.sectionCard}>
          <label style={styles.propertyLabel}>Primary CTA</label>
          <input type="text" value={String(props.ctaText || "")} onChange={(e) => update({ ctaText: e.target.value })} style={styles.propertyInput} placeholder="Button text" />
          <input type="text" value={String(props.ctaLink || "")} onChange={(e) => update({ ctaLink: e.target.value })} style={{ ...styles.propertyInput, marginTop: 8 }} placeholder="#contact-us" />
          <label style={{ ...styles.propertyLabel, marginTop: 10 }}>Secondary CTA</label>
          <input type="text" value={String(props.secondaryCtaText || "")} onChange={(e) => update({ secondaryCtaText: e.target.value })} style={styles.propertyInput} placeholder="Button text" />
          <input type="text" value={String(props.secondaryCtaLink || "")} onChange={(e) => update({ secondaryCtaLink: e.target.value })} style={{ ...styles.propertyInput, marginTop: 8 }} placeholder="#templates" />
        </div>

        <div style={styles.sectionCard}>
          <NumberField label="Animation Speed (s)" value={Number(props.speed || 34)} min={12} max={90} onChange={(value) => update({ speed: value })} />
          <NumberField label="Minimum Height (px)" value={parsePixelValue(props.minHeight, 720)} min={420} max={1100} onChange={(value) => update({ minHeight: `${value}px` })} />
          <label style={{ ...styles.inlineToggle, marginTop: 10 }}>
            <input type="checkbox" checked={props.reverse === true} onChange={(e) => update({ reverse: e.target.checked })} style={styles.checkboxInput} />
            Reverse scroll direction
          </label>
          <label style={{ ...styles.inlineToggle, marginTop: 8 }}>
            <input type="checkbox" checked={props.showDeviceFocus !== false} onChange={(e) => update({ showDeviceFocus: e.target.checked })} style={styles.checkboxInput} />
            Show laptop and phone focus
          </label>
        </div>

        <div style={styles.sectionCard}>
          <ColorSelector label="Background" value={props.backgroundColor || "#080b14"} fallback="#080b14" onChange={(value) => update({ backgroundColor: value })} />
          <ColorSelector label="Text" value={props.textColor || "#f8fafc"} fallback="#f8fafc" onChange={(value) => update({ textColor: value })} />
          <ColorSelector label="Muted Text" value={props.mutedTextColor || "#b8c2d8"} fallback="#b8c2d8" onChange={(value) => update({ mutedTextColor: value })} />
          <ColorSelector label="Accent" value={props.accentColor || "#24d3ee"} fallback="#24d3ee" onChange={(value) => update({ accentColor: value })} />
          <ColorSelector label="Second Accent" value={props.secondaryAccentColor || "#8b5cf6"} fallback="#8b5cf6" onChange={(value) => update({ secondaryAccentColor: value })} />
        </div>

        <div style={styles.sectionCard}>
          <label style={styles.propertyLabel}>Stats</label>
          {stats.map((stat, statIndex) => (
            <div key={`ts-stat-${statIndex}`} style={{ ...styles.linkRowCard, marginTop: 8 }}>
              <input type="text" value={String(stat.value || "")} onChange={(e) => updateStat(statIndex, { value: e.target.value })} style={styles.propertyInput} placeholder="80+" />
              <input type="text" value={String(stat.label || "")} onChange={(e) => updateStat(statIndex, { label: e.target.value })} style={{ ...styles.propertyInput, marginTop: 8 }} placeholder="industry layouts" />
            </div>
          ))}
        </div>

        <div style={styles.sectionCard}>
          <label style={styles.propertyLabel}>Template Cards</label>
          {templates.map((item, itemIndex) => (
            <div key={item.id || `ts-template-${itemIndex}`} style={{ ...styles.linkRowCard, marginTop: 8 }}>
              <div style={styles.linkRowHeader}>
                <span style={styles.linkRowTitle}>Card {itemIndex + 1}</span>
                <input type="color" value={String(item.palette || "#24d3ee")} onChange={(e) => updateTemplate(itemIndex, { palette: e.target.value })} style={{ width: 38, height: 30, border: 0, background: "transparent" }} />
              </div>
              <input type="text" value={String(item.title || "")} onChange={(e) => updateTemplate(itemIndex, { title: e.target.value })} style={styles.propertyInput} placeholder="Template name" />
              <input type="text" value={String(item.category || "")} onChange={(e) => updateTemplate(itemIndex, { category: e.target.value })} style={{ ...styles.propertyInput, marginTop: 8 }} placeholder="Category" />
              <input type="text" value={String(item.cta || "")} onChange={(e) => updateTemplate(itemIndex, { cta: e.target.value })} style={{ ...styles.propertyInput, marginTop: 8 }} placeholder="Badge / CTA" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function SideScrollAccordionPropertiesPanel({ block, index, onChange }) {
  const props = block?.props || {};
  const items = Array.isArray(props.panels) && props.panels.length ? props.panels : (Array.isArray(props.items) ? props.items : []);
  const update = (patch) => onChange(index, { ...props, ...patch });
  const updateItem = (itemIndex, patch) => {
    const nextItems = items.map((item, currentIndex) => (
      currentIndex === itemIndex ? { ...item, ...patch } : item
    ));
    update({
      panels: nextItems,
      items: nextItems.map((item, currentIndex) => ({
        ...item,
        title: item.title || item.heading || `Panel ${currentIndex + 1}`,
        heading: item.heading || item.title || `Panel ${currentIndex + 1}`,
        image: item.imageUrl || item.image || "",
        imageUrl: item.imageUrl || item.image || "",
      })),
    });
  };

  return (
    <div style={styles.properties}>
      <h3 style={styles.propertiesTitle}>Edit: Side Scroll Accordion</h3>
      <div style={styles.propertyGrid}>
        <div style={styles.sectionCard}>
          <label style={styles.propertyLabel}>Eyebrow</label>
          <input type="text" value={String(props.eyebrow || "")} onChange={(e) => update({ eyebrow: e.target.value })} style={styles.propertyInput} />
          <label style={{ ...styles.propertyLabel, marginTop: 10 }}>Title</label>
          <textarea value={String(props.title || "")} onChange={(e) => update({ title: e.target.value })} style={{ ...styles.propertyInput, minHeight: 70, resize: "vertical" }} />
          <label style={{ ...styles.propertyLabel, marginTop: 10 }}>Subtitle</label>
          <textarea value={String(props.subtitle || "")} onChange={(e) => update({ subtitle: e.target.value })} style={{ ...styles.propertyInput, minHeight: 90, resize: "vertical" }} />
        </div>
        <div style={styles.sectionCard}>
          <label style={styles.propertyLabel}>Display Mode</label>
          <select value={String(props.displayMode || "side-stack")} onChange={(e) => update({ displayMode: e.target.value })} style={styles.propertyInput}>
            <option value="side-stack">Scroll stack from right</option>
            <option value="marquee">Continuous side scroll</option>
          </select>
          {String(props.displayMode || "side-stack") === "marquee" ? (
            <>
              <NumberField label="Scroll Speed (s)" value={Number(props.speed || 42)} min={18} max={120} onChange={(value) => update({ speed: value })} />
              <NumberField label="Card Width (px)" value={Number(props.cardWidth || 410)} min={280} max={620} onChange={(value) => update({ cardWidth: value })} />
              <NumberField label="Card Height (px)" value={Number(props.cardHeight || 520)} min={380} max={760} onChange={(value) => update({ cardHeight: value })} />
            </>
          ) : (
            <>
              <NumberField label="Stack Strip Width (px)" value={Number(props.peekWidth || 78)} min={58} max={170} onChange={(value) => update({ peekWidth: value })} />
              <NumberField label="Card Radius (px)" value={Number(props.cardRadius ?? 18)} min={0} max={40} onChange={(value) => update({ cardRadius: value })} />
            </>
          )}
          {String(props.displayMode || "side-stack") === "marquee" ? (
            <label style={{ ...styles.inlineToggle, marginTop: 10 }}>
              <input type="checkbox" checked={props.autoScroll !== false} onChange={(e) => update({ autoScroll: e.target.checked })} style={styles.checkboxInput} />
              Auto-scroll right to left
            </label>
          ) : null}
        </div>
        <div style={styles.sectionCard}>
          <label style={styles.propertyLabel}>Button Text</label>
          <input type="text" value={String(props.buttonText || "")} onChange={(e) => update({ buttonText: e.target.value })} style={styles.propertyInput} placeholder="Explore More" />
          <label style={{ ...styles.propertyLabel, marginTop: 10 }}>Button URL</label>
          <input type="text" value={String(props.buttonUrl || "")} onChange={(e) => update({ buttonUrl: e.target.value })} style={styles.propertyInput} placeholder="#contact-us" />
          <label style={{ ...styles.inlineToggle, marginTop: 10 }}>
            <input type="checkbox" checked={props.showButtons === true} onChange={(e) => update({ showButtons: e.target.checked })} style={styles.checkboxInput} />
            Show panel buttons
          </label>
          <label style={{ ...styles.inlineToggle, marginTop: 10 }}>
            <input type="checkbox" checked={props.buttonFullWidth === true} onChange={(e) => update({ buttonFullWidth: e.target.checked })} style={styles.checkboxInput} />
            Full-width buttons
          </label>
        </div>
        <div style={styles.sectionCard}>
          <ColorSelector label="Background" value={props.backgroundColor || "#07111f"} fallback="#07111f" onChange={(value) => update({ backgroundColor: value })} />
          <ColorSelector label="Text" value={props.textColor || "#ffffff"} fallback="#ffffff" onChange={(value) => update({ textColor: value })} />
          <ColorSelector label="Muted Text" value={props.mutedTextColor || "#b8c2d8"} fallback="#b8c2d8" onChange={(value) => update({ mutedTextColor: value })} />
          <ColorSelector label="Accent" value={props.accentColor || "#00d5ff"} fallback="#00d5ff" onChange={(value) => update({ accentColor: value })} />
        </div>
        <div style={styles.sectionCard}>
          <label style={styles.propertyLabel}>Panels</label>
          {items.map((item, itemIndex) => (
            <div key={item.id || `ssa-${itemIndex}`} style={{ ...styles.linkRowCard, marginTop: 8 }}>
              <div style={styles.linkRowHeader}>
                <span style={styles.linkRowTitle}>Panel {itemIndex + 1}</span>
              </div>
              <input type="text" value={String(item.eyebrow || "")} onChange={(e) => updateItem(itemIndex, { eyebrow: e.target.value })} style={styles.propertyInput} placeholder="Eyebrow" />
              <input type="text" value={String(item.title || item.heading || "")} onChange={(e) => updateItem(itemIndex, { title: e.target.value, heading: e.target.value })} style={{ ...styles.propertyInput, marginTop: 8 }} placeholder="Title" />
              <textarea value={String(item.body || "")} onChange={(e) => updateItem(itemIndex, { body: e.target.value })} style={{ ...styles.propertyInput, minHeight: 92, resize: "vertical", marginTop: 8 }} placeholder="Body" />
              <input type="text" value={String(item.imageUrl || item.image || item.mediaUrl || item.src || "")} onChange={(e) => updateItem(itemIndex, { imageUrl: e.target.value, image: e.target.value })} style={{ ...styles.propertyInput, marginTop: 8 }} placeholder="Image URL" />
              <input type="text" value={(Array.isArray(item.tags) ? item.tags : []).join(", ")} onChange={(e) => updateItem(itemIndex, { tags: e.target.value.split(",").map((tag) => tag.trim()).filter(Boolean) })} style={{ ...styles.propertyInput, marginTop: 8 }} placeholder="SEO, local search, bookings" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function HoverCardsPropertiesPanel({ block, index, onChange, onUploadImage }) {
  const props = block?.props || {};
  const update = (patch) => onChange(index, { ...props, ...patch });
  const cards = Array.isArray(props.cards) ? props.cards : [];
  const [expandedCard, setExpandedCard] = useState(0);

  const updateCard = (cardIndex, patch) => {
    const nextCards = cards.map((card, i) => (i === cardIndex ? { ...card, ...patch } : card));
    update({ cards: nextCards });
  };

  const addCard = () => {
    const newId = `hc-${Date.now()}`;
    update({
      cards: [...cards, { id: newId, title: `Card ${cards.length + 1}`, description: "Add a short description here.", image: "", cardColor: "#dde3ea", hoverBackgroundColor: "", link: "#" }],
    });
    setExpandedCard(cards.length);
  };

  const removeCard = (cardIndex) => {
    if (cards.length <= 1) return;
    const nextCards = cards.filter((_, i) => i !== cardIndex);
    update({ cards: nextCards });
    setExpandedCard((prev) => Math.min(prev, nextCards.length - 1));
  };

  const openCardImagePicker = (cardIndex) => {
    openSharedMediaPicker({
      view: "generic",
      onPick: (asset) => { if (asset?.src) updateCard(cardIndex, { image: asset.src }); },
      onBlocked: () => window.open("/assets?view=generic", "_blank", "noopener,noreferrer"),
    });
  };

  // Parse overlay color for color input (hex only)
  const overlayHex = (() => {
    const raw = String(props.hoverBackgroundColor || props.overlayColor || "rgba(0,0,0,0.85)");
    const match = raw.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
    if (match) {
      return "#" + [match[1], match[2], match[3]].map((n) => parseInt(n, 10).toString(16).padStart(2, "0")).join("");
    }
    return raw.startsWith("#") ? raw.slice(0, 7) : "#000000";
  })();

  const overlayOpacity = (() => {
    const match = String(props.overlayColor || "").match(/rgba\([^,]+,[^,]+,[^,]+,\s*([\d.]+)/);
    return match ? Math.round(parseFloat(match[1]) * 100) : 85;
  })();

  const setOverlay = (hex, opacity) => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    const value = `rgba(${r},${g},${b},${(opacity / 100).toFixed(2)})`;
    update({ hoverBackgroundColor: value, overlayColor: value });
  };

  return (
    <div style={styles.properties}>
      <h3 style={styles.propertiesTitle}>🃏 Edit: Hover Cards</h3>
      <div style={styles.propertyGrid}>

        {/* Section title */}
        <div style={styles.sectionCard}>
          <label style={styles.propertyLabel}>Section Title</label>
          <input type="text" value={String(props.sectionTitle || "")} onChange={(e) => update({ sectionTitle: e.target.value })} style={styles.propertyInput} placeholder="e.g. Our Services" />
          <div style={styles.colorGrid}>
            <div>
              <label style={styles.propertyLabel}>Title Color</label>
              <input type="color" value={String(props.sectionTitleColor || "#0f172a")} onChange={(e) => update({ sectionTitleColor: e.target.value })} style={styles.colorSwatch} />
            </div>
            <NumberField label="Title Size (px)" value={Number(props.sectionTitleSize || 32)} min={14} max={72} onChange={(v) => update({ sectionTitleSize: v })} />
          </div>
        </div>

        {/* Carousel layout */}
        <div style={styles.sectionCard}>
          <label style={styles.propertyLabel}>Carousel</label>
          {/* Full-width toggle */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
            <label style={{ ...styles.propertyLabel, marginBottom: 0, flex: 1 }}>Full Page Width</label>
            <div
              onClick={() => update({ fullWidth: !props.fullWidth })}
              style={{
                width: 42, height: 24, borderRadius: 12,
                background: props.fullWidth ? "#6366f1" : "rgba(255,255,255,0.15)",
                position: "relative", cursor: "pointer", flexShrink: 0, transition: "background 0.2s",
              }}
            >
              <div style={{
                position: "absolute", top: 3, left: props.fullWidth ? 21 : 3,
                width: 18, height: 18, borderRadius: "50%", background: "#fff",
                transition: "left 0.2s", boxShadow: "0 1px 4px rgba(0,0,0,0.25)",
              }} />
            </div>
          </div>
          <div style={styles.colorGrid}>
            {!props.fullWidth ? (
              <NumberField label="Visible Cards" value={Number(props.visibleCards || 3)} min={1} max={6} onChange={(v) => update({ visibleCards: v })} />
            ) : (
              <NumberField label="Min Card Width (px)" value={Number(props.minCardWidth || 280)} min={160} max={600} onChange={(v) => update({ minCardWidth: v })} />
            )}
            <NumberField label="Card Height (px)" value={Number(props.cardHeight || 320)} min={120} max={720} onChange={(v) => update({ cardHeight: v })} />
            <NumberField label="Card Radius (px)" value={Number(props.cardRadius || 12)} min={0} max={48} onChange={(v) => update({ cardRadius: v })} />
            <NumberField label="Gap Between Cards (px)" value={Number(props.cardGap || 16)} min={0} max={64} onChange={(v) => update({ cardGap: v })} />
            <NumberField label="Card Padding (px)" value={Number(props.cardPadding || 20)} min={8} max={60} onChange={(v) => update({ cardPadding: v })} />
            <NumberField label="Loop Speed (px/sec)" value={Number(props.continuousSpeed || 45)} min={8} max={180} onChange={(v) => update({ continuousSpeed: v })} />
            {props.continuousLoop === false ? (
              <NumberField label="Auto-Play Interval (ms)" value={Number(props.autoPlayInterval || 3500)} min={1000} max={10000} onChange={(v) => update({ autoPlayInterval: v })} />
            ) : null}
          </div>
          <label style={{ ...styles.inlineToggle, marginTop: 10 }}>
            <input
              type="checkbox"
              checked={props.continuousLoop !== false}
              onChange={(event) => update({ continuousLoop: event.target.checked })}
              style={styles.checkboxInput}
            />
            Seamless continuous loop
          </label>
        </div>

        {/* Section spacing */}
        <div style={styles.sectionCard}>
          <label style={styles.propertyLabel}>Section Spacing</label>
          <div style={styles.colorGrid}>
            <NumberField label="Top Padding (px)" value={Number(props.paddingTop ?? 48)} min={0} max={200} onChange={(v) => update({ paddingTop: v })} />
            <NumberField label="Bottom Padding (px)" value={Number(props.paddingBottom ?? 48)} min={0} max={200} onChange={(v) => update({ paddingBottom: v })} />
            <NumberField label="Side Padding (px)" value={Number(props.paddingSides ?? 40)} min={0} max={120} onChange={(v) => update({ paddingSides: v })} />
            {!props.fullWidth ? (
              <NumberField label="Max Width (px)" value={Number(props.maxWidth || 1200)} min={400} max={1800} onChange={(v) => update({ maxWidth: v })} />
            ) : null}
          </div>
        </div>

        {/* Section & card background */}
        <div style={styles.sectionCard}>
          <label style={styles.propertyLabel}>Background Colors</label>
          <div style={styles.colorGrid}>
            <div>
              <label style={styles.propertyLabel}>Section BG</label>
              <input type="color" value={String(props.backgroundColor || "#f8fafc")} onChange={(e) => update({ backgroundColor: e.target.value })} style={styles.colorSwatch} />
            </div>
            <div>
              <label style={styles.propertyLabel}>Default Card BG</label>
              <input type="color" value={String(props.cardColor || "#dde3ea")} onChange={(e) => update({ cardColor: e.target.value })} style={styles.colorSwatch} />
            </div>
          </div>
        </div>

        {/* Back card face color */}
        <div style={styles.sectionCard}>
          <label style={styles.propertyLabel}>Hover (Back Face)</label>
          <div style={styles.colorGrid}>
            <div>
              <label style={styles.propertyLabel}>Hover Card BG</label>
              <input type="color" value={overlayHex} onChange={(e) => setOverlay(e.target.value, overlayOpacity)} style={styles.colorSwatch} />
            </div>
            <NumberField label="Opacity (%)" value={overlayOpacity} min={10} max={100} onChange={(v) => setOverlay(overlayHex, v)} />
            <NumberField label="Title Size (px)" value={Number(props.backTitleSize || 20)} min={10} max={64} onChange={(v) => update({ backTitleSize: v })} />
            <NumberField label="Description Size (px)" value={Number(props.backDescSize || 15)} min={8} max={48} onChange={(v) => update({ backDescSize: v })} />
          </div>
        </div>

        {/* Button */}
        <div style={styles.sectionCard}>
          <label style={styles.propertyLabel}>Learn More Button</label>
          <label style={styles.propertyLabel}>Button Text</label>
          <input type="text" value={String(props.buttonText || "Learn more →")} onChange={(e) => update({ buttonText: e.target.value })} style={styles.propertyInput} />
          <div style={styles.colorGrid}>
            <div>
              <label style={styles.propertyLabel}>Button BG</label>
              <input type="color" value={String(props.buttonColor || "#ffffff")} onChange={(e) => update({ buttonColor: e.target.value })} style={styles.colorSwatch} />
            </div>
            <div>
              <label style={styles.propertyLabel}>Button Text</label>
              <input type="color" value={String(props.buttonTextColor || "#0f172a")} onChange={(e) => update({ buttonTextColor: e.target.value })} style={styles.colorSwatch} />
            </div>
          </div>
        </div>

        {/* Arrow buttons */}
        <div style={styles.sectionCard}>
          <label style={styles.propertyLabel}>Arrow Buttons</label>
          <div style={styles.colorGrid}>
            <div>
              <label style={styles.propertyLabel}>Arrow BG</label>
              <input type="color" value={String(props.arrowBg || "#ffffff")} onChange={(e) => update({ arrowBg: e.target.value })} style={styles.colorSwatch} />
            </div>
            <div>
              <label style={styles.propertyLabel}>Arrow Color</label>
              <input type="color" value={String(props.arrowColor || "#0f172a")} onChange={(e) => update({ arrowColor: e.target.value })} style={styles.colorSwatch} />
            </div>
          </div>
        </div>

        {/* Cards list */}
        <div style={styles.sectionCard}>
          <label style={styles.propertyLabel}>Cards ({cards.length})</label>
          <div style={{ display: "grid", gap: 8 }}>
            {cards.map((card, cardIndex) => {
              const isOpen = expandedCard === cardIndex;
              return (
                <div key={card.id || cardIndex} style={{ border: "1px solid rgba(255,255,255,0.12)", borderRadius: 10, overflow: "hidden" }}>
                  <div
                    style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", background: "rgba(255,255,255,0.05)", cursor: "pointer" }}
                    onClick={() => setExpandedCard(isOpen ? -1 : cardIndex)}
                  >
                    <span style={{ flex: 1, fontSize: 16, fontWeight: 600, color: "#e2e8f0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {card.title || `Card ${cardIndex + 1}`}
                    </span>
                    {cards.length > 1 ? (
                      <button type="button" style={{ ...styles.linkMoveBtn, color: "#f87171", fontSize: 16 }} onClick={(e) => { e.stopPropagation(); removeCard(cardIndex); }} title="Remove">✕</button>
                    ) : null}
                    <span style={{ color: "#94a3b8", fontSize: 16 }}>{isOpen ? "▲" : "▼"}</span>
                  </div>
                  {isOpen ? (
                    <div style={{ padding: "10px 10px 14px", display: "grid", gap: 8 }}>
                      <div>
                        <label style={styles.propertyLabel}>Title</label>
                        <input type="text" value={String(card.title || "")} onChange={(e) => updateCard(cardIndex, { title: e.target.value })} style={styles.propertyInput} placeholder="Card title" />
                      </div>
                      <div>
                        <label style={styles.propertyLabel}>Description (shown on hover)</label>
                        <textarea value={String(card.description || "")} onChange={(e) => updateCard(cardIndex, { description: e.target.value })} style={{ ...styles.propertyInput, height: 68, resize: "vertical" }} placeholder="Short description..." />
                      </div>
                      <div>
                        <label style={styles.propertyLabel}>Link URL</label>
                        <input type="text" value={String(card.link || "")} onChange={(e) => updateCard(cardIndex, { link: e.target.value })} style={styles.propertyInput} placeholder="https://..." />
                      </div>
                      <div>
                        <label style={styles.propertyLabel}>Card Background Color</label>
                        <input type="color" value={String(card.cardColor || props.cardColor || "#dde3ea")} onChange={(e) => updateCard(cardIndex, { cardColor: e.target.value })} style={styles.colorSwatch} />
                      </div>
                      <div>
                        <label style={styles.propertyLabel}>Hover Background Color</label>
                        <input type="color" value={String(card.hoverBackgroundColor || overlayHex).startsWith("#") ? String(card.hoverBackgroundColor || overlayHex).slice(0, 7) : overlayHex} onChange={(e) => updateCard(cardIndex, { hoverBackgroundColor: e.target.value })} style={styles.colorSwatch} />
                      </div>
                      <div>
                        <label style={styles.propertyLabel}>Card Image</label>
                        {card.image ? (
                          <img src={card.image} alt="" style={{ width: "100%", height: 90, objectFit: "cover", borderRadius: 8, marginBottom: 6, display: "block" }} />
                        ) : null}
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                          <button type="button" style={styles.secondaryBtn} onClick={() => openCardImagePicker(cardIndex)}>🖼 Library</button>
                          <label style={{ ...styles.secondaryBtn, cursor: "pointer", display: "inline-flex", alignItems: "center" }}>
                            📁 Upload
                            <input type="file" accept="image/*" style={{ display: "none" }} onChange={async (e) => {
                              const file = e.target.files?.[0];
                              e.target.value = "";
                              if (!file) return;
                              const asset = await Promise.resolve(onUploadImage?.(index, `__hc_card_${cardIndex}__`, file));
                              if (asset?.src) updateCard(cardIndex, { image: asset.src });
                            }} />
                          </label>
                          {card.image ? (
                            <button type="button" style={{ ...styles.secondaryBtn, color: "#f87171" }} onClick={() => updateCard(cardIndex, { image: "" })}>Remove</button>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
          <button type="button" style={{ ...styles.secondaryBtn, marginTop: 10, width: "100%" }} onClick={addCard}>+ Add Card</button>
        </div>

      </div>
    </div>
  );
}

export function FramerPortfolioPropertiesPanel({ block, index, onChange, onUploadImage }) {
  const props = block?.props || {};
  const cards = Array.isArray(props.cards) ? props.cards : [];
  const [expandedCard, setExpandedCard] = useState(0);
  const update = (patch) => onChange(index, { ...props, ...patch });

  const updateCard = (cardIndex, patch) => {
    update({
      cards: cards.map((card, currentIndex) => (
        currentIndex === cardIndex ? { ...card, ...patch } : card
      )),
    });
  };

  const addCard = () => {
    const nextIndex = cards.length + 1;
    update({
      cards: [
        ...cards,
        {
          id: `fp-${Date.now()}`,
          title: `Project ${nextIndex}`,
          desc: "Add a short project summary.",
          image: "",
          link: "#",
        },
      ],
    });
    setExpandedCard(cards.length);
  };

  const removeCard = (cardIndex) => {
    if (cards.length <= 1) return;
    const nextCards = cards.filter((_, currentIndex) => currentIndex !== cardIndex);
    update({ cards: nextCards });
    setExpandedCard((current) => Math.min(current, Math.max(0, nextCards.length - 1)));
  };

  const moveCard = (cardIndex, direction) => {
    const nextIndex = cardIndex + direction;
    if (nextIndex < 0 || nextIndex >= cards.length) return;
    const nextCards = [...cards];
    const [moved] = nextCards.splice(cardIndex, 1);
    nextCards.splice(nextIndex, 0, moved);
    update({ cards: nextCards });
    setExpandedCard(nextIndex);
  };

  const openCardImagePicker = (cardIndex) => {
    openSharedMediaPicker({
      view: "generic",
      onPick: (asset) => {
        if (!asset?.src) return;
        updateCard(cardIndex, { image: asset.src, imageAssetId: asset.id || "" });
      },
      onBlocked: () => window.open("/assets?view=generic", "_blank", "noopener,noreferrer"),
    });
  };

  const uploadCardImage = async (cardIndex, file) => {
    if (!file) return;
    const asset = await Promise.resolve(onUploadImage?.(index, `__fp_card_${cardIndex}__`, file));
    if (asset?.src) updateCard(cardIndex, { image: asset.src, imageAssetId: asset.id || "" });
  };

  return (
    <div style={styles.properties}>
      <h3 style={styles.propertiesTitle}>🎨 Edit: Framer Portfolio</h3>
      <div style={styles.propertyGrid}>
        <div style={styles.sectionCard}>
          <label style={styles.propertyLabel}>Section Text</label>
          <input type="text" value={String(props.title || "")} onChange={(event) => update({ title: event.target.value })} style={styles.propertyInput} placeholder="Selected Projects" />
          <textarea value={String(props.subtitle || "")} onChange={(event) => update({ subtitle: event.target.value })} style={{ ...styles.propertyInput, minHeight: 72, resize: "vertical", marginTop: 8 }} placeholder="A collection of recent work" />
        </div>

        <div style={styles.sectionCard}>
          <label style={styles.propertyLabel}>Layout</label>
          <div style={styles.colorGrid}>
            <NumberField label="Visible Cards" value={Number(props.visibleCount || 2.5)} min={1} max={6} onChange={(value) => update({ visibleCount: value })} />
            <NumberField label="Card Height (px)" value={Number(props.cardHeight || 520)} min={180} max={900} onChange={(value) => update({ cardHeight: value })} />
            <NumberField label="Card Radius (px)" value={Number(props.cardRadius || 12)} min={0} max={48} onChange={(value) => update({ cardRadius: value })} />
          </div>
        </div>

        <div style={styles.sectionCard}>
          <label style={styles.propertyLabel}>Scroll Behaviour</label>
          <label style={{ ...styles.inlineToggle, marginTop: 8 }}>
            <input
              type="checkbox"
              checked={!!props.autoScroll}
              onChange={(event) => update({ autoScroll: event.target.checked })}
              style={styles.checkboxInput}
            />
            Auto-scroll cards
          </label>
          <label style={{ ...styles.propertyLabel, marginTop: 10 }}>Scroll Mode</label>
          <select value={String(props.scrollMode || "card")} onChange={(event) => update({ scrollMode: event.target.value })} style={styles.propertyInput}>
            <option value="card">One card at a time</option>
            <option value="continuous">Continuous scroll</option>
          </select>
          <label style={{ ...styles.inlineToggle, marginTop: 8 }}>
            <input
              type="checkbox"
              checked={props.loopScroll !== false}
              onChange={(event) => update({ loopScroll: event.target.checked })}
              style={styles.checkboxInput}
            />
            Continuous loop
          </label>
          <label style={{ ...styles.inlineToggle, marginTop: 8 }}>
            <input
              type="checkbox"
              checked={props.pauseOnHover !== false}
              onChange={(event) => update({ pauseOnHover: event.target.checked })}
              style={styles.checkboxInput}
            />
            Pause on hover
          </label>
          {String(props.scrollMode || "card") === "continuous" ? (
            <NumberField label="Continuous Speed (px/sec)" value={Number(props.continuousScrollSpeed || 45)} min={5} max={240} onChange={(value) => update({ continuousScrollSpeed: value })} />
          ) : (
            <NumberField label="Card Interval (ms)" value={Number(props.cardScrollInterval || 2500)} min={700} max={10000} onChange={(value) => update({ cardScrollInterval: value })} />
          )}
        </div>

        <div style={styles.sectionCard}>
          <label style={styles.propertyLabel}>Colours</label>
          <div style={styles.colorGrid}>
            <div>
              <label style={styles.propertyLabel}>Background</label>
              <input type="color" value={String(props.backgroundColor || "#0a0a0a")} onChange={(event) => update({ backgroundColor: event.target.value })} style={styles.colorSwatch} />
            </div>
            <div>
              <label style={styles.propertyLabel}>Text</label>
              <input type="color" value={String(props.textColor || "#ffffff")} onChange={(event) => update({ textColor: event.target.value })} style={styles.colorSwatch} />
            </div>
            <div>
              <label style={styles.propertyLabel}>Accent</label>
              <input type="color" value={String(props.accentColor || "#a78bfa")} onChange={(event) => update({ accentColor: event.target.value })} style={styles.colorSwatch} />
            </div>
          </div>
        </div>

        <div style={styles.sectionCard}>
          <label style={styles.propertyLabel}>Cards ({cards.length})</label>
          <div style={{ display: "grid", gap: 8 }}>
            {cards.map((card, cardIndex) => {
              const isOpen = expandedCard === cardIndex;
              return (
                <div key={card.id || cardIndex} style={{ border: "1px solid rgba(255,255,255,0.12)", borderRadius: 10, overflow: "hidden" }}>
                  <div
                    style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", background: "rgba(255,255,255,0.05)", cursor: "pointer" }}
                    onClick={() => setExpandedCard(isOpen ? -1 : cardIndex)}
                  >
                    <span style={{ flex: 1, fontSize: 16, fontWeight: 600, color: "#e2e8f0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {card.title || `Project ${cardIndex + 1}`}
                    </span>
                    <button type="button" style={styles.linkMoveBtn} disabled={cardIndex === 0} onClick={(event) => { event.stopPropagation(); moveCard(cardIndex, -1); }} title="Move up">↑</button>
                    <button type="button" style={styles.linkMoveBtn} disabled={cardIndex === cards.length - 1} onClick={(event) => { event.stopPropagation(); moveCard(cardIndex, 1); }} title="Move down">↓</button>
                    {cards.length > 1 ? (
                      <button type="button" style={{ ...styles.linkMoveBtn, color: "#f87171" }} onClick={(event) => { event.stopPropagation(); removeCard(cardIndex); }} title="Remove">×</button>
                    ) : null}
                    <span style={{ color: "#94a3b8", fontSize: 16 }}>{isOpen ? "▲" : "▼"}</span>
                  </div>
                  {isOpen ? (
                    <div style={{ padding: "10px 10px 14px", display: "grid", gap: 8 }}>
                      <div>
                        <label style={styles.propertyLabel}>Title</label>
                        <input type="text" value={String(card.title || "")} onChange={(event) => updateCard(cardIndex, { title: event.target.value })} style={styles.propertyInput} placeholder="Project title" />
                      </div>
                      <div>
                        <label style={styles.propertyLabel}>Description</label>
                        <textarea value={String(card.desc || card.description || "")} onChange={(event) => updateCard(cardIndex, { desc: event.target.value })} style={{ ...styles.propertyInput, minHeight: 78, resize: "vertical" }} placeholder="Short project summary..." />
                      </div>
                      <div>
                        <label style={styles.propertyLabel}>Link URL</label>
                        <input type="text" value={String(card.link || "")} onChange={(event) => updateCard(cardIndex, { link: event.target.value })} style={styles.propertyInput} placeholder="https://..." />
                      </div>
                      <div>
                        <label style={styles.propertyLabel}>Image</label>
                        {card.image ? (
                          <img src={card.image} alt="" style={{ width: "100%", height: 110, objectFit: "cover", borderRadius: 8, marginBottom: 6, display: "block" }} />
                        ) : null}
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                          <button type="button" style={styles.secondaryBtn} onClick={() => openCardImagePicker(cardIndex)}>Library</button>
                          <label style={{ ...styles.secondaryBtn, cursor: "pointer", display: "inline-flex", alignItems: "center" }}>
                            Upload
                            <input type="file" accept="image/*" style={{ display: "none" }} onChange={(event) => {
                              const file = event.target.files?.[0];
                              event.target.value = "";
                              uploadCardImage(cardIndex, file);
                            }} />
                          </label>
                          {card.image ? (
                            <button type="button" style={{ ...styles.secondaryBtn, color: "#f87171" }} onClick={() => updateCard(cardIndex, { image: "", imageAssetId: "" })}>Remove</button>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
          <button type="button" style={{ ...styles.secondaryBtn, marginTop: 10, width: "100%" }} onClick={addCard}>+ Add Project Card</button>
        </div>
      </div>
    </div>
  );
}
