import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

// A dropdown drawn by the app rather than the browser. A native <select>
// opens a list the page cannot style — system font, OS highlight colour,
// and a category tree flattened into a long column of "— — Name" rows.
//
// The list is drawn in a portal with fixed positioning, so it is never
// clipped by a table, a card or a modal, and it flips upward when there is
// no room below. Options may carry a `depth` (children indent under their
// heading) and `disabled` / `group` (a non-selectable section label). Long
// lists get a search box that matches on the option or its parent's name.
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
  className = "",
  style,
  invalid = false,
  ariaLabel,
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [place, setPlace] = useState(null);
  const rootRef = useRef(null);
  const buttonRef = useRef(null);
  const popRef = useRef(null);
  const listRef = useRef(null);
  const searchRef = useRef(null);

  const withSearch = searchable ?? options.filter((o) => !o.group).length > 8;

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
        isHeading: depth === 0 && Boolean(next && (next.depth || 0) > 0),
      };
    });
  }, [options]);

  const visible = useMemo(() => {
    const term = query.trim().toLowerCase();
    const list = term
      ? annotated.filter(
          (o) =>
            !o.group &&
            (o.label.toLowerCase().includes(term) ||
              (o.section && o.section.label.toLowerCase().includes(term)))
        )
      : annotated;
    return emptyLabel && !term ? [{ value: "", label: emptyLabel, depth: 0, isEmpty: true }, ...list] : list;
  }, [annotated, query, emptyLabel]);

  const selected = annotated.find((o) => !o.group && String(o.value) === String(value ?? ""));
  const selectable = (o) => o && !o.disabled && !o.group;

  const measure = () => {
    const el = buttonRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const width = Math.min(Math.max(r.width, 240), vw - 16);
    const left = Math.max(8, Math.min(r.left, vw - width - 8));
    const below = vh - r.bottom - 12;
    const above = r.top - 12;
    const flip = below < 280 && above > below;
    const room = Math.max(160, flip ? above : below);
    setPlace({
      left,
      width,
      top: flip ? undefined : r.bottom + 6,
      bottom: flip ? vh - r.top + 6 : undefined,
      maxHeight: Math.min(room, 440),
    });
  };

  useLayoutEffect(() => {
    if (open) measure();
    else setPlace(null);
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    setQuery("");
    const at = annotated.findIndex((o) => !o.group && String(o.value) === String(value ?? ""));
    setActive(Math.max(0, (emptyLabel ? 1 : 0) + at));
    const onDown = (event) => {
      const inside = rootRef.current?.contains(event.target) || popRef.current?.contains(event.target);
      if (!inside) setOpen(false);
    };
    const onScroll = (event) => {
      if (popRef.current?.contains(event.target)) return;
      measure();
    };
    document.addEventListener("mousedown", onDown);
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", onScroll, true);
    // Focus the search, or the list itself, so the keyboard works at once.
    requestAnimationFrame(() => (withSearch ? searchRef.current : listRef.current)?.focus());
    return () => {
      document.removeEventListener("mousedown", onDown);
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", onScroll, true);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Keep the highlighted row in view while arrowing through a long list.
  useEffect(() => {
    if (!open) return;
    listRef.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active, open]);

  useEffect(() => {
    setActive(Math.max(0, visible.findIndex(selectable)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  const close = () => {
    setOpen(false);
    buttonRef.current?.focus();
  };

  const choose = (option) => {
    if (!selectable(option)) return;
    close();
    if (String(option.value) !== String(value ?? "")) onChange?.(option.value);
  };

  const move = (step) => {
    setActive((from) => {
      let i = from;
      for (let n = 0; n < visible.length; n += 1) {
        i += step;
        if (i < 0 || i >= visible.length) return from;
        if (selectable(visible[i])) return i;
      }
      return from;
    });
  };

  const onKeyDown = (event) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      move(1);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      move(-1);
    } else if (event.key === "Enter") {
      event.preventDefault();
      if (visible[active]) choose(visible[active]);
    } else if (event.key === "Escape") {
      event.preventDefault();
      close();
    } else if (event.key === "Tab") {
      setOpen(false);
    }
  };

  const listMax = place ? Math.max(120, place.maxHeight - (withSearch ? 52 : 4)) : 320;

  const pop =
    open && place
      ? createPortal(
          <div
            ref={popRef}
            className="select-menu-pop"
            onKeyDown={onKeyDown}
            style={{
              position: "fixed",
              left: place.left,
              width: place.width,
              top: place.top,
              bottom: place.bottom,
              right: "auto",
              transformOrigin: place.bottom != null ? "bottom" : "top",
            }}
          >
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

            <ul className="select-menu-list" role="listbox" tabIndex={-1} ref={listRef} style={{ maxHeight: listMax }}>
              {visible.length ? (
                visible.map((option, index) => {
                  if (option.group) {
                    return (
                      <li key={`g-${index}`} className="select-menu-group" role="presentation">
                        {option.label}
                      </li>
                    );
                  }
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
                      onMouseEnter={() => selectable(option) && setActive(index)}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={(e) => {
                        e.stopPropagation();
                        choose(option);
                      }}
                    >
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
          </div>,
          document.body
        )
      : null;

  return (
    <div
      className={`select-menu${open ? " open" : ""}${className ? ` ${className}` : ""}`}
      ref={rootRef}
      style={style}
    >
      <button
        type="button"
        id={id}
        ref={buttonRef}
        className="select-menu-button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        aria-invalid={invalid || undefined}
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
      {pop}
    </div>
  );
}
