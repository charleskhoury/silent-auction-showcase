type Props = {
  className?: string;
};

/** Decorative diamond emblem used in the hero and sign-in header,
 *  recolorable via `currentColor`. */
export function EmblemMotif({ className = "" }: Props) {
  return (
    <svg
      viewBox="0 0 120 160"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <path
        fill="currentColor"
        d="M60 4 112 80 60 156 8 80 60 4Zm0 26L34 80l26 50 26-50L60 30Z"
      />
      <circle cx="60" cy="80" r="12" fill="currentColor" />
    </svg>
  );
}
