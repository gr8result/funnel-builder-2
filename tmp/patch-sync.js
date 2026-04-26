const fs = require('fs');
const path = require('path');
const filePath = path.join(__dirname, '..', 'components', 'email', 'editor', 'EditorLayout.jsx');
const content = fs.readFileSync(filePath, 'utf8');
const lines = content.split('\n');
console.log('total lines:', lines.length);

// Verify the range
console.log('line 1529 (0-idx 1528):', lines[1528]);
console.log('line 1626 (0-idx 1625):', lines[1625]);

const newBlock = `    // Walk GrapesJS component tree to match a live DOM element to its component.
    const findCompByEl = (rootComp, domEl) => {
      if (!rootComp || !domEl) return null;
      try {
        if (rootComp.getEl?.() === domEl) return rootComp;
        for (const child of (rootComp.components?.() || [])) {
          const found = findCompByEl(child, domEl);
          if (found) return found;
        }
      } catch {}
      return null;
    };

    const syncSelectedInspector = () => {
      if (socialSavingRef.current) return;
      if (buttonApplyingRef.current) return;

      const selComp = editor.getSelected?.();

      // Social icon (must be first)
      if (selComp) {
        let cursor = selComp;
        while (cursor) {
          const ctype = String(cursor.get?.('type') || '').toLowerCase();
          const cname = String(cursor.get?.('name') || '');
          const cel = cursor.getEl?.();
          const isSocial = ctype === 'social-icon' || cname === 'Social Icon' || cel?.hasAttribute?.('data-social-icon');
          if (isSocial) {
            const imgChild = cursor.components?.().at(0);
            const platform = imgChild?.getAttributes?.()?.alt || 'Social';
            selectedSocialCompRef.current = cursor;
            setSelectedSocialComp(cursor);
            setSelectedSocialPlatform(platform);
            setActiveInspector('social');
            activeInspectorRef.current = 'social';
            const currentHref = cursor.getAttributes?.()?.href || "";
            setSocialLinkDraft(currentHref === "#" ? "" : currentHref);
            return;
          }
          cursor = cursor.parent?.() || null;
        }
      }

      // Route from the exact DOM element the user clicked in the canvas iframe.
      // lastCanvasClickElRef is set by the mousedown listener attached to the iframe doc.
      const clickedEl = lastCanvasClickElRef.current;
      if (clickedEl) {
        lastCanvasClickElRef.current = null; // consume
        const wrapper = editor.getWrapper?.();
        let node = clickedEl;
        while (node && node.tagName) {
          const tag = node.tagName.toLowerCase();
          if (tag === 'img') {
            const comp = findCompByEl(wrapper, node) || resolveSelectedImageComponent(editor);
            if (comp) { enableImageCornerResize(comp); selectImageForEditing(comp, true); return; }
            break;
          }
          if (tag === 'a' || tag === 'button') {
            const bg = node.style?.backgroundColor || '';
            const hasBg = bg && bg !== 'transparent' && !bg.includes('rgba(0, 0, 0, 0)');
            if (hasBg || tag === 'button') {
              const comp = findCompByEl(wrapper, node);
              if (comp) { selectButtonForEditing(comp); return; }
            }
            break; // plain link — fall through to text
          }
          node = node.parentElement;
        }
        // Default: text inspector
        const textComp = resolveSelectedTextComponent(editor);
        if (textComp) { selectTextForEditing(textComp, true); return; }
        setActiveInspector(null);
        return;
      }

      // Programmatic selection — do not disturb the current active inspector
      if (activeInspectorRef.current) return;

      if (selComp) {
        const imageComp = resolveSelectedImageComponent(editor);
        if (imageComp) { selectImageForEditing(imageComp, true); return; }
        const textComp = resolveSelectedTextComponent(editor);
        if (textComp) { selectTextForEditing(textComp, true); return; }
      }
    };`;

// Replace lines 1528..1625 (0-indexed)
const before = lines.slice(0, 1528).join('\n');
const after = lines.slice(1626).join('\n');
const result = before + '\n' + newBlock + '\n' + after;
fs.writeFileSync(filePath, result, 'utf8');
const newLines = result.split('\n');
console.log('new total lines:', newLines.length);
console.log('new 1529:', newLines[1528]);
console.log('new 1530:', newLines[1529]);
