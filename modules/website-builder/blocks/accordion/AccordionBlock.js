import React from "react";
import { FaArrowDown, FaArrowRight } from "react-icons/fa";
import { resolveAssetField } from "../../../../lib/website-builder/mediaAssets";
import { MIN_TEXT_SIZE, asArray, ScrollReveal } from "../../../../components/website-builder/website-renderer/wbAnimations";
import {
  colorWithAlpha,
  asStyleObject,
  asRichHtml,
  headingTypography,
  spacingMultiplier,
  scaleBoxPadding,
  sharedStyles,
} from "../../../../components/website-builder/website-renderer/wbVariantStyles";
import { cleanInlineEditorHtml } from "../../utils/inlineHtml";

export function FAQAccordionItems({ items, compact, editor = false, props, openItems, onToggleItem, onPatchItem, propPrefix = "items" }) {
  const sourceSplitVariant = props.faqVariant === "source-split";
  const sourceHeaderBackground = "linear-gradient(34deg, rgba(13, 141, 222, 0.2), rgba(8, 140, 202, 0.09))";
  const sourceArrowBackground = props.arrowBackgroundColor || "linear-gradient(135deg, #163628 0%, #22c55e 52%, #bef264 100%)";
  return (
    <div style={sharedStyles.stack}>
      {items.map((item, idx) => {
        const isOpen = openItems.includes(idx);
        return (
          <ScrollReveal
            key={item.id || `${item.question}-${idx}`}
            animationName={sourceSplitVariant ? (props.faqAnimation || "fade-up") : "fade-up"}
            delay={(sourceSplitVariant ? Number(props.faqAnimationDelay || 0) : 0) + (idx * 0.06)}
            speed={sourceSplitVariant ? props.faqAnimationSpeed : undefined}
            disabled={editor}
            style={{
              ...sharedStyles.faqItem,
              ...(sourceSplitVariant ? {
                background: "rgba(3, 18, 28, 0.16)",
                border: `1px solid ${props.itemBorderColor || "rgba(0, 66, 96, 0.39)"}`,
                borderRadius: 15,
                overflow: "hidden",
                padding: 0,
                boxShadow: "0 10px 28px rgba(0,0,0,0.14)",
                gap: 0,
                marginBottom: 15,
              } : {
                background: props.itemBackgroundColor || sharedStyles.faqItem.background,
                border: `1px solid ${props.itemBorderColor || props.borderColor || "#cbd5e1"}`,
              }),
            }}
          >
            <div style={{
              ...sharedStyles.faqTrigger,
              ...(sourceSplitVariant ? {
                display: "grid",
                gridTemplateColumns: `${compact ? 36 : 40}px minmax(0, 1fr)`,
                alignItems: "center",
                gap: compact ? 14 : 20,
                padding: compact ? "20px" : "30px",
                background: sourceHeaderBackground,
              } : {}),
            }}>
              <button
                type="button"
                onClick={() => onToggleItem(idx)}
                style={{
                  ...sharedStyles.faqChevronButton,
                  color: props.chevronColor || "#2563eb",
                  ...(sourceSplitVariant ? {
                    width: compact ? 44 : 52,
                    height: compact ? 44 : 52,
                    alignSelf: "center",
                    justifySelf: "start",
                    flex: "0 0 auto",
                    borderRadius: 6,
                    background: sourceArrowBackground,
                    boxShadow: "0 12px 28px rgba(0,0,0,0.18)",
                  } : {}),
                }}
                aria-expanded={isOpen}
                aria-label={isOpen ? "Collapse FAQ item" : "Expand FAQ item"}
              >
                <span style={{ ...sharedStyles.faqChevron, color: sourceSplitVariant ? "#ffffff" : (props.chevronColor || "#2563eb"), ...(sourceSplitVariant ? { fontSize: compact ? 18 : 22, fontWeight: 600, lineHeight: 1, display: "inline-flex", alignItems: "center", justifyContent: "center" } : {}) }}>
                  {isOpen ? <FaArrowDown /> : <FaArrowRight />}
                </span>
              </button>
              <div
                data-website-inline-editor="true"
                data-text-prop={`${propPrefix}.${idx}.question`}
                contentEditable={editor}
                suppressContentEditableWarning
                onBlur={(event) => onPatchItem(idx, { question: cleanInlineEditorHtml(event.currentTarget.innerHTML) })}
                style={{
                  ...sharedStyles.faqQ,
                  color: props.questionColor || (sourceSplitVariant ? "#ffffff" : "#0f172a"),
                  fontSize: compact ? Math.max(17, Number(props.questionFontSize || 18) - 1) : Number(props.questionFontSize || 18),
                  fontWeight: props.questionFontWeight || (sourceSplitVariant ? "700" : "inherit"),
                  fontFamily: sourceSplitVariant ? "Poppins, sans-serif" : undefined,
                  lineHeight: props.questionLineHeight || (sourceSplitVariant ? "23.4px" : undefined),
                  letterSpacing: sourceSplitVariant ? "0.3px" : undefined,
                  outline: editor ? "1px dashed rgba(14,165,233,0.35)" : "none",
                  borderRadius: sourceSplitVariant ? 10 : 8,
                  padding: editor ? "4px 6px" : 0,
                  flex: 1,
                  minWidth: 0,
                  cursor: editor ? "text" : "default",
                  boxSizing: "border-box",
                }}
                dangerouslySetInnerHTML={{ __html: asRichHtml(item.question) }}
              />
            </div>
            {isOpen ? (
              <div
                data-website-inline-editor="true"
                data-text-prop={`${propPrefix}.${idx}.answer`}
                contentEditable={editor}
                suppressContentEditableWarning
                onBlur={(event) => onPatchItem(idx, { answer: cleanInlineEditorHtml(event.currentTarget.innerHTML) })}
                style={{
                  ...sharedStyles.faqA,
                  color: props.answerColor || props.textColor || "#475569",
                  fontSize: compact ? Math.max(12, Number(props.answerFontSize || MIN_TEXT_SIZE) - 1) : Number(props.answerFontSize || MIN_TEXT_SIZE),
                  outline: editor ? "1px dashed rgba(14,165,233,0.35)" : "none",
                  borderRadius: sourceSplitVariant ? 15 : 8,
                  padding: editor ? "6px 8px" : (sourceSplitVariant ? "30px" : 0),
                  ...(sourceSplitVariant ? {
                    borderTop: `1px solid ${props.itemBorderColor || "rgba(0, 66, 96, 0.39)"}`,
                    fontFamily: "Inter, sans-serif",
                    lineHeight: props.answerLineHeight || "28.8px",
                    background: "rgba(2, 12, 18, 0.34)",
                  } : {}),
                }}
                dangerouslySetInnerHTML={{ __html: asRichHtml(item.answer) }}
              />
            ) : null}
          </ScrollReveal>
        );
      })}
    </div>
  );
}

export function FAQAccordionBlock({ props, compact, editor = false, onChangeBlock, sectionAnimationStyle, assets }) {
  const sourceItems = asArray(props.items).map((item, idx) => {
    const question = item?.question || item?.heading || item?.q || `Question ${idx + 1}`;
    const answer = item?.answer || item?.content || item?.a || "Answer";
    return {
      ...item,
      id: item?.id || `faq-item-${idx}`,
      question,
      answer,
      heading: question,
      content: answer,
    };
  });
  const items = sourceItems;
  const faqBackgroundImage = resolveAssetField(props, "backgroundImage", assets);
  const [openItems, setOpenItems] = React.useState(() => {
    if (props.faqStartCollapsed) return [];
    return items.length ? [0] : [];
  });
  const allowMultipleOpen = !!props.faqAllowMultipleOpen;

  React.useEffect(() => {
    if (!items.length) {
      setOpenItems([]);
      return;
    }
    setOpenItems((current) => {
      const next = current.filter((idx) => idx >= 0 && idx < items.length);
      if (next.length) return next;
      return props.faqStartCollapsed ? [] : [0];
    });
  }, [items.length, props.faqStartCollapsed]);

  function toggleItem(itemIndex) {
    setOpenItems((current) => {
      const isOpen = current.includes(itemIndex);
      if (allowMultipleOpen) {
        return isOpen ? current.filter((idx) => idx !== itemIndex) : [...current, itemIndex];
      }
      if (isOpen) return [];
      return [itemIndex];
    });
  }

  function patchItem(itemIndex, patch) {
    if (!editor || typeof onChangeBlock !== "function") return;
    const nextItems = sourceItems.map((item, currentIndex) => {
      if (currentIndex !== itemIndex) return item;
      const nextQuestion = patch.question ?? item.question;
      const nextAnswer = patch.answer ?? item.answer;
      return {
        ...item,
        question: nextQuestion,
        heading: nextQuestion,
        answer: nextAnswer,
        content: nextAnswer,
      };
    });
    onChangeBlock({ ...props, items: nextItems });
  }

  const faqOuterStyle = {
    width: "100%",
    borderRadius: compact ? 16 : 22,
    padding: compact ? "20px" : scaleBoxPadding("30px", spacingMultiplier(props)),
    background: props.blockBackgroundColor && props.blockBackgroundColor !== "transparent" ? props.blockBackgroundColor : "transparent",
    ...(faqBackgroundImage ? {
      backgroundImage: `linear-gradient(180deg, ${colorWithAlpha(props.blockBackgroundColor || "#0f172a", props.blockBackgroundColor && props.blockBackgroundColor !== "transparent" ? (Number(props.backgroundOverlayOpacity ?? 55) / 100) : (Number(props.backgroundOverlayOpacity ?? 28) / 100))}, ${colorWithAlpha(props.blockBackgroundColor || "#0f172a", props.blockBackgroundColor && props.blockBackgroundColor !== "transparent" ? (Number(props.backgroundOverlayOpacity ?? 55) / 100) : (Number(props.backgroundOverlayOpacity ?? 28) / 100))}), url(${faqBackgroundImage})`,
      backgroundSize: props.backgroundSize || "cover",
      backgroundPosition: props.backgroundPosition || "center center",
      backgroundRepeat: props.backgroundRepeat || "no-repeat",
    } : {}),
  };

  const faqPanelStyle = {
    ...sharedStyles.cardSection(compact, { ...props, backgroundColor: props.faqPanelBackgroundColor || props.backgroundColor || "#ffffff" }),
    width: "100%",
    maxWidth: `${Math.max(320, Number(props.faqMaxWidth || 980))}px`,
    marginLeft: "auto",
    marginRight: "auto",
  };

  return (
    <ScrollReveal as="section" animationName={props.sectionAnimation || "fade-up"} delay={props.sectionAnimationDelay || 0.06} speed={props.sectionAnimationSpeed} disabled={editor} style={asStyleObject(faqOuterStyle)}>
      <div style={asStyleObject(faqPanelStyle)}>
      <h2
        data-website-inline-editor="true"
        data-text-prop="title"
        contentEditable={editor}
        suppressContentEditableWarning
        onBlur={(event) => {
          if (!editor || typeof onChangeBlock !== "function") return;
          onChangeBlock({ ...props, title: cleanInlineEditorHtml(event.currentTarget.innerHTML) });
        }}
        style={{
          ...sharedStyles.sectionTitle(compact),
          ...headingTypography(props),
          fontSize: compact ? Math.max(18, Number(props.headlineFontSize || 28) - 4) : Number(props.headlineFontSize || 28),
          color: props.headlineColor || headingTypography(props).color,
          outline: editor ? "1px dashed rgba(14,165,233,0.35)" : "none",
          borderRadius: 8,
          padding: editor ? "4px 6px" : 0,
        }}
        dangerouslySetInnerHTML={{ __html: asRichHtml(props.title || "Questions") }}
      />
      <FAQAccordionItems items={items} compact={compact} editor={editor} props={props} openItems={openItems} onToggleItem={toggleItem} onPatchItem={patchItem} propPrefix="items" />
      </div>
    </ScrollReveal>
  );
}
