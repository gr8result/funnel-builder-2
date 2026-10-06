// Appliance catalogue card, image fallback and brand logo.
// Extracted from pages/modules/builders/product-library.js; logic unchanged.
import { Check, Copy } from "lucide-react";
import { APPLIANCE_IMAGE_FALLBACK_LABEL } from "../../lib/product-library/applianceCatalogueSelectors";
import { isApplianceRecordSelectable } from "../../lib/product-library/applianceCatalogueSelectorsCore.js";
import {
  applianceConfigurationBucket,
  applianceDimensionLabel,
  applianceHncPriceLabel,
  appliancePriceLabel,
  applianceSelectionUnavailableReason,
} from "../../lib/product-library/applianceCataloguePresentation.js";

export function ApplianceImage({ record, large = false }) {
  if (record?.image) return <img src={record.image} alt={`${record.name || record.productName || "Appliance"} product`} loading={large ? "eager" : "lazy"} />;
  return (
    <span
      className={large ? "appliance-image-fallback large" : "appliance-image-fallback"}
      role="img"
      aria-label={`${record?.model || record?.manufacturerModel || record?.name || "Appliance"}: exact product image unavailable`}
    >
      <strong>{record?.imageFallbackLabel || APPLIANCE_IMAGE_FALLBACK_LABEL}</strong>
      <small>{record?.model || record?.manufacturerModel || "No verified exact-model image available"}</small>
    </span>
  );
}

export function ApplianceCard({ record, brand, onOpen, onSelect, onExport, exportSelected, compareLabel = "Compare" }) {
  const hncPrice = applianceHncPriceLabel(record);
  return (
    <article className="product-option management-card appliance-visual-card" data-appliance-product={record.productId} data-appliance-family={record.familyId}>
      <label><input type="checkbox" aria-label={`Select ${record.name} for export`} checked={Boolean(exportSelected)} onChange={()=>onExport(record)} /> Select for export</label>
      <div className="appliance-card-logo">{brand ? <ApplianceBrandLogo brand={brand} /> : <strong>{record.brand || "Brand"}</strong>}</div>
      <div className="appliance-card-media">
        <ApplianceImage record={record} />
      </div>
      <div className="appliance-card-copy">
        <span>{record.familyName || "Appliance"}</span>
        <strong>{record.name}</strong>
        <small>{record.model || record.productCode || "Model pending"}</small>
        <small>{[
          applianceDimensionLabel(record),
          applianceConfigurationBucket(record),
          record.finish,
        ].filter(Boolean).join(" / ")}</small>
      </div>
      <div className="appliance-card-footer">
        {hncPrice ? <strong>{hncPrice}</strong> : null}
        {!hncPrice || (!record.priceIsHncReference && record.price != null && record.price !== "") ? <strong>{hncPrice ? "Catalogue price: " : ""}{appliancePriceLabel(record)}</strong> : null}
        <span className={record.image ? "status-pill on" : "status-pill"}>{record.image ? "verified image" : "exact image required"}</span>
      </div>
      <div className="card-actions appliance-card-actions">
        <button type="button" onClick={() => onOpen(record)}>View Details</button>
        <button type="button" disabled={!isApplianceRecordSelectable(record)} title={applianceSelectionUnavailableReason(record) || undefined} onClick={() => onSelect(record)}><Check size={15} /> Select Product</button>
        <button type="button" className="secondary" onClick={() => onOpen(record)}><Copy size={15} /> {compareLabel}</button>
        {!isApplianceRecordSelectable(record) ? <small className="warning-text">{applianceSelectionUnavailableReason(record)}</small> : null}
      </div>
    </article>
  );
}

export function ApplianceBrandLogo({ brand }) {
  if (brand?.logoUrl) {
    return (
      <span className="appliance-brand-logo" style={brand.logoBackground ? { "--brand-logo-background": brand.logoBackground } : {}}>
        <img src={brand.logoUrl} alt={`${brand.brandName} logo`} />
      </span>
    );
  }
  return <span className="appliance-brand-logo text-logo">{brand?.brandName || "Brand"}</span>;
}
