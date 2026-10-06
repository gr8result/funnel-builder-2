import { useRef, useState } from "react";

export default function GarageDoorChoiceGrid({ title, items, selected, onSelect, variant = "default" }) {
  const dialog = useRef(null);
  const [enlarged, setEnlarged] = useState(null);
  const [failedImages, setFailedImages] = useState({});

  function enlarge(item) {
    setEnlarged(item);
    dialog.current?.showModal();
  }

  return (
    <section className={`doorChoices ${variant}`} data-testid={`garage-${variant}-choices`}>
      <h3>{title}</h3>
      {variant === "profile" ? <p>Compare the panel lines and design details. Open a larger image for a closer look.</p> : null}
      <div className="doorChoiceCards">
        {items.map((item) => {
          const hasImage = item.image && !failedImages[item.image];
          return (
            <article key={item.key} className={selected === item.key ? "chosen" : ""}>
              <button type="button" className="chooseDoor" data-garage-choice={item.key} aria-pressed={selected === item.key} onClick={() => onSelect(item.key)}>
                {hasImage ? <img src={item.image} alt={variant === "supplier" ? `${item.title} logo` : `${item.title} garage door`} loading="lazy" onError={() => setFailedImages((current) => ({ ...current, [item.image]: true }))} /> : variant !== "default" ? <div className="missingImage">{variant === "supplier" ? item.title : "Profile image unavailable"}</div> : null}
                <div className="doorChoiceDetails"><strong>{item.title}</strong><span>{item.meta}</span>{item.detail ? <p>{item.detail}</p> : null}<b>{selected === item.key ? "Selected" : "Choose this " + (variant === "supplier" ? "supplier" : variant === "profile" ? "profile" : "option")}</b></div>
              </button>
              {variant === "profile" && hasImage ? <button type="button" className="enlargeDoor" aria-label={`View larger image of ${item.title}`} onClick={() => enlarge(item)}>View larger image</button> : null}
            </article>
          );
        })}
      </div>
      {!items.length ? <p>No options are available for this supplier and range.</p> : null}
      <dialog ref={dialog} aria-label={enlarged ? `${enlarged.title} profile image` : "Profile image"} onClick={(event) => { if (event.target === dialog.current) dialog.current.close(); }}>
        <div className="imageDialogHeader"><strong>{enlarged?.title}</strong><button type="button" onClick={() => dialog.current.close()}>Close</button></div>
        {enlarged ? <img className="enlargedImage" src={enlarged.image} alt={`${enlarged.title} garage door profile`} /> : null}
        <p>{enlarged?.meta}</p>
      </dialog>
      <style jsx>{`
        .doorChoices { display: grid; gap: 14px; min-width: 0; }
        h3 { margin: 0; font-size: 22px; color: #102033; }
        p { margin: 0; color: #64748b; line-height: 1.5; }
        .doorChoiceCards { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 260px), 1fr)); gap: 18px; }
        .profile .doorChoiceCards { grid-template-columns: repeat(2, minmax(0, 1fr)); }
        /* Half-width supplier cards: four fit a standard panel, and extra suppliers wrap.
           auto-fill, not auto-fit: with only two suppliers on file auto-fit collapses the
           empty tracks and stretches both cards across the panel, which is what made the
           list look full. auto-fill keeps the empty columns so new suppliers slot straight in. */
        .supplier .doorChoiceCards { grid-template-columns: repeat(auto-fill, minmax(min(100%, 230px), 1fr)); }
        article { min-width: 0; display: flex; flex-direction: column; border: 1px solid #cbd5e1; border-radius: 10px; background: #fff; overflow: hidden; }
        article.chosen { border-color: #0f766e; box-shadow: 0 0 0 3px rgba(15, 118, 110, .45); background: #ecfdf5; }
        button { cursor: pointer; font: inherit; }
        .chooseDoor { display: flex; flex-direction: column; flex: 1; width: 100%; min-width: 0; padding: 0; border: 0; border-radius: 0; background: transparent; color: #102033; text-align: left; }
        .chooseDoor:hover { background: #f0fdfa; }
        article.chosen .chooseDoor:hover { background: #ecfdf5; }
        button:focus-visible { outline: 3px solid #0f766e; outline-offset: -4px; }
        .chooseDoor img { box-sizing: border-box; display: block; width: 100%; height: 220px; padding: 12px; object-fit: contain; background: #fff; border-bottom: 1px solid #e2e8f0; }
        .profile .chooseDoor img { height: clamp(240px, 22vw, 340px); padding: 8px; }
        .supplier .chooseDoor img { height: 132px; padding: 18px; }
        .missingImage { display: grid; place-items: center; width: 100%; min-height: 160px; background: #f8fafc; color: #64748b; }
        .doorChoiceDetails { display: grid; gap: 8px; padding: 16px; }
        strong { font-size: 20px; line-height: 1.3; }
        span { color: #64748b; font-size: 16px; }
        /* The status line is a pill so a chosen card reads as selected at a glance,
           and the tick carries the state for anyone who cannot rely on colour. */
        b { justify-self: start; display: inline-flex; align-items: center; gap: 6px; padding: 5px 11px; border: 1px solid #cbd5e1; border-radius: 999px; background: #f1f5f9; color: #475569; font-size: 16px; font-weight: 800; }
        article.chosen b { border-color: #0f766e; background: #0f766e; color: #fff; }
        article.chosen b::before { content: "✓"; font-weight: 900; }
        .enlargeDoor { margin: 0 16px 16px; padding: 10px 12px; border: 1px solid #cbd5e1; border-radius: 6px; color: #0f766e; background: #fff; font-weight: 700; }
        dialog { box-sizing: border-box; width: min(1200px, 94vw); max-height: 92vh; padding: 20px; border: 0; border-radius: 12px; background: white; color: #102033; }
        dialog::backdrop { background: rgba(15, 23, 42, .65); }
        .imageDialogHeader { display: flex; align-items: center; justify-content: space-between; gap: 16px; margin-bottom: 16px; }
        .imageDialogHeader button { padding: 8px 18px; background: white; border: 1px solid #cbd5e1; border-radius: 6px; }
        .enlargedImage { display: block; width: 100%; max-height: 70vh; object-fit: contain; }
        @media (max-width: 760px) { .profile .doorChoiceCards { grid-template-columns: 1fr; } .profile .chooseDoor img { height: 260px; } }
      `}</style>
    </section>
  );
}
