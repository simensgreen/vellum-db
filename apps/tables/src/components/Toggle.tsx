export function Toggle({
  checked,
  onCheckedChange,
  disabled = false,
  ariaLabel,
}: {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  ariaLabel?: string;
}) {
  return (
    <span class="v-toggle">
      <input
        type="checkbox"
        role="switch"
        checked={checked}
        disabled={disabled}
        aria-label={ariaLabel}
        onChange={(event) =>
          onCheckedChange((event.target as HTMLInputElement).checked)
        }
      />
      <span class="v-toggle-track" aria-hidden="true" />
    </span>
  );
}
