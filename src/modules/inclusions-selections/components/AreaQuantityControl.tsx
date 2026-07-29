type Props = {
  quantity: number;
  disabled?: boolean;
  onChange: (quantity: number) => void;
};

export function AreaQuantityControl({ quantity, disabled = false, onChange }: Props) {
  return (
    <div className="quantityControl">
      <button type="button" disabled={disabled || quantity <= 0} onClick={() => onChange(Math.max(0, quantity - 1))} aria-label="Decrease quantity">
        -
      </button>
      <input
        type="number"
        min={0}
        value={quantity}
        disabled={disabled}
        onChange={(event) => onChange(Number(event.target.value || 0))}
        aria-label="Area quantity"
      />
      <button type="button" disabled={disabled} onClick={() => onChange(quantity + 1)} aria-label="Increase quantity">
        +
      </button>
    </div>
  );
}
