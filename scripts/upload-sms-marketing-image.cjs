// Uploads a dark SMS-marketing illustration SVG to assets/generic/ in Supabase storage.
'use strict';
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

const SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800" viewBox="0 0 1200 800">
  <defs>
    <radialGradient id="bg" cx="50%" cy="50%" r="70%">
      <stop offset="0%" stop-color="#0f172a"/>
      <stop offset="100%" stop-color="#020409"/>
    </radialGradient>
    <linearGradient id="screenGrad" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#0f172a"/>
      <stop offset="100%" stop-color="#06091a"/>
    </linearGradient>
    <linearGradient id="blueGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#3b82f6"/>
      <stop offset="100%" stop-color="#1d4ed8"/>
    </linearGradient>
    <linearGradient id="tealGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#2dd4bf"/>
      <stop offset="100%" stop-color="#0f766e"/>
    </linearGradient>
    <linearGradient id="purpleGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#a78bfa"/>
      <stop offset="100%" stop-color="#6d28d9"/>
    </linearGradient>
    <linearGradient id="phoneBody" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#1e293b"/>
      <stop offset="100%" stop-color="#0f172a"/>
    </linearGradient>
    <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="6" result="blur"/>
      <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
    <filter id="subtleGlow" x="-10%" y="-10%" width="120%" height="120%">
      <feGaussianBlur stdDeviation="3" result="blur"/>
      <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
    <linearGradient id="bottomFade" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#020409" stop-opacity="0"/>
      <stop offset="100%" stop-color="#020409" stop-opacity="0.65"/>
    </linearGradient>
  </defs>

  <!-- Background -->
  <rect width="1200" height="800" fill="url(#bg)"/>
  <circle cx="280" cy="240" r="210" fill="#1d4ed8" fill-opacity="0.04"/>
  <circle cx="920" cy="360" r="260" fill="#7c3aed" fill-opacity="0.04"/>
  <circle cx="600" cy="600" r="190" fill="#0f766e" fill-opacity="0.04"/>

  <!-- Subtle grid dots -->
  <circle cx="100" cy="100" r="1.5" fill="#334155" fill-opacity="0.5"/>
  <circle cx="200" cy="100" r="1.5" fill="#334155" fill-opacity="0.5"/>
  <circle cx="300" cy="100" r="1.5" fill="#334155" fill-opacity="0.5"/>
  <circle cx="400" cy="100" r="1.5" fill="#334155" fill-opacity="0.5"/>
  <circle cx="900" cy="100" r="1.5" fill="#334155" fill-opacity="0.5"/>
  <circle cx="1000" cy="100" r="1.5" fill="#334155" fill-opacity="0.5"/>
  <circle cx="1100" cy="100" r="1.5" fill="#334155" fill-opacity="0.5"/>
  <circle cx="100" cy="200" r="1.5" fill="#334155" fill-opacity="0.5"/>
  <circle cx="200" cy="200" r="1.5" fill="#334155" fill-opacity="0.5"/>
  <circle cx="300" cy="200" r="1.5" fill="#334155" fill-opacity="0.5"/>
  <circle cx="1000" cy="200" r="1.5" fill="#334155" fill-opacity="0.5"/>
  <circle cx="1100" cy="200" r="1.5" fill="#334155" fill-opacity="0.5"/>
  <circle cx="100" cy="600" r="1.5" fill="#334155" fill-opacity="0.5"/>
  <circle cx="200" cy="600" r="1.5" fill="#334155" fill-opacity="0.5"/>
  <circle cx="1000" cy="600" r="1.5" fill="#334155" fill-opacity="0.5"/>
  <circle cx="1100" cy="600" r="1.5" fill="#334155" fill-opacity="0.5"/>
  <circle cx="100" cy="700" r="1.5" fill="#334155" fill-opacity="0.5"/>
  <circle cx="200" cy="700" r="1.5" fill="#334155" fill-opacity="0.5"/>
  <circle cx="300" cy="700" r="1.5" fill="#334155" fill-opacity="0.5"/>
  <circle cx="900" cy="700" r="1.5" fill="#334155" fill-opacity="0.5"/>
  <circle cx="1000" cy="700" r="1.5" fill="#334155" fill-opacity="0.5"/>
  <circle cx="1100" cy="700" r="1.5" fill="#334155" fill-opacity="0.5"/>

  <!-- Connector lines -->
  <line x1="360" y1="288" x2="515" y2="352" stroke="#3b82f6" stroke-width="1.5" stroke-dasharray="8,6" stroke-opacity="0.3"/>
  <line x1="685" y1="308" x2="840" y2="255" stroke="#3b82f6" stroke-width="1.5" stroke-dasharray="8,6" stroke-opacity="0.3"/>
  <line x1="698" y1="422" x2="855" y2="518" stroke="#a78bfa" stroke-width="1.5" stroke-dasharray="8,6" stroke-opacity="0.3"/>
  <line x1="502" y1="448" x2="328" y2="528" stroke="#2dd4bf" stroke-width="1.5" stroke-dasharray="8,6" stroke-opacity="0.3"/>

  <!-- Phone glow -->
  <rect x="508" y="153" width="184" height="326" rx="32" fill="#3b82f6" fill-opacity="0.06"/>

  <!-- Phone body -->
  <rect x="514" y="158" width="172" height="316" rx="30" fill="url(#phoneBody)" stroke="#334155" stroke-width="2"/>

  <!-- Phone screen -->
  <rect x="524" y="180" width="152" height="262" rx="14" fill="url(#screenGrad)"/>
  <rect x="524" y="180" width="152" height="262" rx="14" fill="#3b82f6" fill-opacity="0.03" stroke="#1e293b" stroke-width="1"/>

  <!-- Speaker, camera -->
  <rect x="576" y="169" width="48" height="5" rx="2.5" fill="#334155"/>
  <circle cx="636" cy="171" r="3.5" fill="#1e293b" stroke="#475569" stroke-width="0.75"/>
  <circle cx="636" cy="171" r="1.5" fill="#334155"/>

  <!-- Home bar -->
  <rect x="563" y="458" width="74" height="4" rx="2" fill="#334155"/>

  <!-- Screen chat content (no text) -->
  <circle cx="536" cy="192" r="2" fill="#475569"/>
  <circle cx="542" cy="192" r="2" fill="#475569"/>
  <circle cx="548" cy="192" r="2" fill="#475569"/>

  <!-- Outgoing bubble -->
  <rect x="562" y="202" width="102" height="26" rx="13" fill="#2563eb"/>
  <!-- Incoming bubble -->
  <rect x="528" y="240" width="84" height="26" rx="13" fill="#1e293b" stroke="#2d3f59" stroke-width="1"/>
  <!-- Outgoing bubble 2 -->
  <rect x="548" y="278" width="116" height="26" rx="13" fill="#1d4ed8"/>
  <!-- Incoming teal bubble -->
  <rect x="528" y="316" width="90" height="26" rx="13" fill="#134e4a"/>
  <rect x="528" y="316" width="90" height="26" rx="13" fill="#2dd4bf" fill-opacity="0.18"/>
  <!-- Outgoing short -->
  <rect x="584" y="354" width="60" height="26" rx="13" fill="#2563eb"/>
  <!-- Typing dots -->
  <circle cx="537" cy="400" r="4" fill="#334155"/>
  <circle cx="549" cy="400" r="4.5" fill="#475569"/>
  <circle cx="562" cy="400" r="4" fill="#334155"/>
  <!-- Read receipts -->
  <circle cx="651" cy="342" r="2.5" fill="#2dd4bf" fill-opacity="0.7"/>
  <circle cx="658" cy="342" r="2.5" fill="#2dd4bf" fill-opacity="0.7"/>

  <!-- LEFT LARGE BUBBLE (teal) -->
  <g filter="url(#glow)">
    <rect x="98" y="193" width="264" height="112" rx="24" fill="url(#tealGrad)" fill-opacity="0.92"/>
    <path d="M362 233 L388 254 L362 272" fill="#2dd4bf" fill-opacity="0.8"/>
    <rect x="124" y="221" width="188" height="10" rx="5" fill="white" fill-opacity="0.28"/>
    <rect x="124" y="241" width="148" height="10" rx="5" fill="white" fill-opacity="0.2"/>
    <rect x="124" y="261" width="112" height="10" rx="5" fill="white" fill-opacity="0.14"/>
    <circle cx="342" cy="210" r="9" fill="#ef4444"/>
    <circle cx="342" cy="210" r="4" fill="white" fill-opacity="0.85"/>
  </g>

  <!-- RIGHT TOP BUBBLE (blue) -->
  <g filter="url(#glow)">
    <rect x="838" y="168" width="258" height="108" rx="24" fill="url(#blueGrad)" fill-opacity="0.92"/>
    <path d="M838 208 L812 228 L838 250" fill="#3b82f6" fill-opacity="0.8"/>
    <rect x="862" y="194" width="178" height="10" rx="5" fill="white" fill-opacity="0.28"/>
    <rect x="862" y="214" width="138" height="10" rx="5" fill="white" fill-opacity="0.2"/>
    <rect x="862" y="234" width="158" height="10" rx="5" fill="white" fill-opacity="0.14"/>
    <circle cx="1072" cy="258" r="8" fill="white" fill-opacity="0.14"/>
  </g>

  <!-- RIGHT BOTTOM BUBBLE (purple) -->
  <g filter="url(#glow)">
    <rect x="853" y="463" width="238" height="102" rx="24" fill="url(#purpleGrad)" fill-opacity="0.9"/>
    <path d="M853 488 L826 473 L853 510" fill="#a78bfa" fill-opacity="0.7"/>
    <rect x="876" y="488" width="168" height="9" rx="4.5" fill="white" fill-opacity="0.28"/>
    <rect x="876" y="507" width="128" height="9" rx="4.5" fill="white" fill-opacity="0.2"/>
    <rect x="876" y="526" width="148" height="9" rx="4.5" fill="white" fill-opacity="0.14"/>
    <circle cx="1062" cy="504" r="7" fill="white" fill-opacity="0.12"/>
    <circle cx="1062" cy="504" r="3.5" fill="white" fill-opacity="0.2"/>
  </g>

  <!-- LEFT BOTTOM BUBBLE (blue small) -->
  <g filter="url(#subtleGlow)">
    <rect x="128" y="508" width="204" height="90" rx="20" fill="url(#blueGrad)" fill-opacity="0.85"/>
    <path d="M272 598 L288 620 L256 598" fill="#3b82f6" fill-opacity="0.7"/>
    <rect x="150" y="530" width="148" height="9" rx="4.5" fill="white" fill-opacity="0.28"/>
    <rect x="150" y="549" width="112" height="9" rx="4.5" fill="white" fill-opacity="0.2"/>
    <rect x="150" y="568" width="132" height="9" rx="4.5" fill="white" fill-opacity="0.14"/>
  </g>

  <!-- SMALL BUBBLE top-center-left (teal) -->
  <g filter="url(#subtleGlow)">
    <rect x="368" y="88" width="144" height="68" rx="16" fill="url(#tealGrad)" fill-opacity="0.75"/>
    <path d="M452 156 L464 172 L440 156" fill="#2dd4bf" fill-opacity="0.6"/>
    <rect x="386" y="106" width="98" height="8" rx="4" fill="white" fill-opacity="0.28"/>
    <rect x="386" y="122" width="70" height="8" rx="4" fill="white" fill-opacity="0.18"/>
    <rect x="386" y="138" width="82" height="8" rx="4" fill="white" fill-opacity="0.12"/>
  </g>

  <!-- SMALL BUBBLE top-right (purple) -->
  <g filter="url(#subtleGlow)">
    <rect x="808" y="78" width="128" height="62" rx="14" fill="url(#purpleGrad)" fill-opacity="0.72"/>
    <path d="M820 140 L806 158 L842 140" fill="#a78bfa" fill-opacity="0.55"/>
    <rect x="824" y="96" width="90" height="8" rx="4" fill="white" fill-opacity="0.28"/>
    <rect x="824" y="114" width="66" height="8" rx="4" fill="white" fill-opacity="0.18"/>
  </g>

  <!-- Signal waves -->
  <g stroke="#3b82f6" stroke-linecap="round" fill="none">
    <path d="M708 184 Q732 158 712 132" stroke-width="2.5" stroke-opacity="0.55"/>
    <path d="M722 196 Q754 162 728 125" stroke-width="2" stroke-opacity="0.38"/>
    <path d="M735 208 Q776 166 744 116" stroke-width="1.5" stroke-opacity="0.22"/>
  </g>

  <!-- Notification badges -->
  <circle cx="386" cy="183" r="14" fill="#ef4444" filter="url(#subtleGlow)"/>
  <circle cx="386" cy="183" r="6" fill="white" fill-opacity="0.9"/>
  <circle cx="843" cy="160" r="12" fill="#f97316" filter="url(#subtleGlow)"/>
  <circle cx="843" cy="160" r="5" fill="white" fill-opacity="0.85"/>

  <!-- Particles -->
  <circle cx="446" cy="144" r="3.5" fill="#3b82f6" fill-opacity="0.55"/>
  <circle cx="480" cy="120" r="2.5" fill="#2dd4bf" fill-opacity="0.5"/>
  <circle cx="762" cy="128" r="3" fill="#a78bfa" fill-opacity="0.55"/>
  <circle cx="800" cy="146" r="2" fill="#3b82f6" fill-opacity="0.45"/>
  <circle cx="372" cy="442" r="4" fill="#2dd4bf" fill-opacity="0.4"/>
  <circle cx="832" cy="402" r="3.5" fill="#a78bfa" fill-opacity="0.4"/>
  <circle cx="442" cy="662" r="3" fill="#3b82f6" fill-opacity="0.4"/>
  <circle cx="792" cy="642" r="3" fill="#2dd4bf" fill-opacity="0.35"/>
  <circle cx="182" cy="482" r="3" fill="#a78bfa" fill-opacity="0.4"/>
  <circle cx="1022" cy="452" r="4" fill="#3b82f6" fill-opacity="0.35"/>

  <!-- Sparkles -->
  <g fill="#2dd4bf" fill-opacity="0.5" transform="translate(462,382)">
    <polygon points="0,-7 1.5,-1.5 7,0 1.5,1.5 0,7 -1.5,1.5 -7,0 -1.5,-1.5"/>
  </g>
  <g fill="#a78bfa" fill-opacity="0.5" transform="translate(822,562)">
    <polygon points="0,-6 1.3,-1.3 6,0 1.3,1.3 0,6 -1.3,1.3 -6,0 -1.3,-1.3"/>
  </g>
  <g fill="#3b82f6" fill-opacity="0.45" transform="translate(582,82)">
    <polygon points="0,-8 1.7,-1.7 8,0 1.7,1.7 0,8 -1.7,1.7 -8,0 -1.7,-1.7"/>
  </g>

  <!-- Bottom fade -->
  <rect width="1200" height="200" y="600" fill="url(#bottomFade)"/>
</svg>`;

(async () => {
  const buf = Buffer.from(SVG, 'utf8');
  const storagePath = 'generic/sms-marketing-dark.svg';

  const { error } = await supabase.storage
    .from('assets')
    .upload(storagePath, buf, {
      contentType: 'image/svg+xml',
      upsert: true,
    });

  if (error) {
    console.error('Upload failed:', error.message);
    process.exit(1);
  }

  const { data } = supabase.storage.from('assets').getPublicUrl(storagePath);
  console.log('Uploaded successfully.');
  console.log('Public URL:', data?.publicUrl);
})().catch((err) => { console.error(err); process.exit(1); });
