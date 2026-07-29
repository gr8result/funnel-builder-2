import { STANDARD_INCLUSION_TIERS } from "../tiers/standardInclusionTiers";

type Props = {
  value?: string;
  inheritingCount: number;
  overriddenCount: number;
  onChange: (tierId: string) => void;
  onPreview: () => void;
  onReset: () => void;
};

export function ProjectTierSelector({ value, inheritingCount, overriddenCount, onChange, onPreview, onReset }: Props) {
  return (
    <section className="panel projectDefaultPanel" aria-labelledby="project-default-title">
      <div className="panelHead">
        <div>
          <h2 id="project-default-title">Whole-Project Default</h2>
          <p>Choose the inherited inclusion tier for areas without a closer override.</p>
        </div>
      </div>
      <div className="tierGrid">
        {STANDARD_INCLUSION_TIERS.map((tier) => (
          <button type="button" key={tier.id} className={value === tier.id ? "tierOption selected" : "tierOption"} onClick={() => onChange(tier.id)}>
            <strong>{tier.name}</strong>
            <span>{tier.description}</span>
          </button>
        ))}
        <button type="button" className="tierOption" onClick={onPreview}>
          <strong>Saved Builder Template</strong>
          <span>Apply an organisation-scoped saved configuration after preview.</span>
        </button>
      </div>
      <div className="defaultStats">
        <span>Source: Project Default</span>
        <span>{inheritingCount} inheriting</span>
        <span>{overriddenCount} overridden</span>
      </div>
      <div className="rowActions">
        <button type="button" onClick={onPreview}>Preview Effect</button>
        <button type="button" onClick={onReset}>Reset Project Default</button>
      </div>
    </section>
  );
}
