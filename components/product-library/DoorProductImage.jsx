// Tall image frame for door products (Product Library, Client Selections, Selections Book).
// Portrait door images are shown whole with object-fit: contain in a tall frame. Wide studio shots
// with a measured door band (DOOR_IMAGE_SUBJECTS) show just that band at full frame height, cropping
// only the empty canvas either side - never the top or bottom of the door, never stretched.
// Frame height comes from --door-frame-height so a compact list view can override it.
import {useState} from 'react';
import {DOOR_IMAGE_SUBJECTS} from '../../lib/product-library/doorImageSubjects.js';

// Card: 3x the previous 220px product image box (a door is shown 3x taller and 3x wider). Detail:
// 3x the previous 360px detail box, capped to the viewport so the whole door always stays visible.
export const DOOR_IMAGE_HEIGHTS = {card: '660px', detail: 'min(1080px, 82vh)'};

export default function DoorProductImage({src, name = '', size = 'card', className = ''}) {
  const [failed, setFailed] = useState('');
  const height = DOOR_IMAGE_HEIGHTS[size] || (Number(size) ? `${Number(size)}px` : DOOR_IMAGE_HEIGHTS.card);
  const frameHeight = `var(--door-frame-height, ${height})`;
  const classes = `door-product-media ${className}`.trim();
  if (!src || failed === src) {
    return <span className={classes} role="img" aria-label={`${name}: Image awaiting verification`} style={{display: 'grid', placeItems: 'center', height: frameHeight, background: '#f1f5f9', color: '#475569', textAlign: 'center'}}>Image awaiting verification</span>;
  }
  const subject = DOOR_IMAGE_SUBJECTS[src];
  if (subject) {
    const bandWidth = subject.x1 - subject.x0;
    const bandHeight = subject.y1 - subject.y0;
    const ratio = (bandWidth * subject.width) / (bandHeight * subject.height);
    return (
      <span className={classes} style={{display: 'block', width: '100%'}}>
        <span
          role="img"
          aria-label={name}
          style={{
            display: 'block',
            margin: '0 auto',
            width: `min(100%, calc(${frameHeight} * ${ratio.toFixed(4)}))`,
            aspectRatio: ratio.toFixed(4),
            backgroundImage: `url("${src}")`,
            backgroundRepeat: 'no-repeat',
            backgroundSize: `${(100 / bandWidth).toFixed(3)}% ${(100 / bandHeight).toFixed(3)}%`,
            backgroundPosition: `${bandWidth < 1 ? (subject.x0 / (1 - bandWidth) * 100).toFixed(3) : 0}% ${bandHeight < 1 ? (subject.y0 / (1 - bandHeight) * 100).toFixed(3) : 0}%`,
          }}
        />
        <img src={src} alt="" hidden onError={() => setFailed(src)} />
      </span>
    );
  }
  return (
    <span className={classes} style={{display: 'block', width: '100%'}}>
      <img src={src} alt={name} loading="lazy" decoding="async" onError={() => setFailed(src)} style={{display: 'block', width: '100%', height: frameHeight, objectFit: 'contain', objectPosition: 'center'}} />
    </span>
  );
}
