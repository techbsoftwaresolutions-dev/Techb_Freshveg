import { useEffect, useState } from "react";
import { api } from "../../api/client";
import { Banner, Card, Empty, Loading, Pagination, Pill, Table, rupees, when } from "../../components/ui";

// Who referred whom, and whether it has paid out. Rewards are set in
// Settings → Referrals and paid by the engine when the friend's first order is
// delivered — this page only reads.
export default function Referrals() {
  const [data, setData] = useState({ items: [], meta: null });
  const [filters, setFilters] = useState({ status: "", page: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    setLoading(true);
    api
      .get("/referrals", { ...filters, limit: 20 })
      .then(setData)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [filters]);

  return (
    <>
      <Banner tone="error">{error}</Banner>

      <div className="toolbar">
        <select value={filters.status} onChange={(e) => setFilters({ status: e.target.value, page: 1 })}>
          <option value="">All referrals</option>
          <option value="pending">Awaiting first order</option>
          <option value="rewarded">Rewarded</option>
        </select>
      </div>

      <Card tight>
        {loading ? (
          <Loading />
        ) : (
          <>
            <Table
              title="Referrals"
              columns={[
                {
                  key: "referrer",
                  label: "Referred by",
                  render: (row) => (
                    <div className="stack">
                      <span>{row.referrer?.name || "—"}</span>
                      <span className="row-sub">{row.referrer?.phone}</span>
                    </div>
                  ),
                },
                {
                  key: "referee",
                  label: "New customer",
                  render: (row) => (
                    <div className="stack">
                      <span>{row.referee?.name || "—"}</span>
                      <span className="row-sub">{row.referee?.phone}</span>
                    </div>
                  ),
                },
                { key: "code", label: "Code", render: (row) => <span className="tag">{row.code}</span> },
                {
                  key: "rewards",
                  label: "Rewards",
                  align: "right",
                  render: (row) => `${rupees(row.referrerReward)} + ${rupees(row.refereeReward)}`,
                },
                {
                  key: "status",
                  label: "Status",
                  render: (row) => (
                    <div className="stack">
                      <Pill tone={row.status === "rewarded" ? "ok" : "info"}>
                        {row.status === "rewarded" ? "Rewarded" : "Awaiting first order"}
                      </Pill>
                      {row.qualifyingOrderCode ? <span className="row-sub">{row.qualifyingOrderCode}</span> : null}
                    </div>
                  ),
                },
                { key: "createdAt", label: "Joined", render: (row) => when(row.createdAt) },
              ]}
              rows={data.items}
              empty={<Empty title="No referrals yet" hint="They appear here when a new customer uses someone's code." />}
            />
            <Pagination meta={data.meta} onPage={(page) => setFilters((f) => ({ ...f, page }))} />
          </>
        )}
      </Card>
    </>
  );
}
