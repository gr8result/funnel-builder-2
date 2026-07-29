import type { CategoryViewGroup } from "../services/selectionWorkspaceService";

export function CategoryNavigationPanel({ categories, selectedCategory, onSelectCategory }: { categories: CategoryViewGroup[]; selectedCategory?: string; onSelectCategory: (category: string) => void }) {
  return (
    <aside className="navPanel">
      <h2>Categories</h2>
      {categories.map((category) => (
        <button type="button" key={category.category} className={selectedCategory === category.category ? "navItem selected" : "navItem"} onClick={() => onSelectCategory(String(category.category))}>
          <strong>{category.label}</strong>
          <span>{category.completed}/{category.total} complete · {category.needsAttention} attention · ${category.variationTotal.toFixed(2)}</span>
        </button>
      ))}
    </aside>
  );
}
