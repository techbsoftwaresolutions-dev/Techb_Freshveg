import { useCallback, useEffect, useState } from "react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { api, confirmDialog, toast } from "../api/client";
import { Banner, Loading, Modal, Pill } from "./ui";

// "Reorder Products → Best Seller": the whole of one order — every product in
// the section, not one page of the product table and not what a search left —
// as light rows to drag (or type a number into, or move with the keyboard).
// Nothing is saved until Save Order, and the save sends the complete order
// with the version it was read at, so the server can refuse it if the
// section changed meanwhile instead of overwriting someone else's work.
export default function ReorderPanel({ orderKey, title, onClose, onSaved }) {
  const [saved, setSaved] = useState(null); // { items, version } — last confirmed
  const [list, setList] = useState([]); // what the admin is arranging
  const [saving, setSaving] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [notice, setNotice] = useState({ tone: "info", text: "" });

  const fetchOrder = useCallback(() => api.get(`/catalog/orders/${encodeURIComponent(orderKey)}`), [orderKey]);
  const adopt = (order) => {
    setSaved(order);
    setList(order.items);
  };

  // A load that's been superseded (the panel reopened, or React re-running
  // the effect) must not land late and wipe out what the admin has arranged.
  useEffect(() => {
    let current = true;
    fetchOrder()
      .then((order) => current && adopt(order))
      .catch((err) => current && setNotice({ tone: "error", text: err.message }));
    return () => {
      current = false;
    };
  }, [fetchOrder]);

  const sensors = useSensors(
    // A few pixels of travel before a drag starts, so a click on the handle
    // is still just a click.
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const ids = list.map((p) => p.id);
  const changed = Boolean(saved) && ids.join() !== saved.items.map((p) => p.id).join();

  const moveTo = (id, position) =>
    setList((current) => {
      const from = current.findIndex((p) => p.id === id);
      const to = Math.min(Math.max(1, position), current.length) - 1;
      return from < 0 || from === to ? current : arrayMove(current, from, to);
    });

  // "Failed to fetch" + our sentence, as one readable line.
  const sentence = (message) => String(message || "Couldn't save").replace(/[.!?]?\s*$/, ".");

  async function save() {
    if (!changed || saving) return;
    setSaving(true);
    setNotice({ tone: "info", text: "" });
    try {
      adopt(await api.put(`/catalog/orders/${encodeURIComponent(orderKey)}`, { ids, version: saved.version }));
      onSaved?.();
    } catch (err) {
      // Whether or not that save landed, the server's order is the truth:
      // read it back before anything else happens, so a retry can never apply
      // the same move twice.
      try {
        const latest = await fetchOrder();
        if (latest.items.map((p) => p.id).join() === ids.join()) {
          adopt(latest);
          toast("success", "Product order saved");
          onSaved?.();
        } else if (latest.version === saved.version) {
          setNotice({ tone: "error", text: `${sentence(err.message)} Your arrangement is still here — save again to retry.` });
        } else {
          adopt(latest);
          setNotice({
            tone: "warn",
            text: "This section changed while you were arranging it (a product was added or removed, or someone else saved an order). The latest order is loaded — please make your changes again.",
          });
        }
      } catch {
        setNotice({ tone: "error", text: `${sentence(err.message)} Check your connection, then reopen this to see the saved order.` });
      }
    } finally {
      setSaving(false);
    }
  }

  async function requestClose() {
    if (dragging || saving) return;
    if (changed) {
      const ok = await confirmDialog({
        title: "Discard this arrangement?",
        message: "The new order hasn't been saved. Close without saving it?",
        confirmText: "Discard changes",
        danger: true,
      });
      if (!ok) return;
    }
    onClose();
  }

  return (
    <Modal
      wide
      title={`Reorder Products → ${title}`}
      onClose={requestClose}
      footer={
        <>
          {changed ? <span className="reorder-dirty">Unsaved changes</span> : null}
          <button className="btn" onClick={requestClose} disabled={saving}>
            Cancel
          </button>
          <button className="btn" onClick={() => setList(saved.items)} disabled={!changed || saving}>
            Reset
          </button>
          <button className="btn primary" onClick={save} disabled={!changed || saving}>
            {saving ? "Saving…" : "Save Order"}
          </button>
        </>
      }
    >
      <Banner tone={notice.tone}>{notice.text}</Banner>
      {!saved ? (
        notice.tone === "error" ? null : <Loading />
      ) : (
        <>
          <p className="reorder-scope">
            All <strong>{list.length}</strong> product{list.length === 1 ? "" : "s"} in <strong>{title}</strong>, in saved order —
            search, filters and pages from the product list don't apply here. Drag a row by its handle, type a new number, or
            focus a handle and use Space and the arrow keys.
          </p>
          {list.length ? (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragStart={() => setDragging(true)}
              onDragCancel={() => setDragging(false)}
              onDragEnd={({ active, over }) => {
                setDragging(false);
                if (over && active.id !== over.id) setList((l) => arrayMove(l, ids.indexOf(active.id), ids.indexOf(over.id)));
              }}
              accessibility={{
                screenReaderInstructions: {
                  draggable: "To move a product, press Space, use the arrow keys, then press Space again to drop it. Escape cancels.",
                },
              }}
            >
              <SortableContext items={ids} strategy={verticalListSortingStrategy}>
                <ol className="reorder-list" aria-label={`Order of products in ${title}`}>
                  {list.map((product, index) => (
                    <ReorderRow
                      key={product.id}
                      product={product}
                      position={index + 1}
                      total={list.length}
                      moved={saved.items[index]?.id !== product.id}
                      disabled={saving}
                      onMove={(to) => moveTo(product.id, to)}
                    />
                  ))}
                </ol>
              </SortableContext>
            </DndContext>
          ) : (
            <p className="faint">No products in this section yet.</p>
          )}
        </>
      )}
    </Modal>
  );
}

function ReorderRow({ product, position, total, moved, disabled, onMove }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id: product.id,
    disabled,
  });
  const [draft, setDraft] = useState(String(position));
  useEffect(() => setDraft(String(position)), [position]);

  const commit = () => {
    const next = Number(draft);
    if (Number.isInteger(next) && next >= 1 && next !== position) onMove(next);
    else setDraft(String(position));
  };

  return (
    <li
      ref={setNodeRef}
      className={`reorder-row${isDragging ? " dragging" : ""}${moved ? " moved" : ""}`}
      style={{ transform: CSS.Transform.toString(transform), transition }}
    >
      <button
        type="button"
        ref={setActivatorNodeRef}
        className="reorder-handle"
        aria-label={`Drag ${product.name}, position ${position} of ${total}`}
        disabled={disabled}
        {...attributes}
        {...listeners}
      >
        <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="currentColor">
          {[6, 12, 18].map((y) => [9, 15].map((x) => <circle key={`${x}-${y}`} cx={x} cy={y} r="1.6" />))}
        </svg>
      </button>
      <input
        className="position-input"
        type="number"
        min={1}
        max={total}
        value={draft}
        disabled={disabled}
        aria-label={`Position of ${product.name}`}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
          if (e.key === "Escape") {
            e.stopPropagation();
            setDraft(String(position));
          }
        }}
      />
      {product.image ? (
        <img className="reorder-thumb" src={product.image} alt="" loading="lazy" />
      ) : (
        <span className="reorder-thumb" aria-hidden="true" />
      )}
      <span className="reorder-name">{product.name}</span>
      {product.status !== "active" ? <Pill tone="warn">{product.status}</Pill> : null}
      {product.status === "active" && !product.inStock ? <Pill tone="danger">Out of stock</Pill> : null}
    </li>
  );
}
