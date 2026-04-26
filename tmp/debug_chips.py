filepath = r'd:/dev/funnel-builder-clean/pages/modules/social_media/calendar-day.js'
with open(filepath, encoding='utf-8') as f:
    src = f.read()
lines = src.split('\n')
for i in range(223, 246):
    print(i+1, repr(lines[i]))
