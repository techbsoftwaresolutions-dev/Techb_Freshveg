import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../../api/client";
import FormRoute from "../../components/FormRoute";
import { Banner, Card, Empty, Field, Loading, Modal, Pagination, Pill, Table, when } from "../../components/ui";

// Admin → Delivery Areas: the places the shop delivers to. Customers pick
// from the active ones in the website's "Deliver to" picker; checkout refuses
// anything else. Each area belongs to the store that fulfils it, and that
// store's pincode coverage follows its active areas automatically.

export default function DeliveryAreas() {
  const navigate = useNavigate();
  const [data, setData] = useState({ items: [], meta: null, stores: [] });
  const [filters, setFilters] = useState({ search: "", status: "", page: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    setError("");
    api
      .get("/delivery-areas", { ...filters, limit: 25 })
      .then(setData)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [filters]);

  useEffect(() => {
    const timer = setTimeout(load, filters.search ? 250 : 0);
    return () => clearTimeout(timer);
  }, [load, filters.search]);

  const set = (key, value) => setFilters((f) => ({ ...f, [key]: value, page: key === "page" ? value : 1 }));

  async function run(area, request) {
    setBusyId(area.id);
    try {
      await request();
      load();
    } catch {
      // the API client has already shown the reason as a toast
    } finally {
      setBusyId(null);
    }
  }

  const toggle = (area) => {
    if (area.active) {
      const open = area.openOrders ? ` Its ${area.openOrders} open order${area.openOrders === 1 ? "" : "s"} will still be delivered.` : "";
      if (!window.confirm(`Stop delivering to ${area.name}? Customers will no longer be able to choose it.${open}`)) return;
    }
    run(area, () => api.patch(`/delivery-areas/${area.id}`, { active: !area.active }));
  };

  const remove = (area) => {
    if (!window.confirm(`Delete ${area.name}? This can't be undone.`)) return;
    run(area, () => api.delete(`/delivery-areas/${area.id}`));
  };

  const multiStore = data.stores.length > 1;

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Delivery Areas</h1>
          <span className="faint" style={{ fontSize: 12 }}>Manage the locations where Fresh Market delivers.</span>
        </div>
        <button className="btn primary" onClick={() => navigate("/delivery-areas/new")}>
          + Add Delivery Area
        </button>
      </div>

      <Banner tone="error">{error}</Banner>

      <div className="toolbar">
        <input
          type="search"
          placeholder="Search by area, city, state or PIN code…"
          value={filters.search}
          onChange={(e) => set("search", e.target.value)}
          style={{ minWidth: 280 }}
          aria-label="Search delivery areas"
        />
        <select value={filters.status} onChange={(e) => set("status", e.target.value)} aria-label="Filter by status">
          <option value="">Any status</option>
          <option value="active">Delivering</option>
          <option value="inactive">Not delivering</option>
        </select>
      </div>

      <Card tight>
        {loading ? (
          <Loading />
        ) : (
          <>
            <Table
              title="Delivery areas"
              columns={[
                {
                  key: "name",
                  label: "Area",
                  render: (row) => (
                    <div className="stack">
                      <span className="row-title">{row.name}</span>
                      {row.description ? <span className="row-sub">{row.description}</span> : null}
                    </div>
                  ),
                },
                { key: "city", label: "City / locality" },
                { key: "state", label: "State", render: (row) => row.state || <span className="faint">—</span> },
                { key: "pincode", label: "PIN code" },
                ...(multiStore ? [{ key: "storeName", label: "Store", render: (row) => <span className="muted">{row.storeName}</span> }] : []),
                {
                  key: "active",
                  label: "Status",
                  render: (row) => <Pill tone={row.active ? "ok" : "danger"}>{row.active ? "Delivering" : "Not delivering"}</Pill>,
                },
                { key: "orders", label: "Orders", align: "right" },
                { key: "createdAt", label: "Created", render: (row) => <span className="muted">{when(row.createdAt)}</span> },
                {
                  key: "actions",
                  label: "Actions",
                  sortable: false,
                  render: (row) => (
                    <div className="inline" style={{ gap: 6 }} onClick={(e) => e.stopPropagation()}>
                      <button className="btn sm" onClick={() => navigate(`/delivery-areas/${row.id}`)}>Edit</button>
                      <button className={`btn sm${row.active ? " danger" : ""}`} disabled={busyId === row.id} onClick={() => toggle(row)}>
                        {busyId === row.id ? "…" : row.active ? "Deactivate" : "Activate"}
                      </button>
                      {/* An area orders went to is history: deactivate, don't delete. */}
                      {row.orders === 0 ? (
                        <button className="btn sm ghost" disabled={busyId === row.id} onClick={() => remove(row)}>Delete</button>
                      ) : null}
                    </div>
                  ),
                },
              ]}
              rows={data.items}
              onRowClick={(row) => navigate(`/delivery-areas/${row.id}`)}
              empty={
                <Empty
                  title={filters.search || filters.status ? "No areas match these filters" : "No delivery areas yet"}
                  hint={filters.search || filters.status ? undefined : "Add the first place you deliver to — customers choose from this list."}
                />
              }
            />
            <Pagination meta={data.meta} onPage={(page) => set("page", page)} />
          </>
        )}
      </Card>
    </div>
  );
}

// /delivery-areas/new and /delivery-areas/:id — the add / edit form, as its
// own page.
export function DeliveryAreaFormPage() {
  return (
    <FormRoute
      backTo="/delivery-areas"
      backLabel="Delivery Areas"
      load={async (id) => {
        if (id) return api.get(`/delivery-areas/${id}`);
        const { stores } = await api.get("/delivery-areas", { limit: 1 });
        return { area: null, stores };
      }}
      render={({ area, stores }, back) => <AreaForm area={area} stores={stores} onDone={back} />}
    />
  );
}

function AreaForm({ area, stores, onDone }) {
  const creating = !area;
  const [form, setForm] = useState({
    name: area?.name || "",
    city: area?.city || "",
    state: area?.state || "",
    pincode: area?.pincode || "",
    description: area?.description || "",
    active: area ? area.active : true,
    store: area?.store || stores.find((s) => s.isDefault)?.id || stores[0]?.id || "",
  });
  const [errors, setErrors] = useState({});
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  async function save(event) {
    event?.preventDefault();
    const local = {};
    if (!form.name.trim()) local.name = "Enter the area's name";
    if (!form.city.trim()) local.city = "Enter the city or locality";
    if (!/^\d{6}$/.test(form.pincode.trim())) local.pincode = "PIN code must be 6 digits";
    setErrors(local);
    if (Object.keys(local).length) return;

    setSaving(true);
    setError("");
    try {
      const body = { ...form, active: form.active === true || form.active === "true" };
      if (creating) await api.post("/delivery-areas", body);
      else await api.patch(`/delivery-areas/${area.id}`, body);
      onDone();
    } catch (err) {
      setError(err.message);
      if (err.details) setErrors(err.details);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      title={creating ? "Add Delivery Area" : area.name}
      onClose={onDone}
      footer={
        <>
          <button className="btn" onClick={onDone}>Cancel</button>
          <button className="btn primary" disabled={saving} onClick={save}>
            {saving ? "Saving…" : creating ? "Add area" : "Save changes"}
          </button>
        </>
      }
    >
      <Banner tone="error">{error}</Banner>
      <form onSubmit={save}>
        <div className="grid cols-2">
          <Field label="Delivery area name" error={errors.name} help="What customers search for, e.g. Sarjapura.">
            <input type="text" value={form.name} onChange={set("name")} maxLength={80} autoFocus={creating} />
          </Field>
          <Field label="City / locality" error={errors.city}>
            <input type="text" value={form.city} onChange={set("city")} maxLength={80} />
          </Field>
        </div>
        <div className="grid cols-2">
          <Field label="State" error={errors.state}>
            <input type="text" value={form.state} onChange={set("state")} maxLength={80} />
          </Field>
          <Field label="PIN code" error={errors.pincode} help="Checkout matches the customer's address to this.">
            <input
              type="text"
              inputMode="numeric"
              value={form.pincode}
              onChange={(e) => setForm((f) => ({ ...f, pincode: e.target.value.replace(/\D/g, "").slice(0, 6) }))}
            />
          </Field>
        </div>
        <div className="grid cols-2">
          <Field label="Status">
            <select value={String(form.active)} onChange={(e) => setForm((f) => ({ ...f, active: e.target.value === "true" }))}>
              <option value="true">Delivering — customers can choose it</option>
              <option value="false">Not delivering — hidden from customers</option>
            </select>
          </Field>
          {stores.length > 1 ? (
            <Field label="Fulfilled by" error={errors.store} help="The store whose stock and riders serve this area.">
              <select value={form.store} onChange={set("store")}>
                {stores.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </Field>
          ) : null}
        </div>
        <Field label="Internal description" error={errors.description} help="Optional. Only staff see this.">
          <textarea value={form.description} onChange={set("description")} maxLength={300} rows={3} />
        </Field>
        <button type="submit" hidden aria-hidden="true" tabIndex={-1} />
      </form>
    </Modal>
  );
}
