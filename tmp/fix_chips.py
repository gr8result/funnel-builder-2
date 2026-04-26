filepath = r'd:/dev/funnel-builder-clean/pages/modules/social_media/calendar-day.js'
with open(filepath, encoding='utf-8') as f:
    src = f.read()

# Build old/new by joining exact lines
old_lines = [
    '          {!loading && (',
    "            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>",
    '              {[...new Set(posts.map(p => p.platform))].map(plat => {',
    '                const meta = pm(plat);',
    '                const cnt  = posts.filter(p => p.platform === plat).length;',
    '                const isActive = filterPlatform === plat;',
    '                return (',
    '                  <button key={plat}',
    '                    onClick={() => setFilterPlatform(isActive ? null : plat)}',
    '                    title={isActive ? `Clear filter (showing all)` : `Show only ${meta.label}`}',
    "                    style={{ display: 'flex', alignItems: 'center', gap: 6, background: isActive ? meta.color : `${meta.color}55`, border: `2px solid ${isActive ? meta.color : 'transparent'}`, borderRadius: 20, padding: '7px 12px', cursor: 'pointer', outline: 'none', transition: 'all 0.15s', boxShadow: isActive ? `0 0 14px ${meta.color}99` : 'none' }}>",
    '                    <span style={{ fontSize: 22, lineHeight: 1 }}>{meta.icon}</span>',
    "                    <span style={{ fontSize: 12, fontWeight: 900, color: '#fff', background: 'rgba(0,0,0,0.3)', borderRadius: 10, padding: '1px 7px' }}>{cnt}</span>",
    '                  </button>',
    '                );',
    '              })}',
    '            </div>',
    '          )}',
]
old = '\n'.join(old_lines)

new_lines = [
    '          {!loading && (',
    "            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>",
    '              {Object.keys(PLATFORM_META).map(plat => {',
    '                const meta    = pm(plat);',
    '                const cnt     = posts.filter(p => p.platform === plat).length;',
    '                const isActive = filterPlatform === plat;',
    '                const SvgIcon = PLATFORM_SVGS[plat];',
    '                return (',
    '                  <button key={plat}',
    '                    onClick={() => cnt > 0 ? setFilterPlatform(isActive ? null : plat) : null}',
    '                    title={cnt > 0 ? (isActive ? `Clear filter` : `Filter: ${meta.label} (${cnt})`) : meta.label}',
    "                    style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, background: isActive ? meta.color : cnt > 0 ? `${meta.color}28` : 'rgba(255,255,255,0.04)', border: `2px solid ${isActive ? meta.color : cnt > 0 ? `${meta.color}77` : 'rgba(255,255,255,0.08)'}`, borderRadius: 14, padding: '10px 14px', cursor: cnt > 0 ? 'pointer' : 'default', outline: 'none', transition: 'all 0.15s', minWidth: 58, boxShadow: isActive ? `0 0 20px ${meta.color}99` : 'none', opacity: cnt === 0 ? 0.3 : 1 }}>",
    "                    {SvgIcon ? SvgIcon(isActive ? '#fff' : cnt > 0 ? meta.color : '#6b7280') : <span style={{ fontSize: 28 }}>{meta.icon}</span>}",
    '                    {cnt > 0 && (',
    "                      <span style={{ fontSize: 16, fontWeight: 900, color: isActive ? '#fff' : meta.color, lineHeight: 1 }}>{cnt}</span>",
    '                    )}',
    '                  </button>',
    '                );',
    '              })}',
    '            </div>',
    '          )}',
]
new = '\n'.join(new_lines)

print('Found old:', old in src)
if old in src:
    src = src.replace(old, new, 1)
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(src)
    print('Done!')
else:
    print('MISS - checking line endings...')
    print(repr(src[src.find('{!loading'):src.find('{!loading')+50]))
