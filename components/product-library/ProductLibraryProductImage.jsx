// Product image rendering with verified-image and appliance fallbacks.
// Extracted from pages/modules/builders/product-library.js.
// Every branch resolves to a real image: an exact verified product shot when we
// hold one, otherwise the category illustration for that family. The appliance
// fallback SVGs carry an "Exact <category> image required" caption of their own,
// so the card still reads as unverified without leaving an empty grey tile.
import VerifiedProductImage from "./VerifiedProductImage";
import DoorProductImage from "./DoorProductImage";
import { applianceFallbackImage, productIsAppliance } from "../../lib/product-library/applianceCataloguePresentation.js";
import { isDoorProduct, productDisplayImage, productVerifiedImage } from "../../lib/product-library/productPresentation.js";

export function ProductImageAwaitingVerification({ product, large = false }) {
  return (
    <span className={large ? "product-image-awaiting large" : "product-image-awaiting"} role="img" aria-label="Product image awaiting verification">
      <strong>{product?.brand || product?.manufacturer || "Product Library"}</strong>
      <small>Image awaiting verification</small>
    </span>
  );
}

export default function ProductLibraryProductImage({ product, familyItem, large = false }) {
  const verifiedImage = productVerifiedImage(product);
  if (isDoorProduct(product)) return <DoorProductImage src={verifiedImage || productDisplayImage(product, familyItem)} name={product.productName} size={large ? "detail" : "card"} />;
  if (product.attributes?.internalAreasCatalogue) return <div className="canonical-product-media" title={product.attributes.imageScope||''}><VerifiedProductImage src={verifiedImage || productDisplayImage(product, familyItem)} name={product.productName} style={{width:'100%',height:large?360:220}}/>{large&&product.attributes.imageScope?<small>{product.attributes.imageScope}</small>:null}</div>;
  if (verifiedImage) return <img src={verifiedImage} alt={product.productName} loading={large ? "eager" : "lazy"} decoding="async" />;
  if (productIsAppliance(product, familyItem)) {
    return <img className={large ? "product-image-fallback large" : "product-image-fallback"} src={applianceFallbackImage(product, familyItem)} alt={`${product.productName} — exact product image awaiting verification`} loading={large ? "eager" : "lazy"} decoding="async" />;
  }
  const displayImage = productDisplayImage(product, familyItem);
  if (!displayImage) return <ProductImageAwaitingVerification product={product} large={large} />;
  return <img src={displayImage} alt={product.productName} loading={large ? "eager" : "lazy"} decoding="async" />;
}
