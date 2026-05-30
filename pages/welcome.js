// /pages/welcome.js
import Link from 'next/link';

export default function Welcome() {
  const wrap = { position:'relative', minHeight:'100vh', background:'#0b0f14', color:'#eaeaea', overflow:'hidden' };
  const videoBg = { position:'absolute', top:0, left:0, width:'100%', height:'100%', objectFit:'cover', zIndex:0, opacity:0.55 };
  const overlay = { position:'absolute', top:0, left:0, width:'100%', height:'100%', background:'linear-gradient(to bottom, rgba(11,15,20,0.5) 0%, rgba(11,15,20,0.75) 100%)', zIndex:1 };
  const main = { position:'relative', zIndex:2, maxWidth:1000, margin:'0 auto', padding:'160px 16px 80px', textAlign:'center' };
  const h1   = { fontSize:52, fontWeight:700, margin:'0 0 16px', lineHeight:1.15, textShadow:'0 2px 24px rgba(0,0,0,0.7)' };
  const p    = { fontSize:20, opacity:.9, margin:'0 0 36px', textShadow:'0 1px 8px rgba(0,0,0,0.6)' };
  const cta  = { display:'inline-block', background:'#2563eb', border:'none', color:'#fff', padding:'14px 28px', borderRadius:10, textDecoration:'none', fontWeight:600, fontSize:16 };
  const ctaSecondary = { display:'inline-block', background:'rgba(255,255,255,0.12)', border:'1px solid rgba(255,255,255,0.25)', color:'#eaeaea', padding:'14px 28px', borderRadius:10, textDecoration:'none', fontWeight:600, fontSize:16, backdropFilter:'blur(4px)' };

  return (
    <div style={wrap}>
      <video
        style={videoBg}
        src="/opening-block-video.mp4"
        autoPlay
        muted
        loop
        playsInline
      />
      <div style={overlay} />
      <main style={main}>
        <h1 style={h1}>Welcome to your Funnel Builder</h1>
        <p style={p}>Create landing pages, sales flows, emails and more — all in one place.</p>
        <div style={{display:'flex', gap:16, justifyContent:'center', flexWrap:'wrap'}}>
          <Link href="/login" style={cta}>Sign in / Create account</Link>
          <a href="/p/demo" style={ctaSecondary}>See a demo page</a>
        </div>
      </main>
    </div>
  );
}

