import { useEffect, useState } from "react";
import { api, toast } from "../../api/client";
import { Banner, Empty, Field, Loading, Modal, Pill, Table } from "../../components/ui";

// General settings → Units: the pack sizes ("100 ml", "5 KG", "1 Piece",
// "2 Pack") offered by the Pack Size dropdown under a product's Variants &
// pricing. They are the Pack Size attribute's options, so whatever is added,
// renamed or disabled here is what that dropdown shows (catalog.routes
// /pack-sizes). Every action saves straight away.
export default function PackSizes() {
  const [items, setItems] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(null); // {} to add, an item to rename
  const [removing, setRemoving] = useState(null);

  const load = () =>
    api
      .get("/catalog/pack-sizes")
      .then((data) => setItems(data.items))
      .catch((err) => {
        setItems([]);
        setError(err.message);
      });

  useEffect(() => {
    load();
  }, []);

  // Runs one change, then reloads the list (usage counts included).
  async function run(change, message) {
    setBusy(true);
    setError("");
    try {
      await change();
      toast("success", message);
      await load();
      return true;
    } catch (err) {
      setError(err.message);
      return false;
    } finally {
      setBusy(false);
    }
  }

  const path = (item) => `/catalog/pack-sizes/${encodeURIComponent(item.value)}`;
  const packs = (n) => `${n} pack${n === 1 ? "" : "s"}`;

  if (!items) return <Loading />;

  return (
    <>
      <div className="inline" style={{ justifyContent: "space-between", alignItems: "flex-start", gap: 12, marginBottom: 12 }}>
        <p className="muted" style={{ margin: 0 }}>
          The pack sizes offered in the <strong>Pack Size</strong> dropdown under a product's Variants &amp; pricing.
        </p>
        <button className="btn primary" disabled={busy} onClick={() => setEditing({})}>
          + Add unit
        </button>
      </div>

      <Banner tone="error">{error}</Banner>

      <Table
        title="Pack sizes"
        pageSize={10}
        keyOf={(item) => item.value}
        rows={items}
        empty={<Empty title="No pack sizes yet" hint="Add the first one, e.g. 100 ml or 1 Piece." />}
        columns={[
          { key: "label", label: "Pack size", render: (item) => <strong>{item.label}</strong> },
          { key: "value", label: "Code", render: (item) => <span className="tag">{item.value}</span> },
          {
            key: "packs",
            label: "Used by",
            align: "right",
            render: (item) => (item.packs ? packs(item.packs) : <span className="faint">not used</span>),
          },
          {
            key: "active",
            label: "Status",
            render: (item) => (item.active ? <Pill tone="ok">Active</Pill> : <Pill tone="warn">Disabled</Pill>),
          },
          {
            key: "actions",
            label: "",
            align: "right",
            sortable: false,
            exportable: false,
            render: (item) => (
              <div className="inline" style={{ gap: 6, justifyContent: "flex-end", flexWrap: "nowrap" }}>
                <button className="btn sm" disabled={busy} onClick={() => setEditing(item)}>
                  Edit
                </button>
                <button
                  className={`btn sm${item.active ? "" : " primary"}`}
                  disabled={busy}
                  title={item.active ? "Stop offering it for new packs; packs that use it keep it" : "Offer it again"}
                  onClick={() =>
                    run(
                      () => api.patch(path(item), { active: !item.active }),
                      item.active ? `"${item.label}" disabled` : `"${item.label}" enabled`
                    )
                  }
                >
                  {item.active ? "Disable" : "Enable"}
                </button>
                <button className="btn sm danger" disabled={busy} onClick={() => setRemoving(item)}>
                  Delete
                </button>
              </div>
            ),
          },
        ]}
      />

      {editing ? (
        <PackSizeModal
          item={editing}
          busy={busy}
          onClose={() => setEditing(null)}
          onSave={async (label) => {
            const ok = editing.value
              ? await run(() => api.patch(path(editing), { label }), `Renamed to "${label}"`)
              : await run(() => api.post("/catalog/pack-sizes", { label }), `"${label}" added`);
            if (ok) setEditing(null);
          }}
        />
      ) : null}

      {removing ? (
        <Modal
          title={`Delete "${removing.label}"?`}
          onClose={() => setRemoving(null)}
          footer={
            <>
              <button className="btn" onClick={() => setRemoving(null)} autoFocus>
                Cancel
              </button>
              <button
                className="btn danger"
                disabled={busy || removing.packs > 0}
                onClick={async () => {
                  if (await run(() => api.delete(path(removing)), `"${removing.label}" deleted`)) setRemoving(null);
                }}
              >
                Confirm
              </button>
            </>
          }
        >
          {removing.packs ? (
            <p style={{ margin: 0 }}>
              <strong>{removing.label}</strong> is used by {packs(removing.packs)}, so it can't be deleted. Use{" "}
              <strong>Disable</strong> instead — it stops being offered for new packs, and those {packs(removing.packs)}{" "}
              keep it.
            </p>
          ) : (
            <p style={{ margin: 0 }}>
              <strong>{removing.label}</strong> will be removed from the Pack Size dropdown. No pack uses it.
            </p>
          )}
        </Modal>
      ) : null}
    </>
  );
}

function PackSizeModal({ item, busy, onClose, onSave }) {
  const [label, setLabel] = useState(item.label || "");
  const adding = !item.value;
  // Mirrors the server's code for a new one: "100 ml" -> "100ml".
  const code = label.toLowerCase().replace(/[^a-z0-9.]+/g, "");

  return (
    <Modal
      title={adding ? "Add unit" : `Edit "${item.label}"`}
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>
            Cancel
          </button>
          <button className="btn primary" disabled={busy || !label.trim()} onClick={() => onSave(label.trim())}>
            {adding ? "Add unit" : "Save"}
          </button>
        </>
      }
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (label.trim()) onSave(label.trim());
        }}
      >
        <Field
          label="Pack size"
          help={
            adding
              ? `As it should read in the dropdown — e.g. 100 ml, 5 KG, 1 Piece, 2 Pack.${code ? ` Saved as "${code}".` : ""}`
              : `Its code "${item.value}" stays the same, so packs that use it keep it — they show the new name.`
          }
        >
          <input type="text" autoFocus maxLength={30} value={label} onChange={(e) => setLabel(e.target.value)} />
        </Field>
      </form>
    </Modal>
  );
}
