filepath = r'd:/dev/funnel-builder-clean/pages/modules/social_media/calendar-day.js'
with open(filepath, encoding='utf-8') as f:
    lines = f.readlines()

changes = 0

for i, line in enumerate(lines):

    # Icon box border/bg → teal
    if "background: 'rgba(251,146,60,0.25)', border: '1px solid rgba(251,146,60,0.5)'" in line:
        lines[i] = line.replace(
            "background: 'rgba(251,146,60,0.25)', border: '1px solid rgba(251,146,60,0.5)'",
            "background: 'rgba(56,189,248,0.2)', border: '1px solid rgba(56,189,248,0.5)'"
        )
        print(f"Icon box: line {i+1}"); changes += 1

    # Subtitle colour → sky blue
    if "color: '#FDBA74', margin: '2px 0 0'" in line:
        lines[i] = line.replace("color: '#FDBA74'", "color: '#7DD3FC'")
        print(f"Subtitle: line {i+1}"); changes += 1

    # Button styles → teal (may appear on multiple lines, do all)
    if "rgba(251,146,60,0.45)', background: 'rgba(251,146,60,0.18)', color: '#FED7AA'" in line:
        lines[i] = line.replace(
            "rgba(251,146,60,0.45)', background: 'rgba(251,146,60,0.18)', color: '#FED7AA'",
            "rgba(56,189,248,0.4)', background: 'rgba(56,189,248,0.15)', color: '#BAE6FD'"
        )
        print(f"Button: line {i+1}"); changes += 1

    # Stripe colours → two solid pale-blue tones
    if "'#0e2440' : '#080c1a'" in line:
        lines[i] = line.replace("'#0e2440' : '#080c1a'", "'#0d2137' : '#091929'")
        print(f"Stripe: line {i+1}"); changes += 1

    # Hour label span → smaller, AM/PM
    if "fontSize: 18, fontWeight: 900, color: hasItems ? '#E2E8F0' : '#4B5563'" in line:
        lines[i] = line.replace(
            "fontSize: 18, fontWeight: 900, color: hasItems ? '#E2E8F0' : '#4B5563'",
            "fontSize: 13, fontWeight: 700, color: hasItems ? '#E2E8F0' : '#374151'"
        )
        print(f"Hour span style: line {i+1}"); changes += 1

    # Hour value → 12h AM/PM
    if "{String(hour).padStart(2, '0')}:00" in line:
        lines[i] = line.replace(
            "{String(hour).padStart(2, '0')}:00",
            "{hour === 0 ? '12' : hour > 12 ? String(hour - 12) : String(hour)}:00 {hour < 12 ? 'am' : 'pm'}"
        )
        print(f"Hour value: line {i+1}"); changes += 1

    # timeStr → 12h with AM/PM
    if "toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit', hour12: false })" in line:
        lines[i] = line.replace(
            "toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit', hour12: false })",
            "toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })"
        )
        print(f"timeStr: line {i+1}"); changes += 1

print(f"\nTotal changes: {changes}")
with open(filepath, 'w', encoding='utf-8') as f:
    f.writelines(lines)
print("Done!")
