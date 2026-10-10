export function Ornament({ className = "" }: { className?: string }) {
  return <span aria-hidden="true" className={`ornament ${className}`.trim()} />;
}
