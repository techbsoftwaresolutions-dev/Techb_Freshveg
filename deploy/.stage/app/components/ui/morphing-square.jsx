// The site's loader: a square that rounds into a circle while it turns, then
// back again. Same props as the shadcn "morphing-square" it is modelled on
// (message, messagePlacement, className), but plain CSS instead of the
// motion library — this project has no Tailwind, TypeScript or shadcn, and one
// spinner is not worth adding all three. Colours come from the brand tokens.

const PLACEMENT = {
  bottom: "morph-bottom",
  top: "morph-top",
  right: "morph-right",
  left: "morph-left",
};

export function MorphingSquare({ message, messagePlacement = "bottom", className = "" }) {
  return (
    <div className={`morph ${PLACEMENT[messagePlacement] || PLACEMENT.bottom}`} role="status" aria-live="polite">
      <div className={`morph-square ${className}`.trim()} aria-hidden="true" />
      {message ? <div className="morph-message">{message}</div> : <span className="sr-only">Loading</span>}
    </div>
  );
}

export default MorphingSquare;
