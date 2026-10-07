import {useState} from 'react';
import {trimRates,trimSpecification} from '../../lib/product-library/cataloguePresentation.js';
const aud=v=>v==null?'Rate required':new Intl.NumberFormat('en-AU',{style:'currency',currency:'AUD'}).format(v);
export default function TrimCatalogueRate({product,onSave}) {
  const [editing,setEditing]=useState(false),[rates,setRates]=useState(product.attributes),[error,setError]=useState(''),[saving,setSaving]=useState(false);
  const a=product.attributes;
  return <div className="trim-catalogue-rate" data-testid="trim-catalogue-rate">
    <p>{trimSpecification(product)}</p>
    <strong>{aud(a.price_per_linear_metre)} / lm · {aud(a.price_per_stock_length)} / 5.4 m</strong>
    <small>AUD including GST · {a.priceBasis==='verified_supplier_price_conversion'?'Converted verified supplier price':'Editable builder catalogue rate (estimate)'}</small>
    {!editing?<button type="button" onClick={()=>{setRates(a);setEditing(true);}}>Edit trim prices</button>:<div>
      <label>Price per lm (incl GST)<input aria-label="Trim price per lm" type="number" min="0" step="0.01" value={rates.price_per_linear_metre??''} onChange={e=>{try{setRates(trimRates(e.target.value));setError('');}catch(err){setError(err.message);}}}/></label>
      <label>Price per 5.4 m (incl GST)<input aria-label="Trim price per stock length" type="number" min="0" step="0.01" value={rates.price_per_stock_length??''} onChange={e=>{try{setRates(trimRates(e.target.value,'stock'));setError('');}catch(err){setError(err.message);}}}/></label>
      <button type="button" disabled={saving||Boolean(error)} onClick={async()=>{setSaving(true);try{await onSave(product,rates);setEditing(false);}catch(err){setError(err.message);}finally{setSaving(false);}}}>Save trim prices</button>
      <button type="button" onClick={()=>setEditing(false)}>Cancel</button>{error?<p role="alert">{error}</p>:null}
    </div>}
  </div>;
}
