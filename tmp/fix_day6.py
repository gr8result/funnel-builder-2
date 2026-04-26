filepath = r'd:/dev/funnel-builder-clean/pages/modules/social_media/calendar-day.js'
with open(filepath, encoding='utf-8') as f:
    src = f.read()

orig = len(src)
hits = {}

# ── 1. Add filteredPosts + wire postsAtHour ───────────────────────────────────
old1 = """          ) : (() => {
            return Array.from({ length: 24 }, (_, i) => i).map((hour, rowIdx) => {
              const postsAtHour = posts.filter(p => p.scheduledFor ? new Date(p.scheduledFor).getHours() === hour : false);"""
new1 = """          ) : (() => {
            const filteredPosts = filterPlatform ? posts.filter(p => p.platform === filterPlatform) : posts;
            return Array.from({ length: 24 }, (_, i) => i).map((hour, rowIdx) => {
              const postsAtHour = filteredPosts.filter(p => p.scheduledFor ? new Date(p.scheduledFor).getHours() === hour : false);"""
hits[1] = old1 in src
src = src.replace(old1, new1, 1)

# ── 2. Increase image height: 68 → 200 (portrait) ────────────────────────────
old2 = "          <div style={{ width: '100%', height: 68, overflow: 'hidden', position: 'relative', background: `${meta.color}20` }}>"
new2 = "          <div style={{ width: '100%', height: 200, overflow: 'hidden', position: 'relative', background: `${meta.color}20` }}>"
hits[2] = old2 in src
src = src.replace(old2, new2, 1)

# ── 3. Show more caption lines (3→5) ─────────────────────────────────────────
old3 = "WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}"
new3 = "WebkitLineClamp: 5, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}"
hits[3] = old3 in src
src = src.replace(old3, new3, 1)

# ── 4. Make icon bigger when no image (was 26) ───────────────────────────────
old4 = ": <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26 }}>{meta.icon}</div>"
new4 = ": <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 52 }}>{meta.icon}</div>"
hits[4] = old4 in src
src = src.replace(old4, new4, 1)

for k, v in hits.items():
    print(f"  Change {k}: {'OK' if v else 'MISS'}")

print(f"\nDelta: {len(src)-orig} chars")
with open(filepath, 'w', encoding='utf-8') as f:
    f.write(src)
print("Done!")
