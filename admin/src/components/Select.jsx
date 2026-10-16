import { Children, Fragment, isValidElement } from "react";
import SelectMenu from "./SelectMenu";

// Drop-in replacement for a native <select>: same <option> / <optgroup>
// children, same value / onChange(event) / disabled props — but it opens the
// app's own dropdown (SelectMenu) instead of the browser's. A leading "— " on
// an option label (the flattened category tree) becomes real indentation.
// <select multiple> has no equivalent menu, so it stays native.

function textOf(node) {
  return Children.toArray(node)
    .map((child) => (isValidElement(child) ? textOf(child.props.children) : String(child)))
    .join("");
}

function collect(children, out, groupDisabled = false) {
  Children.forEach(children, (child) => {
    if (!isValidElement(child)) return;
    if (child.type === Fragment) {
      collect(child.props.children, out, groupDisabled);
    } else if (child.type === "optgroup") {
      out.push({ group: true, label: child.props.label, value: `__group_${child.props.label}` });
      collect(child.props.children, out, groupDisabled || Boolean(child.props.disabled));
    } else if (child.type === "option") {
      const raw = textOf(child.props.children);
      const optionValue = child.props.value ?? raw;
      // Only real choices carry tree dashes; "— Select —" placeholders have an empty value.
      const dashes = optionValue === "" ? null : raw.match(/^(?:—\s*)+/);
      const depth = dashes ? (dashes[0].match(/—/g) || []).length : 0;
      const label = (dashes ? raw.slice(dashes[0].length) : raw).trim() || raw;
      out.push({
        value: optionValue,
        label,
        depth,
        disabled: groupDisabled || Boolean(child.props.disabled),
      });
    }
  });
  return out;
}

export default function Select(props) {
  const {
    value,
    onChange,
    children,
    disabled,
    id,
    name,
    className,
    style,
    multiple,
    placeholder,
    "aria-label": ariaLabel,
    "aria-invalid": ariaInvalid,
  } = props;

  if (multiple) return <select {...props} />;

  const options = collect(children, []);

  return (
    <SelectMenu
      id={id}
      value={value == null ? "" : value}
      options={options}
      disabled={disabled}
      style={style}
      className={className}
      ariaLabel={ariaLabel}
      invalid={ariaInvalid === true || ariaInvalid === "true"}
      placeholder={placeholder || "Select…"}
      onChange={(next) => onChange?.({ target: { value: next, name, id }, currentTarget: { value: next, name, id } })}
    />
  );
}
