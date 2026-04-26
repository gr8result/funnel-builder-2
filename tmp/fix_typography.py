import re

filepath = r'd:/dev/funnel-builder-clean/pages/modules/social_media/calendar-day.js'
with open(filepath, encoding='utf-8') as f:
    src = f.read()

# ── 1. Add PLATFORM_SVGS if missing ──────────────────────────────────────────
if 'PLATFORM_SVGS' not in src:
    svgs = """
const PLATFORM_SVGS = {
  facebook:  (c) => <svg viewBox="0 0 24 24" width="26" height="26" fill={c}><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>,
  instagram: (c) => <svg viewBox="0 0 24 24" width="26" height="26" fill={c}><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/></svg>,
  linkedin:  (c) => <svg viewBox="0 0 24 24" width="26" height="26" fill={c}><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>,
  x:         (c) => <svg viewBox="0 0 24 24" width="26" height="26" fill={c}><path d="M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.638 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 7.184zm-1.161 19.52h2.04L6.29 3.24H4.11z"/></svg>,
  tiktok:    (c) => <svg viewBox="0 0 24 24" width="26" height="26" fill={c}><path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z"/></svg>,
  youtube:   (c) => <svg viewBox="0 0 24 24" width="26" height="26" fill={c}><path d="M23.495 6.205a3.007 3.007 0 00-2.088-2.088c-1.87-.501-9.396-.501-9.396-.501s-7.507-.01-9.396.501A3.007 3.007 0 00.527 6.205a31.247 31.247 0 00-.522 5.805 31.247 31.247 0 00.522 5.783 3.007 3.007 0 002.088 2.088c1.868.502 9.396.502 9.396.502s7.506 0 9.396-.502a3.007 3.007 0 002.088-2.088 31.247 31.247 0 00.5-5.783 31.247 31.247 0 00-.5-5.805zM9.609 15.601V8.408l6.264 3.602z"/></svg>,
  pinterest: (c) => <svg viewBox="0 0 24 24" width="26" height="26" fill={c}><path d="M12 0C5.373 0 0 5.373 0 12c0 5.084 3.163 9.426 7.627 11.174-.105-.949-.2-2.405.042-3.441.218-.937 1.407-5.965 1.407-5.965s-.359-.719-.359-1.782c0-1.668.967-2.914 2.171-2.914 1.023 0 1.518.769 1.518 1.69 0 1.029-.655 2.568-.994 3.995-.283 1.194.599 2.169 1.777 2.169 2.133 0 3.772-2.249 3.772-5.495 0-2.873-2.064-4.882-5.012-4.882-3.414 0-5.418 2.561-5.418 5.207 0 1.031.397 2.138.893 2.738a.36.36 0 01.083.345l-.333 1.36c-.053.22-.174.267-.402.161-1.499-.698-2.436-2.889-2.436-4.649 0-3.785 2.75-7.262 7.929-7.262 4.163 0 7.398 2.967 7.398 6.931 0 4.136-2.607 7.464-6.227 7.464-1.216 0-2.359-.632-2.75-1.378l-.748 2.853c-.271 1.043-1.002 2.35-1.492 3.146C9.57 23.812 10.763 24 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0z"/></svg>,
};
"""
    src = src.replace('\nfunction pm(platform)', svgs + '\nfunction pm(platform)', 1)
    print("PLATFORM_SVGS: added")

# ── 2. Add filterPlatform state if missing ────────────────────────────────────
if 'filterPlatform' not in src:
    src = src.replace(
        "  const [publishing, setPublishing]   = useState('');",
        "  const [publishing, setPublishing]   = useState('');\n  const [filterPlatform, setFilterPlatform] = useState(null);"
    )
    print("filterPlatform: added")

# ── 3. Wire filteredPosts if missing ─────────────────────────────────────────
if 'filteredPosts' not in src:
    src = src.replace(
        "          ) : (() => {\n            const postHours",
        "          ) : (() => {\n            const filteredPosts = filterPlatform ? posts.filter(p => p.platform === filterPlatform) : posts;\n            const postHours"
    )
    src = src.replace(
        "            const postHours = posts.map(",
        "            const postHours = filteredPosts.map("
    )
    src = src.replace(
        "              const postsAtHour = posts.filter(",
        "              const postsAtHour = filteredPosts.filter("
    )
    print("filteredPosts: wired")

# ── 4. Subtitle: appropriate text, white, 18px ───────────────────────────────
src = src.replace(
    """              <p style={{ fontSize: 18, color: '#A78BFA', margin: '2px 0 0' }}>
                {loading ? 'Loading posts\u2026' : posts.length > 0
                  ? `${posts.length} post${posts.length !== 1 ? 's' : ''} across ${[...new Set(posts.map(p => p.platform))].length} platform${[...new Set(posts.map(p => p.platform))].length !== 1 ? 's' : ''}`
                  : 'No posts scheduled for this day'}
              </p>""",
    """              <p style={{ fontSize: 18, color: '#ffffff', margin: '2px 0 0', fontWeight: 400 }}>
                {loading ? 'Loading\u2026' : `Schedule and review posts for ${date.toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long' })}`}
              </p>"""
)
print("subtitle: updated")

# ── 5. All fontSize < 16 → 16 (via regex on the full source) ─────────────────
def fix_fontsize(m):
    val = int(m.group(1))
    if val < 16:
        return f'fontSize: 16'
    return m.group(0)

src = re.sub(r'fontSize:\s*(\d+)', fix_fontsize, src)
print("font sizes: fixed")

# ── 6. All fontWeight > 600 → 600 ────────────────────────────────────────────
def fix_weight(m):
    val = int(m.group(1))
    if val > 600:
        return 'fontWeight: 600'
    return m.group(0)

src = re.sub(r'fontWeight:\s*(\d+)', fix_weight, src)
print("font weights: fixed")

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(src)
print("\nDone!")
