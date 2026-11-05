import { useEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';

// Keep page geometry for scrolling, but release offscreen tables and decoded images.
// Native printing temporarily mounts every page; the PDF generator is independent.
export default function LazySchedulePage({ renderPage, ...props }) {
  const frame = useRef(null);
  const [visible, setVisible] = useState(false);
  const [printing, setPrinting] = useState(false);
  useEffect(() => {
    if (!globalThis.IntersectionObserver) { setVisible(true); return; }
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), { rootMargin: '600px 0px' });
    observer.observe(frame.current);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    const before = () => flushSync(() => setPrinting(true));
    const after = () => setPrinting(false);
    window.addEventListener('beforeprint', before);
    window.addEventListener('afterprint', after);
    return () => { window.removeEventListener('beforeprint', before); window.removeEventListener('afterprint', after); };
  }, []);
  return <div {...props} ref={frame} style={{ width: '100%', minHeight: 0, aspectRatio: '297 / 210' }} data-schedule-mounted={visible || printing ? 'true' : 'false'}>
    {visible || printing ? renderPage() : null}
  </div>;
}
