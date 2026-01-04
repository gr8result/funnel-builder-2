// pages/checkout/cancel.js
export default function Cancel() {
  return (
    <div style={{ minHeight:'100vh', background:'#0b0b0b', color:'#eaeaea',
      display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column' }}>
      <h2 style={{ marginBottom:8 }}>Checkout cancelled</h2>
      <p style={{ color:'#bbb' }}>No charge was made.</p>
      <a href="/account/billing" style={{ color:'#9ab4ff', marginTop:12 }}>← Back to billing</a>
    </div>
  );
}
