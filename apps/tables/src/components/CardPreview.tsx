export function CardPreview() {
  return (
    <div class="card-preview">
      <svg
        class="card-preview__icon"
        viewBox="0 0 64 64"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <rect
          x="8"
          y="12"
          width="48"
          height="40"
          rx="4"
          stroke="currentColor"
          stroke-width="2"
        />
        <line x1="8" y1="24" x2="56" y2="24" stroke="currentColor" stroke-width="2" />
        <line x1="24" y1="24" x2="24" y2="52" stroke="currentColor" stroke-width="2" />
        <line x1="40" y1="24" x2="40" y2="52" stroke="currentColor" stroke-width="2" />
        <line x1="8" y1="36" x2="56" y2="36" stroke="currentColor" stroke-width="1.5" />
        <line x1="8" y1="44" x2="56" y2="44" stroke="currentColor" stroke-width="1.5" />
      </svg>
      <span class="card-preview__label">Database</span>
    </div>
  );
}
