filepath = r'd:/dev/funnel-builder-clean/pages/modules/social_media/calendar-day.js'
with open(filepath, encoding='utf-8') as f:
    src = f.read()

orig_len = len(src)

# ── 1. Add filterPlatform state ──────────────────────────────────────────────
old = "  const [publishing, setPublishing]   = useState('');"
new = "  const [publishing, setPublishing]   = useState('');\n  const [filterPlatform, setFilterPlatform] = useState(null);"
src = src.replace(old, new, 1)

# ── 2. Platform chips → icon-only, clickable ─────────────────────────────────
old = """              {[...new Set(posts.map(p => p.platform))].map(plat => {
                const meta = pm(plat);
                const cnt  = posts.filter(p => p.platform === plat).length;
                return (
                  <div key={plat} style={{ display: 'flex', alignItems: 'center', gap: 5, background: meta.color, borderRadius: 20, padding: '6px 14px' }}>
                    <span style={{ fontSize: 16 }}>{meta.icon}</span>
                    <span style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>{meta.label}</span>
                    <span style={{ fontSize: 12, fontWeight: 900, color: '#fff', background: 'rgba(0,0,0,0.25)', borderRadius: 10, padding: '1px 7px', marginLeft: 2 }}>{cnt}</span>
                  </div>
                );
              })}"""
new = """              {[...new Set(posts.map(p => p.platform))].map(plat => {
                const meta = pm(plat);
                const cnt  = posts.filter(p => p.platform === plat).length;
                const isActive = filterPlatform === plat;
                return (
                  <button key={plat}
                    onClick={() => setFilterPlatform(isActive ? null : plat)}
                    title={isActive ? `Clear filter (showing all)` : `Show only ${meta.label}`}
                    style={{ display: 'flex', alignItems: 'center', gap: 6, background: isActive ? meta.color : `${meta.color}55`, border: `2px solid ${isActive ? meta.color : 'transparent'}`, borderRadius: 20, padding: '7px 12px', cursor: 'pointer', outline: 'none', transition: 'all 0.15s', boxShadow: isActive ? `0 0 14px ${meta.color}99` : 'none' }}>
                    <span style={{ fontSize: 22, lineHeight: 1 }}>{meta.icon}</span>
                    <span style={{ fontSize: 12, fontWeight: 900, color: '#fff', background: 'rgba(0,0,0,0.3)', borderRadius: 10, padding: '1px 7px' }}>{cnt}</span>
                  </button>
                );
              })}"""
before2 = len(src)
src = src.replace(old, new, 1)
print("Chips:", "OK" if len(src) != before2 else "MISS")

# ── 3. Add filteredPosts & wire up filter to postsAtHour ─────────────────────
old = """            return Array.from({ length: maxH - minH + 1 }, (_, i) => i + minH).map((hour, rowIdx) => {
              const postsAtHour = posts.filter(p => p.scheduledFor ? new Date(p.scheduledFor).getHours() === hour : false);"""
new = """            const filteredPosts = filterPlatform ? posts.filter(p => p.platform === filterPlatform) : posts;
            return Array.from({ length: maxH - minH + 1 }, (_, i) => i + minH).map((hour, rowIdx) => {
              const postsAtHour = filteredPosts.filter(p => p.scheduledFor ? new Date(p.scheduledFor).getHours() === hour : false);"""
before3 = len(src)
src = src.replace(old, new, 1)
print("Filter:", "OK" if len(src) != before3 else "MISS")

# ── 4. Card image → tall portrait aspect ratio ───────────────────────────────
old = """                          {/* Image */}
                          <div style={{ position: 'relative', paddingBottom: '56%', background: '#f8fafc' }}>"""
new = """                          {/* Image */}
                          <div style={{ position: 'relative', paddingBottom: '115%', background: '#f8fafc' }}>"""
before4 = len(src)
src = src.replace(old, new, 1)
print("Image height:", "OK" if len(src) != before4 else "MISS")

print(f"\nNet delta: {len(src) - orig_len} chars")
with open(filepath, 'w', encoding='utf-8') as f:
    f.write(src)
print("Written.")
