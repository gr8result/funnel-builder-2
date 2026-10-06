import { normalizeContactFields, htmlToPlainText, createContactField, resolveContactBookingUrl, CONTACT_FORM_STYLE_TEMPLATES, CONTACT_FORM_TEMPLATES, DEFAULT_ENQUIRY_BOOKING_URL } from "./pbEditorUtils";
import { styles } from "./pbStyles";
import { NumberField, CompactColorField } from "./pbPropertiesPanels";
import { applyAssetToProps } from "../../../lib/website-builder/mediaAssets";

export function ContactFormPropertiesPanel({ block, index, onChange, brandAssets, onUploadImage, onSelectAsset }) {
  const props = block?.props || {};
  const fields = normalizeContactFields(props.fields);
  const update = (patch) => onChange(index, { ...props, ...patch });
  const savedImages = [brandAssets?.logo, ...(Array.isArray(brandAssets?.images) ? brandAssets.images : [])].filter(Boolean).slice(0, 8);

  const updateField = (fieldIndex, patch) => {
    const nextFields = fields.map((field, currentIndex) => (
      currentIndex === fieldIndex
        ? {
            ...field,
            ...patch,
            label: Object.prototype.hasOwnProperty.call(patch, "label") ? htmlToPlainText(patch.label) : field.label,
            name: Object.prototype.hasOwnProperty.call(patch, "name") ? String(patch.name || "") : field.name,
            placeholder: Object.prototype.hasOwnProperty.call(patch, "placeholder") ? htmlToPlainText(patch.placeholder) : field.placeholder,
          }
        : field
    ));
    update({ fields: nextFields });
  };

  const removeField = (fieldIndex) => {
    update({ fields: fields.filter((_, currentIndex) => currentIndex !== fieldIndex) });
  };

  const moveField = (fieldIndex, direction) => {
    const targetIndex = fieldIndex + direction;
    if (targetIndex < 0 || targetIndex >= fields.length) return;
    const nextFields = [...fields];
    const [movedField] = nextFields.splice(fieldIndex, 1);
    nextFields.splice(targetIndex, 0, movedField);
    update({ fields: nextFields });
  };

  const addField = () => {
    update({
      fields: [...fields, createContactField(fields.length, { label: `Field ${fields.length + 1}`, type: "text", required: false, placeholder: "" })],
    });
  };

  const applyTemplate = (template) => {
    onChange(index, {
      ...props,
      title: template.title,
      subtitle: template.subtitle,
      submitText: template.submitText,
      submitAction: template.submitAction || props.submitAction || "none",
      bookingUrl: resolveContactBookingUrl(template.bookingUrl || props.bookingUrl || ""),
      fields: normalizeContactFields(template.fields),
    });
  };

  const applyStyleTemplate = (template) => {
    onChange(index, { ...props, ...template.patch });
  };

  return (
    <div style={styles.properties}>
      <h3 style={styles.propertiesTitle}>✉️ Edit: Contact Form</h3>
      <p style={{ margin: "0 0 12px 16px", color: "#64748b", fontSize: 16 }}>Click title, subtitle, field labels and the button directly on the page to edit text.</p>
      <div style={styles.propertyGrid}>
        <div style={styles.sectionCard}>
          <label style={styles.propertyLabel}>Style</label>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 6 }}>
            {CONTACT_FORM_STYLE_TEMPLATES.map((template) => {
              const active = String(props.formVariant || "minimal-soft") === template.id;
              return (
                <button
                  key={template.id}
                  type="button"
                  onClick={() => applyStyleTemplate(template)}
                  style={{
                    ...styles.secondaryBtn,
                    justifyContent: "center",
                    background: active ? "#2563eb" : undefined,
                    color: active ? "#ffffff" : undefined,
                    border: active ? "1px solid #2563eb" : undefined,
                    fontWeight: active ? 600 : undefined,
                  }}
                >{template.label}</button>
              );
            })}
          </div>
        </div>
        <div style={styles.sectionCard}>
          <label style={styles.propertyLabel}>Form Type</label>
          <div style={styles.presetGrid}>
            {CONTACT_FORM_TEMPLATES.map((template) => (
              <button key={template.id} type="button" style={styles.presetChip} onClick={() => applyTemplate(template)}>
                {template.label}
              </button>
            ))}
          </div>
        </div>
        <div style={styles.sectionCard}>
          <label style={styles.propertyLabel}>Layout</label>
          <NumberField label="Form Width" value={Number(props.formMaxWidth || 760)} min={360} max={1200} onChange={(value) => update({ formMaxWidth: value })} />
          <div style={{ marginTop: 8 }}>
            <label style={styles.propertyLabel}>Submit Action</label>
            <select value={String(props.submitAction || "none")} onChange={(e) => update({ submitAction: e.target.value })} style={styles.propertyInput}>
              <option value="none">Preview Only</option>
              <option value="calendar-booking">Open Calendar Booking</option>
              <option value="send-email">Send Email</option>
            </select>
          </div>
          {String(props.submitAction || "none") === "calendar-booking" ? (
            <>
              <label style={{ ...styles.propertyLabel, marginTop: 8 }}>Booking URL</label>
              <input type="text" value={resolveContactBookingUrl(props.bookingUrl || "")} onChange={(e) => update({ bookingUrl: e.target.value })} style={styles.propertyInput} placeholder={DEFAULT_ENQUIRY_BOOKING_URL} />
              <p style={styles.aiHint}>Your public calendar booking page, e.g. `/u/your-username`.</p>
            </>
          ) : null}
          {String(props.submitAction || "none") === "send-email" ? (
            <>
              <label style={{ ...styles.propertyLabel, marginTop: 8 }}>To Email</label>
              <input type="email" value={String(props.toEmail || "")} onChange={(e) => update({ toEmail: e.target.value })} style={styles.propertyInput} placeholder="you@business.com" />
              <label style={{ ...styles.propertyLabel, marginTop: 8 }}>Email Subject</label>
              <input type="text" value={String(props.emailSubject || "")} onChange={(e) => update({ emailSubject: e.target.value })} style={styles.propertyInput} placeholder="New website enquiry" />
              <label style={{ ...styles.propertyLabel, marginTop: 8 }}>Success Message</label>
              <input type="text" value={String(props.successMessage || "")} onChange={(e) => update({ successMessage: e.target.value })} style={styles.propertyInput} placeholder="Thanks - your enquiry has been sent." />
              <label style={{ ...styles.propertyLabel, marginTop: 8, display: "flex", alignItems: "center", gap: 6 }}>
                <input type="checkbox" checked={props.autoReplyEnabled === true} onChange={(e) => update({ autoReplyEnabled: e.target.checked })} />
                Send an auto-reply to the submitter
              </label>
              {props.autoReplyEnabled === true ? (
                <>
                  <label style={{ ...styles.propertyLabel, marginTop: 8 }}>Auto Reply Subject</label>
                  <input type="text" value={String(props.autoReplySubject || "")} onChange={(e) => update({ autoReplySubject: e.target.value })} style={styles.propertyInput} placeholder="We received your enquiry" />
                  <label style={{ ...styles.propertyLabel, marginTop: 8 }}>Auto Reply Message</label>
                  <textarea value={String(props.autoReplyMessage || "")} onChange={(e) => update({ autoReplyMessage: e.target.value })} style={{ ...styles.propertyInput, minHeight: 80 }} placeholder="Thanks for reaching out - we've received your enquiry and will be in touch shortly." />
                </>
              ) : null}
              <p style={styles.aiHint}>Submissions are emailed directly to the address above. The auto-reply only sends if a form field has an email input.</p>
            </>
          ) : null}
          <div style={{ marginTop: 8 }}>
            <label style={styles.propertyLabel}>Image Position</label>
            <select value={String(props.mediaPosition || "none")} onChange={(e) => update({ mediaPosition: e.target.value })} style={styles.propertyInput}>
              {[
                { value: "none", label: "No Image" },
                { value: "top", label: "Top" },
                { value: "left", label: "Left Side" },
                { value: "right", label: "Right Side" },
              ].map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </div>
        </div>
        {String(props.mediaPosition || "none") !== "none" ? (
          <div style={styles.sectionCard}>
            <label style={styles.propertyLabel}>Form Image</label>
            <div style={styles.assetPicker}>
              <label style={styles.assetUploadCta}>
                Upload Image
                <input
                  type="file"
                  accept="image/*"
                  style={styles.hiddenInput}
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    event.target.value = "";
                    if (!file) return;
                    onUploadImage(index, "mediaImage", file);
                  }}
                />
              </label>
              {props.mediaImage ? (
                <button type="button" style={{ ...styles.assetChip, background: "rgba(239,68,68,0.14)", borderColor: "rgba(239,68,68,0.35)", color: "#fecaca" }} onClick={() => update({ mediaImage: "" })}>
                  Remove
                </button>
              ) : null}
              {savedImages.map((image) => (
                <button
                  key={`contact-media-${image.id}`}
                  type="button"
                  style={styles.assetThumbBtn}
                  onClick={() => {
                    const nextProps = applyAssetToProps(props || {}, "mediaImage", image);
                    onChange(index, { ...nextProps, mediaImage: image.src || "" });
                    onSelectAsset(index, "mediaImage", image);
                  }}
                  title={image.name}
                >
                  <img src={image.src} alt={image.name} style={styles.assetThumbPreview} />
                </button>
              ))}
            </div>
          </div>
        ) : null}
        <div style={styles.sectionCard}>
          <label style={styles.propertyLabel}>Colours</label>
          <div style={styles.colorGrid}>
            <CompactColorField label="Section BG" value={props.backgroundColor || "#ffffff"} fallback="#ffffff" onChange={(value) => update({ backgroundColor: value })} />
            <CompactColorField label="Card BG" value={props.cardBackgroundColor || "#ffffff"} fallback="#ffffff" onChange={(value) => update({ cardBackgroundColor: value })} />
            <CompactColorField label="Text" value={props.textColor || "#0f172a"} fallback="#0f172a" onChange={(value) => update({ textColor: value })} />
            <CompactColorField label="Muted Text" value={props.subtleTextColor || "#475569"} fallback="#475569" onChange={(value) => update({ subtleTextColor: value })} />
            <CompactColorField label="Button BG" value={props.buttonBackgroundColor || "#0f172a"} fallback="#0f172a" onChange={(value) => update({ buttonBackgroundColor: value })} />
            <CompactColorField label="Button Text" value={props.buttonTextColor || "#ffffff"} fallback="#ffffff" onChange={(value) => update({ buttonTextColor: value })} />
            <CompactColorField label="Input BG" value={props.inputBackgroundColor || "#ffffff"} fallback="#ffffff" onChange={(value) => update({ inputBackgroundColor: value })} />
            <CompactColorField label="Input Border" value={props.inputBorderColor || "#cbd5e1"} fallback="#cbd5e1" onChange={(value) => update({ inputBorderColor: value })} />
            <CompactColorField label="Input Text" value={props.inputTextColor || "#0f172a"} fallback="#0f172a" onChange={(value) => update({ inputTextColor: value })} />
          </div>
        </div>
        <div style={styles.sectionCard}>
          <label style={styles.propertyLabel}>Fields</label>
          <div style={styles.propertyGrid}>
            {fields.map((field, fieldIndex) => (
              <div key={`${field.name}-${fieldIndex}`} style={styles.linkRowCard}>
                <div style={styles.linkRowHeader}>
                  <span style={styles.linkRowTitle}>{field.label || `Field ${fieldIndex + 1}`}</span>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                    <button
                      type="button"
                      style={styles.secondaryBtn}
                      disabled={fieldIndex === 0}
                      aria-label={`Move field ${fieldIndex + 1} up`}
                      title="Move field up"
                      onClick={() => moveField(fieldIndex, -1)}
                    >Up</button>
                    <button
                      type="button"
                      style={styles.secondaryBtn}
                      disabled={fieldIndex === fields.length - 1}
                      aria-label={`Move field ${fieldIndex + 1} down`}
                      title="Move field down"
                      onClick={() => moveField(fieldIndex, 1)}
                    >Down</button>
                    <button type="button" style={styles.iconDeleteBtn} aria-label={`Delete field ${fieldIndex + 1}`} title="Delete field" onClick={() => removeField(fieldIndex)}>×</button>
                  </div>
                </div>
                <input type="text" value={String(field.label || "")} onChange={(e) => updateField(fieldIndex, { label: e.target.value })} style={styles.propertyInput} placeholder="Field label" />
                <input type="text" value={String(field.name || "")} onChange={(e) => updateField(fieldIndex, { name: e.target.value.replace(/[^a-zA-Z0-9-_]/g, "-") })} style={{ ...styles.propertyInput, marginTop: 8 }} placeholder="field-name" />
                <input type="text" value={String(field.placeholder || "")} onChange={(e) => updateField(fieldIndex, { placeholder: e.target.value })} style={{ ...styles.propertyInput, marginTop: 8 }} placeholder="Placeholder text" />
                <div style={{ marginTop: 8 }}>
                  <label style={styles.propertyLabel}>Field Type</label>
                  <select value={String(field.type || "text")} onChange={(e) => updateField(fieldIndex, { type: e.target.value })} style={styles.propertyInput}>
                    {["text", "email", "tel", "textarea"].map((option) => (
                      <option key={option} value={option}>{option}</option>
                    ))}
                  </select>
                </div>
                <label style={{ ...styles.inlineToggle, marginTop: 8 }}>
                  <input type="checkbox" checked={field.required !== false} onChange={(e) => updateField(fieldIndex, { required: e.target.checked })} style={styles.checkboxInput} />
                  Required field
                </label>
              </div>
            ))}
          </div>
          <button type="button" style={{ ...styles.secondaryBtn, marginTop: 10 }} onClick={addField}>+ Add Field</button>
        </div>
      </div>
    </div>
  );
}
