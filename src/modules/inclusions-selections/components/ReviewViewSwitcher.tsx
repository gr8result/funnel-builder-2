import type { ReviewView } from "../repositories/selectionReviewRepository";

const views: Array<[ReviewView, string]> = [["summary", "Summary"], ["room", "By Room"], ["category", "By Category"], ["variations", "Variations"], ["issues", "Issues"], ["custom", "Custom Selections"]];

export function ReviewViewSwitcher({ value, onChange }: { value: ReviewView; onChange: (view: ReviewView) => void }) {
  return <nav className="reviewViewSwitcher">{views.map(([view, label]) => <button key={view} type="button" className={value === view ? "selected" : ""} onClick={() => onChange(view)}>{label}</button>)}</nav>;
}
