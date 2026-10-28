// The Ghana flag as an inline SVG: Windows has no flag emoji (🇬🇭 shows as
// the letters "GH"), so the phone step's country box draws its own.
export function GhanaFlag({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 30 20"
      aria-hidden="true"
      focusable="false"
      className={className}
    >
      <rect width="30" height="6.67" fill="#CE1126" />
      <rect y="6.67" width="30" height="6.66" fill="#FCD116" />
      <rect y="13.33" width="30" height="6.67" fill="#006B3F" />
      <polygon
        fill="#000"
        points="15,6.8 15.73,8.99 18.04,9.01 16.19,10.39 16.88,12.59 15,11.25 13.12,12.59 13.81,10.39 11.96,9.01 14.27,8.99"
      />
    </svg>
  );
}
