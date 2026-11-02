// Small building blocks shared by the sectioned add/edit pages (offers,
// banners, …): a numbered card, a segmented choice, an on/off switch and an
// input with a ₹ / % tag.

export function FormSection({ step, title, children }) {
  return (
    <section className="offer-section">
      <header className="offer-section-head">
        <span className="offer-step">{step}</span>
        <h3>{title}</h3>
      </header>
      <div className="offer-section-body">{children}</div>
    </section>
  );
}

export function Segmented({ value, onChange, options }) {
  return (
    <div className="seg" role="radiogroup">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          className={value === o.value ? "on" : ""}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function SwitchRow({ checked, onChange, title }) {
  return (
    <label className="switch-row">
      <span className="switch-copy">
        <strong>{title}</strong>
      </span>
      <input type="checkbox" className="switch" checked={checked} onChange={(e) => onChange(e.target.checked)} />
    </label>
  );
}

export function Affix({ prefix, suffix, children }) {
  return (
    <span className="affix">
      {prefix ? <span className="affix-tag">{prefix}</span> : null}
      {children}
      {suffix ? <span className="affix-tag end">{suffix}</span> : null}
    </span>
  );
}
