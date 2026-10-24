import { useEffect, useMemo, useRef, useState } from "react";

// A dropdown drawn by the app rather than the browser. A native <select>
// opens a list the page cannot style — system font, OS highlight colour,
// and a category tree flattened into a long column of "— — Name" rows.
//
// Options may carry a `depth`: depth-0 options that have children below them
// read as section headings, and their children indent under them. An option
// can also say `heading: true|false` outright (a main category with no
// sub-categories is still a main category), carry an `icon` (an emoji)
// shown before its label, and be `disabled`: still listed, greyed out, and
// not choosable (its `hint` can say why). Long lists
// get a search box that matches on the option or its parent's name, so
// "exotic" finds both "Exotic Fruits" and "Exotic Vegetables".
//
// Keyboard: ↑/↓ to move, Enter to choose, Esc to close, and typing goes
// straight into the search box.
export default function SelectMenu({
  value,
  onChange,
  options = [],
  placeholder = "Select…",
  emptyLabel, // when set, a first option that clears the value
  searchable,
  disabled = false,
  id,
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const rootRef = useRef(null);
  const listRef = useRef(null);
  const searchRef = useRef(null);

  const withSearch = searchable ?? options.length > 8;

  // Each option knows its section (the nearest depth-0 option above it), so
  // a search can keep the heading a match sits under.
  const annotated = useMemo(() => {
    let section = null;
    return options.map((option, index) => {
      const depth = option.depth || 0;
      if (depth === 0) section = option;
      const next = options[index + 1];
      return {
        ...option,
        depth,
        section: depth === 0 ? null : section,
        isHeading: option.heading ?? (depth === 0 && Boolean(next && (next.depth || 0) > 0)),
      };
    });
  }, [options]);

  const visible = useMemo(() => {
    const term = query.trim().toLowerCase();
    const list = term
      ? annotated.filter(
          (o) =>
            o.label.toLowerCase().includes(term) ||
            (o.section && o.section.label.toLowerCase().includes(term))
        )
      : annotated;
    return emptyLabel && !term ? [{ value: "", label: emptyLabel, depth: 0, isEmpty: true }, ...list] : list;
  }, [annotated, query, emptyLabel]);

  const selected = annotated.find((o) => String(o.value) === String(value ?? ""));

  useEffect(() => {
    if (!open) return undefined;
    setQuery("");
    const index = Math.max(0, (emptyLabel ? 1 : 0) + annotated.findIndex((o) => String(o.value) === String(value ?? "")));
    setActive(index);
    const onDown = (event) => {
      if (rootRef.current && !rootRef.current.contains(event.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    // Focus the search, or the list itself, so the keyboard works at once.
    requestAnimationFrame(() => (withSearch ? searchRef.current : listRef.current)?.focus());
    return () => document.removeEventListener("mousedown", onDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Keep the highlighted row in view while arrowing through a long list.
  useEffect(() => {
    if (!open) return;
    listRef.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active, open]);

  useEffect(() => {
    setActive(0);
  }, [query]);

  const choose = (option) => {
    if (option.disabled) return;
    setOpen(false);
    if (String(option.value) !== String(value ?? "")) onChange(option.value);
  };

  const onKeyDown = (event) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive((i) => Math.min(i + 1, visible.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (event.key === "Enter") {
      event.preventDefault();
      if (visible[active]) choose(visible[active]);
    } else if (event.key === "Escape" || event.key === "Tab") {
      setOpen(false);
    }
  };

  return (
    <div className={`select-menu${open ? " open" : ""}`} ref={rootRef}>
      <button
        type="button"
        id={id}
        className="select-menu-button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        onKeyDown={(event) => {
          if (!open && (event.key === "ArrowDown" || event.key === "Enter" || event.key === " ")) {
            event.preventDefault();
            setOpen(true);
          }
        }}
      >
        <span className={selected ? "select-menu-value" : "select-menu-placeholder"}>
          {selected ? (
            <>
              {selected.icon ? <span className="select-menu-icon" aria-hidden="true">{selected.icon}</span> : null}
              {selected.section ? <span className="select-menu-path">{selected.section.label} › </span> : null}
              {selected.label}
            </>
          ) : value === "" && emptyLabel ? (
            emptyLabel
          ) : (
            placeholder
          )}
        </span>
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="select-menu-chevron">
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {open ? (
        <div className="select-menu-pop" onKeyDown={onKeyDown}>
          {withSearch ? (
            <div className="select-menu-search">
              <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                <circle cx="11" cy="11" r="6.5" />
                <path d="m20 20-4-4" />
              </svg>
              <input
                ref={searchRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search…"
                aria-label="Search options"
              />
            </div>
          ) : null}

          <ul className="select-menu-list" role="listbox" tabIndex={-1} ref={listRef}>
            {visible.length ? (
              visible.map((option, index) => {
                const isSelected = !option.isEmpty && String(option.value) === String(value ?? "");
                return (
                  <li
                    key={`${option.value}-${index}`}
                    data-index={index}
                    role="option"
                    aria-selected={isSelected}
                    aria-disabled={option.disabled || undefined}
                    className={[
                      "select-menu-option",
                      option.isHeading ? "heading" : "",
                      option.isEmpty ? "empty" : "",
                      option.disabled ? "disabled" : "",
                      index === active ? "active" : "",
                      isSelected ? "selected" : "",
                    ].join(" ")}
                    style={{ paddingLeft: 12 + Math.min(option.depth, 4) * 16 }}
                    onMouseEnter={() => setActive(index)}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => choose(option)}
                  >
                    {option.icon ? <span className="select-menu-icon" aria-hidden="true">{option.icon}</span> : null}
                    <span className="select-menu-label">
                      {query && option.section ? <span className="select-menu-path">{option.section.label} › </span> : null}
                      {option.label}
                    </span>
                    {option.hint ? <span className="select-menu-hint">{option.hint}</span> : null}
                    {isSelected ? (
                      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="m5 12.5 4.5 4.5L19 7.5" />
                      </svg>
                    ) : null}
                  </li>
                );
              })
            ) : (
              <li className="select-menu-none">Nothing matches “{query}”</li>
            )}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
