import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { AsPage, Banner, Loading } from "./ui";

// The page behind an add/edit URL: /…/new or /…/:id.
//
// `load(id)` fetches whatever the form needs — the record (or a blank one for
// "new") plus any option lists — and returns it; returning null means "no
// such record". `render(data, back)` draws the form, which is one of the
// existing <Modal> forms: inside <AsPage> it lays itself out as a page.
// Saving or cancelling returns to the list at `backTo`.
export default function FormRoute({ load, render, backTo, backLabel }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const [state, setState] = useState({ loading: true, data: null, error: "" });
  // A save failure, for forms that hand saving to the page (see `tools` below).
  const [saveError, setSaveError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let live = true;
    setState({ loading: true, data: null, error: "" });
    Promise.resolve(load(id === "new" ? null : id))
      .then((data) => live && setState({ loading: false, data, error: "" }))
      .catch((err) => live && setState({ loading: false, data: null, error: err.message }));
    return () => {
      live = false;
    };
    // `load` is a fresh function each render; the id is what decides a reload.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // `to` overrides where to go — a create that should land on the new record.
  const back = (to) => navigate(typeof to === "string" ? to : backTo);

  if (state.loading) {
    return (
      <div className="page">
        <Loading />
      </div>
    );
  }

  if (!state.data) {
    return (
      <div className="page">
        <Banner tone="error">{state.error || "That record no longer exists."}</Banner>
        <button className="btn" onClick={back}>
          ← {backLabel}
        </button>
      </div>
    );
  }

  // For forms whose save used to live in the list page: run the request,
  // show its error on this page, and go back once it succeeds — to the path
  // the request returns, if it returns one.
  const tools = {
    saving,
    save: async (request) => {
      setSaving(true);
      setSaveError("");
      try {
        const next = await request();
        back(next);
      } catch (err) {
        setSaveError(err.message);
        window.scrollTo({ top: 0, behavior: "smooth" });
      } finally {
        setSaving(false);
      }
    },
  };

  return (
    <AsPage backLabel={backLabel} error={saveError}>
      {render(state.data, back, tools)}
    </AsPage>
  );
}
