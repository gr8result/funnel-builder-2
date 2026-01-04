// /pages/welcome.js
import Link from 'next/link';

export default function Welcome() {
  const wrap = { minHeight:'100vh', background:'#0b0f14', color:'#eaeaea' };
  const main = { maxWidth:1000, margin:'0 auto', padding:'60px 16px', textAlign:'center' };
  const h1   = { fontSize:44, margin:'0 0 10px' };
  const p    = { opacity:.85, margin:'0 0 24px' };
  const cta  = { background:'#1a2333', border:'1px solid #2f3a4f', color:'#eaeaea', padding:'12px 18px', borderRadius:10, textDecoration:'none' };

  return (
    <div style={wrap}>
      <main style={main}>
        <h1 style={h1}>Welcome to your Funnel Builder</h1>
        <p style={p}>Create landing pages, sales flows, emails and more — all in one place.</p>
        <div style={{display:'flex', gap:12, justifyContent:'center'}}>
          <Link href="/login" style={cta}>Sign in / Create account</Link>
          <a href="/p/demo" style={{...cta, background:'#152131'}}>See a demo page</a>
        </div>
      </main>
    </div>
  );
}

