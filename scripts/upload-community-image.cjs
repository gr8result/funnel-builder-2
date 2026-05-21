// Creates and uploads a dark community / crowd-chatting illustration to assets/generic/
'use strict';
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

const SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800" viewBox="0 0 1200 800">
  <defs>
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#07101f"/>
      <stop offset="100%" stop-color="#010408"/>
    </linearGradient>
    <radialGradient id="spotL" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#1d4ed8" stop-opacity="0.22"/>
      <stop offset="100%" stop-color="#1d4ed8" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="spotC" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#0d9488" stop-opacity="0.20"/>
      <stop offset="100%" stop-color="#0d9488" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="spotR" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#7c3aed" stop-opacity="0.22"/>
      <stop offset="100%" stop-color="#7c3aed" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="personFg" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#1e4080"/>
      <stop offset="100%" stop-color="#0d1e42"/>
    </linearGradient>
    <linearGradient id="personAlt" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#1a4a58"/>
      <stop offset="100%" stop-color="#0b2430"/>
    </linearGradient>
    <linearGradient id="personPurple" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#3b1f6e"/>
      <stop offset="100%" stop-color="#1a0d36"/>
    </linearGradient>
    <linearGradient id="bubbleBlue" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#3b82f6"/>
      <stop offset="100%" stop-color="#1d4ed8"/>
    </linearGradient>
    <linearGradient id="bubblePurple" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#8b5cf6"/>
      <stop offset="100%" stop-color="#6d28d9"/>
    </linearGradient>
    <linearGradient id="bubbleTeal" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#2dd4bf"/>
      <stop offset="100%" stop-color="#0f766e"/>
    </linearGradient>
    <linearGradient id="bubbleAmber" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#fbbf24"/>
      <stop offset="100%" stop-color="#b45309"/>
    </linearGradient>
    <linearGradient id="bottomFade" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#010408" stop-opacity="0"/>
      <stop offset="100%" stop-color="#010408" stop-opacity="0.70"/>
    </linearGradient>
    <filter id="glow" x="-30%" y="-30%" width="160%" height="160%">
      <feGaussianBlur stdDeviation="7" result="blur"/>
      <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
    <filter id="softGlow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="4" result="blur"/>
      <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
  </defs>

  <!-- Background -->
  <rect width="1200" height="800" fill="url(#bgGrad)"/>

  <!-- Ambient spotlight orbs behind groups -->
  <ellipse cx="280" cy="560" rx="300" ry="220" fill="url(#spotL)"/>
  <ellipse cx="600" cy="530" rx="320" ry="240" fill="url(#spotC)"/>
  <ellipse cx="920" cy="560" rx="280" ry="210" fill="url(#spotR)"/>

  <!-- Subtle dot grid (background texture) -->
  <g fill="#1e3a5f" fill-opacity="0.22">
    <circle cx="80" cy="80" r="1.5"/><circle cx="160" cy="80" r="1.5"/><circle cx="240" cy="80" r="1.5"/>
    <circle cx="320" cy="80" r="1.5"/><circle cx="880" cy="80" r="1.5"/><circle cx="960" cy="80" r="1.5"/>
    <circle cx="1040" cy="80" r="1.5"/><circle cx="1120" cy="80" r="1.5"/>
    <circle cx="80" cy="160" r="1.5"/><circle cx="160" cy="160" r="1.5"/><circle cx="240" cy="160" r="1.5"/>
    <circle cx="960" cy="160" r="1.5"/><circle cx="1040" cy="160" r="1.5"/><circle cx="1120" cy="160" r="1.5"/>
    <circle cx="80" cy="680" r="1.5"/><circle cx="160" cy="680" r="1.5"/><circle cx="240" cy="680" r="1.5"/>
    <circle cx="960" cy="680" r="1.5"/><circle cx="1040" cy="680" r="1.5"/><circle cx="1120" cy="680" r="1.5"/>
    <circle cx="80" cy="740" r="1.5"/><circle cx="160" cy="740" r="1.5"/><circle cx="880" cy="740" r="1.5"/>
    <circle cx="960" cy="740" r="1.5"/><circle cx="1040" cy="740" r="1.5"/><circle cx="1120" cy="740" r="1.5"/>
  </g>

  <!-- ===== BACKGROUND CROWD — very small, almost black ===== -->
  <!-- Far bg people, barely visible, depth effect -->
  <g fill="#0b1628" fill-opacity="0.90">
    <!-- person bg1 -->
    <circle cx="148" cy="590" r="10"/>
    <rect x="138" y="599" width="20" height="36" rx="8"/>
    <!-- person bg2 -->
    <circle cx="210" cy="586" r="9"/>
    <rect x="201" y="594" width="18" height="32" rx="7"/>
    <!-- person bg3 -->
    <circle cx="270" cy="588" r="9"/>
    <rect x="261" y="596" width="18" height="34" rx="7"/>
    <!-- person bg4 -->
    <circle cx="688" cy="583" r="9"/>
    <rect x="679" y="591" width="18" height="32" rx="7"/>
    <!-- person bg5 -->
    <circle cx="748" cy="585" r="9"/>
    <rect x="739" y="593" width="18" height="32" rx="7"/>
    <!-- person bg6 -->
    <circle cx="930" cy="588" r="10"/>
    <rect x="920" y="597" width="20" height="36" rx="8"/>
    <!-- person bg7 -->
    <circle cx="994" cy="586" r="9"/>
    <rect x="985" y="594" width="18" height="32" rx="7"/>
    <!-- person bg8 -->
    <circle cx="1054" cy="588" r="9"/>
    <rect x="1045" y="596" width="18" height="34" rx="7"/>
    <!-- extra bg scattered -->
    <circle cx="480" cy="587" r="8"/>
    <rect x="472" y="594" width="16" height="30" rx="6"/>
    <circle cx="520" cy="582" r="8"/>
    <rect x="512" y="589" width="16" height="30" rx="6"/>
  </g>

  <!-- ===== MID CROWD — medium size, dark navy ===== -->
  <g fill="#0f2248">
    <!-- mid left 1 -->
    <circle cx="370" cy="551" r="14"/>
    <rect x="355" y="563" width="30" height="57" rx="11"/>
    <!-- mid left 2 -->
    <circle cx="428" cy="548" r="13"/>
    <rect x="414" y="559" width="28" height="54" rx="10"/>
    <!-- mid left 3 -->
    <circle cx="340" cy="555" r="12"/>
    <rect x="328" y="566" width="24" height="50" rx="9"/>
    <!-- mid right 1 -->
    <circle cx="798" cy="552" r="14"/>
    <rect x="783" y="564" width="30" height="56" rx="11"/>
    <!-- mid right 2 -->
    <circle cx="854" cy="548" r="13"/>
    <rect x="840" y="559" width="28" height="54" rx="10"/>
    <!-- mid right 3 -->
    <circle cx="862" cy="554" r="12"/>
    <rect x="850" y="564" width="24" height="50" rx="9"/>
    <!-- mid center -->
    <circle cx="560" cy="548" r="13"/>
    <rect x="546" y="559" width="28" height="54" rx="10"/>
    <circle cx="618" cy="550" r="13"/>
    <rect x="605" y="561" width="26" height="52" rx="10"/>
  </g>

  <!-- ===== FOREGROUND GROUP — LEFT (2 people, teal-ish) ===== -->
  <!-- left person A (facing right slightly) -->
  <circle cx="232" cy="486" r="23" fill="url(#personFg)"/>
  <rect x="208" y="506" width="48" height="98" rx="17" fill="url(#personFg)"/>
  <!-- left person B (facing left) -->
  <circle cx="316" cy="481" r="25" fill="url(#personAlt)"/>
  <rect x="290" y="502" width="52" height="102" rx="18" fill="url(#personAlt)"/>

  <!-- ===== FOREGROUND GROUP — CENTER (4 people) ===== -->
  <!-- center A -->
  <circle cx="474" cy="472" r="24" fill="url(#personFg)"/>
  <rect x="449" y="492" width="50" height="108" rx="18" fill="url(#personFg)"/>
  <!-- center B (tallest, brightest — focal person) -->
  <circle cx="558" cy="460" r="28" fill="url(#personAlt)"/>
  <rect x="529" y="484" width="58" height="116" rx="20" fill="url(#personAlt)"/>
  <!-- center C -->
  <circle cx="644" cy="462" r="27" fill="url(#personPurple)"/>
  <rect x="616" y="485" width="56" height="114" rx="20" fill="url(#personPurple)"/>
  <!-- center D -->
  <circle cx="726" cy="472" r="24" fill="url(#personFg)"/>
  <rect x="701" y="492" width="50" height="106" rx="18" fill="url(#personFg)"/>

  <!-- ===== FOREGROUND GROUP — RIGHT (2 people, purple-ish) ===== -->
  <!-- right person A -->
  <circle cx="882" cy="484" r="24" fill="url(#personPurple)"/>
  <rect x="857" y="504" width="50" height="100" rx="17" fill="url(#personPurple)"/>
  <!-- right person B -->
  <circle cx="964" cy="488" r="23" fill="url(#personFg)"/>
  <rect x="940" y="507" width="48" height="97" rx="17" fill="url(#personFg)"/>

  <!-- ===== INTERACTION DASHED LINES between adjacent people ===== -->
  <line x1="256" y1="486" x2="290" y2="484" stroke="#2dd4bf" stroke-width="1.5" stroke-dasharray="4,4" stroke-opacity="0.35"/>
  <line x1="499" y1="474" x2="530" y2="472" stroke="#3b82f6" stroke-width="1.5" stroke-dasharray="4,4" stroke-opacity="0.30"/>
  <line x1="588" y1="464" x2="618" y2="464" stroke="#3b82f6" stroke-width="1.5" stroke-dasharray="4,4" stroke-opacity="0.30"/>
  <line x1="673" y1="474" x2="701" y2="474" stroke="#8b5cf6" stroke-width="1.5" stroke-dasharray="4,4" stroke-opacity="0.30"/>
  <line x1="906" y1="484" x2="940" y2="486" stroke="#8b5cf6" stroke-width="1.5" stroke-dasharray="4,4" stroke-opacity="0.35"/>

  <!-- Cross-group arc lines -->
  <path d="M316 450 Q390 370 474 440" stroke="#3b82f6" stroke-width="1.5" fill="none" stroke-opacity="0.18" stroke-dasharray="6,8"/>
  <path d="M726 440 Q800 368 882 452" stroke="#8b5cf6" stroke-width="1.5" fill="none" stroke-opacity="0.18" stroke-dasharray="6,8"/>

  <!-- ===== SPEECH BUBBLES ===== -->

  <!-- Left group — teal bubble -->
  <g filter="url(#softGlow)">
    <rect x="120" y="280" width="232" height="104" rx="22" fill="url(#bubbleTeal)" fill-opacity="0.88"/>
    <path d="M248 384 L236 406 L262 384" fill="#2dd4bf" fill-opacity="0.78"/>
    <rect x="148" y="302" width="168" height="10" rx="5" fill="white" fill-opacity="0.30"/>
    <rect x="148" y="322" width="128" height="10" rx="5" fill="white" fill-opacity="0.22"/>
    <rect x="148" y="342" width="148" height="10" rx="5" fill="white" fill-opacity="0.15"/>
    <rect x="148" y="362" width="96" height="10" rx="5" fill="white" fill-opacity="0.10"/>
    <circle cx="322" cy="296" r="9" fill="white" fill-opacity="0.14"/>
    <circle cx="322" cy="296" r="4.5" fill="white" fill-opacity="0.22"/>
  </g>

  <!-- Center group — large blue bubble (main focal) -->
  <g filter="url(#glow)">
    <rect x="446" y="234" width="310" height="128" rx="26" fill="url(#bubbleBlue)" fill-opacity="0.92"/>
    <path d="M558 362 L542 388 L576 362" fill="#3b82f6" fill-opacity="0.80"/>
    <rect x="474" y="260" width="228" height="11" rx="5.5" fill="white" fill-opacity="0.32"/>
    <rect x="474" y="282" width="178" height="11" rx="5.5" fill="white" fill-opacity="0.24"/>
    <rect x="474" y="304" width="204" height="11" rx="5.5" fill="white" fill-opacity="0.17"/>
    <rect x="474" y="326" width="138" height="11" rx="5.5" fill="white" fill-opacity="0.11"/>
    <circle cx="722" cy="352" r="10" fill="white" fill-opacity="0.14"/>
    <circle cx="722" cy="352" r="5" fill="white" fill-opacity="0.22"/>
  </g>

  <!-- Center-right person — amber bubble -->
  <g filter="url(#softGlow)">
    <rect x="632" y="278" width="218" height="98" rx="20" fill="url(#bubbleAmber)" fill-opacity="0.84"/>
    <path d="M668 376 L656 398 L680 376" fill="#fbbf24" fill-opacity="0.70"/>
    <rect x="658" y="298" width="158" height="10" rx="5" fill="white" fill-opacity="0.30"/>
    <rect x="658" y="318" width="120" height="10" rx="5" fill="white" fill-opacity="0.22"/>
    <rect x="658" y="338" width="140" height="10" rx="5" fill="white" fill-opacity="0.14"/>
    <rect x="658" y="358" width="90" height="10" rx="5" fill="white" fill-opacity="0.09"/>
  </g>

  <!-- Right group — purple bubble -->
  <g filter="url(#softGlow)">
    <rect x="844" y="274" width="244" height="112" rx="22" fill="url(#bubblePurple)" fill-opacity="0.88"/>
    <path d="M930 386 L916 410 L944 386" fill="#8b5cf6" fill-opacity="0.75"/>
    <rect x="870" y="296" width="178" height="10" rx="5" fill="white" fill-opacity="0.30"/>
    <rect x="870" y="316" width="138" height="10" rx="5" fill="white" fill-opacity="0.22"/>
    <rect x="870" y="336" width="158" height="10" rx="5" fill="white" fill-opacity="0.15"/>
    <rect x="870" y="356" width="104" height="10" rx="5" fill="white" fill-opacity="0.09"/>
    <circle cx="1060" cy="290" r="8" fill="white" fill-opacity="0.13"/>
  </g>

  <!-- Small bubble top-left floating -->
  <g filter="url(#softGlow)">
    <rect x="72" y="158" width="152" height="72" rx="18" fill="url(#bubbleTeal)" fill-opacity="0.68"/>
    <path d="M132 230 L120 252 L148 230" fill="#2dd4bf" fill-opacity="0.55"/>
    <rect x="94" y="178" width="104" height="8.5" rx="4.5" fill="white" fill-opacity="0.28"/>
    <rect x="94" y="196" width="78" height="8.5" rx="4.5" fill="white" fill-opacity="0.20"/>
    <rect x="94" y="214" width="92" height="8.5" rx="4.5" fill="white" fill-opacity="0.13"/>
  </g>

  <!-- Small bubble top-right floating -->
  <g filter="url(#softGlow)">
    <rect x="958" y="150" width="164" height="74" rx="18" fill="url(#bubblePurple)" fill-opacity="0.68"/>
    <path d="M1034 224 L1020 246 L1050 224" fill="#8b5cf6" fill-opacity="0.55"/>
    <rect x="980" y="170" width="116" height="8.5" rx="4.5" fill="white" fill-opacity="0.28"/>
    <rect x="980" y="189" width="88" height="8.5" rx="4.5" fill="white" fill-opacity="0.20"/>
    <rect x="980" y="208" width="104" height="8.5" rx="4.5" fill="white" fill-opacity="0.13"/>
  </g>

  <!-- Tiny bubble top-center -->
  <g>
    <rect x="524" y="100" width="136" height="60" rx="14" fill="url(#bubbleBlue)" fill-opacity="0.52"/>
    <path d="M576 160 L564 178 L590 160" fill="#3b82f6" fill-opacity="0.42"/>
    <rect x="542" y="116" width="90" height="8" rx="4" fill="white" fill-opacity="0.25"/>
    <rect x="542" y="134" width="68" height="8" rx="4" fill="white" fill-opacity="0.18"/>
  </g>

  <!-- ===== REACTION / NOTIFICATION BADGES ===== -->
  <circle cx="350" cy="294" r="15" fill="#ef4444" filter="url(#softGlow)"/>
  <circle cx="350" cy="294" r="7" fill="white" fill-opacity="0.88"/>
  <circle cx="844" cy="288" r="13" fill="#f97316" filter="url(#softGlow)"/>
  <circle cx="844" cy="288" r="6" fill="white" fill-opacity="0.85"/>

  <!-- ===== PARTICLES ===== -->
  <circle cx="416" cy="140" r="3.5" fill="#3b82f6" fill-opacity="0.55"/>
  <circle cx="458" cy="116" r="2.5" fill="#2dd4bf" fill-opacity="0.50"/>
  <circle cx="510" cy="90" r="2" fill="#3b82f6" fill-opacity="0.40"/>
  <circle cx="736" cy="118" r="3" fill="#8b5cf6" fill-opacity="0.55"/>
  <circle cx="782" cy="138" r="2" fill="#fbbf24" fill-opacity="0.50"/>
  <circle cx="114" cy="344" r="3" fill="#2dd4bf" fill-opacity="0.42"/>
  <circle cx="162" cy="468" r="2.5" fill="#3b82f6" fill-opacity="0.38"/>
  <circle cx="1072" cy="312" r="3" fill="#8b5cf6" fill-opacity="0.42"/>
  <circle cx="1110" cy="450" r="2.5" fill="#3b82f6" fill-opacity="0.35"/>
  <circle cx="598" cy="68" r="2" fill="#fbbf24" fill-opacity="0.42"/>
  <circle cx="640" cy="50" r="1.5" fill="#2dd4bf" fill-opacity="0.38"/>
  <circle cx="184" cy="264" r="2.5" fill="#8b5cf6" fill-opacity="0.38"/>
  <circle cx="396" cy="644" r="3" fill="#3b82f6" fill-opacity="0.30"/>
  <circle cx="790" cy="650" r="3" fill="#8b5cf6" fill-opacity="0.28"/>

  <!-- ===== SPARKLE STARS ===== -->
  <g fill="#2dd4bf" fill-opacity="0.58" transform="translate(400,200)">
    <polygon points="0,-8 1.7,-1.7 8,0 1.7,1.7 0,8 -1.7,1.7 -8,0 -1.7,-1.7"/>
  </g>
  <g fill="#8b5cf6" fill-opacity="0.58" transform="translate(808,218)">
    <polygon points="0,-7 1.5,-1.5 7,0 1.5,1.5 0,7 -1.5,1.5 -7,0 -1.5,-1.5"/>
  </g>
  <g fill="#fbbf24" fill-opacity="0.52" transform="translate(598,196)">
    <polygon points="0,-9 1.9,-1.9 9,0 1.9,1.9 0,9 -1.9,1.9 -9,0 -1.9,-1.9"/>
  </g>
  <g fill="#3b82f6" fill-opacity="0.45" transform="translate(230,148)">
    <polygon points="0,-5 1.1,-1.1 5,0 1.1,1.1 0,5 -1.1,1.1 -5,0 -1.1,-1.1"/>
  </g>
  <g fill="#2dd4bf" fill-opacity="0.40" transform="translate(976,248)">
    <polygon points="0,-5 1.1,-1.1 5,0 1.1,1.1 0,5 -1.1,1.1 -5,0 -1.1,-1.1"/>
  </g>

  <!-- ===== FLOOR SHADOW UNDER CROWD ===== -->
  <ellipse cx="600" cy="648" rx="580" ry="28" fill="#1d4ed8" fill-opacity="0.07"/>
  <ellipse cx="600" cy="655" rx="460" ry="18" fill="#000" fill-opacity="0.25"/>

  <!-- Bottom fade overlay -->
  <rect width="1200" height="180" y="620" fill="url(#bottomFade)"/>
</svg>`;

(async () => {
  const buf = Buffer.from(SVG, 'utf8');
  const storagePath = 'generic/community-dark.svg';

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
