path = r'd:\dev\funnel-builder-clean\pages\modules\social_media\calendar.js'
with open(path, 'r', encoding='utf-8') as f:
    c = f.read()

R = '\ufffd'

# Range label separator  (– en dash)
c = c.replace(f' {R} ', ' \u2013 ')

# Left nav arrow (first occurrence of the identical style + replacement char)
old_left  = "color: '#E9D5FF', fontWeight: 700, fontSize: 16, cursor: 'pointer' }}>" + R + "</button>"
new_left  = "color: '#E9D5FF', fontWeight: 700, fontSize: 16, cursor: 'pointer' }}>\u2190</button>"
c = c.replace(old_left, new_left, 1)

# Right nav arrow (second occurrence)
old_right = "color: '#E9D5FF', fontWeight: 700, fontSize: 16, cursor: 'pointer' }}>" + R + "</button>"
new_right = "color: '#E9D5FF', fontWeight: 700, fontSize: 16, cursor: 'pointer' }}>\u2192</button>"
c = c.replace(old_right, new_right, 1)

# Refresh button (literal ASCII ?)
c = c.replace("color: '#6EE7B7', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>?</button>",
              "color: '#6EE7B7', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>\u21ba</button>")

# Review Posts button (literal ASCII ?)
c = c.replace('>? Review Posts</button>', '>Review Posts</button>')

# Comments
c = c.replace(R + ' circle', ' circle')
c = c.replace(R + ' side-by-side', ' side-by-side')

# Stats separator
c = c.replace('<span>' + R + '</span>', '<span>\u00b7</span>')

with open(path, 'w', encoding='utf-8') as f:
    f.write(c)

print('Done')
remaining = [i+1 for i,l in enumerate(c.splitlines()) if R in l]
print('Remaining replacement chars on lines:', remaining)
