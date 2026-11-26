import DatePicker from "./DatePicker";
import Select from "./Select";
import { Field } from "./ui";

// Renders a product form from whatever `GET /catalog/categories/:id/schema`
// returned. There is no per-category code here and there is no list of known
// field names — binding a new attribute to a category makes an input appear
// on the next page load, in the right group, with its validation attached.
//
// `inheritedFrom` on a field is shown rather than hidden: an admin editing a
// vegetable should be able to see that "Variety" came from the department, not
// from this product.

function Input({ field, value, onChange, error }) {
  const invalid = error ? "true" : undefined;
  const common = {
    "aria-invalid": invalid,
    id: `attr-${field.code}`,
  };

  switch (field.inputType) {
    case "textarea":
    case "richtext":
      return (
        <textarea
          {...common}
          placeholder={field.placeholder}
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
        />
      );

    case "number":
    case "measure":
      return (
        <div className="inline" style={{ flexWrap: "nowrap" }}>
          <input
            {...common}
            type="number"
            placeholder={field.placeholder}
            min={field.validation?.min}
            max={field.validation?.max}
            step={field.validation?.step || "any"}
            value={value ?? ""}
            onChange={(e) => onChange(e.target.value === "" ? "" : Number(e.target.value))}
          />
          {field.unit && <span className="faint nowrap">{field.unit}</span>}
        </div>
      );

    case "boolean":
      return (
        <label className="checkbox">
          <input
            {...common}
            type="checkbox"
            checked={Boolean(value)}
            onChange={(e) => onChange(e.target.checked)}
          />
          <span className="muted">{field.helpText || "Yes"}</span>
        </label>
      );

    case "select":
      return (
        <Select {...common} value={value ?? ""} onChange={(e) => onChange(e.target.value)}>
          <option value="">— Select —</option>
          {field.options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
      );

    case "multiselect": {
      const selected = Array.isArray(value) ? value : value ? [value] : [];
      const toggle = (optionValue) =>
        onChange(
          selected.includes(optionValue)
            ? selected.filter((v) => v !== optionValue)
            : [...selected, optionValue]
        );
      return (
        <div className="inline">
          {field.options.map((option) => (
            <label key={option.value} className="checkbox">
              <input
                type="checkbox"
                checked={selected.includes(option.value)}
                onChange={() => toggle(option.value)}
              />
              <span>{option.label}</span>
            </label>
          ))}
        </div>
      );
    }

    case "date":
      return (
        <DatePicker
          id={common.id}
          invalid={common["aria-invalid"] === "true"}
          value={value ? String(value).slice(0, 10) : ""}
          onChange={onChange}
        />
      );

    case "color":
      return (
        <div className="inline" style={{ flexWrap: "nowrap" }}>
          <input
            type="color"
            value={value || "#000000"}
            onChange={(e) => onChange(e.target.value)}
            style={{ width: 44, height: 32, padding: 2 }}
          />
          <input type="text" value={value ?? ""} onChange={(e) => onChange(e.target.value)} />
        </div>
      );

    default:
      return (
        <input
          {...common}
          type="text"
          placeholder={field.placeholder}
          maxLength={field.validation?.maxLength}
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
        />
      );
  }
}

export default function SchemaForm({ groups, values, errors = {}, onChange, scope = "product", showAxes = false }) {
  const visible = (groups || [])
    .map((group) => ({
      ...group,
      // Variant axes are edited in the variant table, not here, so they are
      // filtered out of the product form unless explicitly asked for.
      fields: group.fields.filter((f) => f.scope === scope && (showAxes || !f.isVariantAxis)),
    }))
    .filter((group) => group.fields.length);

  if (!visible.length) {
    return (
      <p className="muted" style={{ fontSize: 13, margin: 0 }}>
        This category has no extra fields yet. Bind attributes to it under{" "}
        <strong>Categories → Fields</strong> and they will appear here.
      </p>
    );
  }

  return (
    <>
      {visible.map((group) => (
        <div key={group.name}>
          <div className="section-label">{group.name}</div>
          {group.fields.map((field) => (
            <Field
              key={field.code}
              label={
                <>
                  {field.label}
                  {field.required && <span style={{ color: "var(--danger)" }}> *</span>}
                </>
              }
              help={field.helpText}
              error={errors[field.code]}
              inherited={field.inheritedFrom}
            >
              <Input
                field={field}
                value={values[field.code]}
                error={errors[field.code]}
                onChange={(next) => onChange({ ...values, [field.code]: next })}
              />
            </Field>
          ))}
        </div>
      ))}
    </>
  );
}
