import { useEffect, useRef, useState } from "react";
import { Modal } from "./ui";

// The one confirmation dialog for the whole admin, opened by confirmDialog()
// in api/client.js. It only answers yes / no (or the typed text): the caller
// still runs the action and shows its own busy state, as it did with
// window.confirm.
export default function Confirmer() {
  const [ask, setAsk] = useState(null);
  const [text, setText] = useState("");
  const [typed, setTyped] = useState("");
  const returnFocus = useRef(null);

  useEffect(() => {
    const onAsk = (event) => {
      returnFocus.current = document.activeElement;
      setText("");
      setTyped("");
      setAsk(event.detail);
    };
    window.addEventListener("admin-confirm", onAsk);
    return () => window.removeEventListener("admin-confirm", onAsk);
  }, []);

  const close = (answer) => {
    ask.resolve(answer);
    setAsk(null);
    returnFocus.current?.focus?.();
  };

  // Escape is caught here first, so a confirmation opened from inside another
  // dialog closes alone instead of taking that dialog with it.
  useEffect(() => {
    if (!ask) return undefined;
    const onKey = (e) => {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      close(false);
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  });

  if (!ask) return null;

  const { title, message, confirmText = "Confirm", cancelText = "Cancel", danger, input, typeToConfirm } = ask;
  const ready = (!input?.required || text.trim()) && (!typeToConfirm || typed === typeToConfirm);

  return (
    <Modal
      title={title}
      onClose={() => close(false)}
      footer={
        <>
          <button type="button" className="btn" onClick={() => close(false)}>
            {cancelText}
          </button>
          <button type="submit" form="confirm-dialog" className={`btn ${danger ? "danger" : "primary"}`} disabled={!ready} autoFocus={!input && !typeToConfirm}>
            {confirmText}
          </button>
        </>
      }
    >
      <form
        id="confirm-dialog"
        className="confirm-dialog"
        onSubmit={(e) => {
          e.preventDefault();
          if (ready) close(input ? text.trim() : true);
        }}
      >
        {message && <p>{message}</p>}
        {input && (
          <div className="field">
            <label htmlFor="confirm-dialog-input">{input.label}</label>
            <textarea id="confirm-dialog-input" rows={3} placeholder={input.placeholder} value={text} onChange={(e) => setText(e.target.value)} autoFocus />
          </div>
        )}
        {typeToConfirm && (
          <div className="field">
            <label htmlFor="confirm-dialog-typed">Type {typeToConfirm} to confirm</label>
            <input id="confirm-dialog-typed" value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" autoFocus={!input} />
          </div>
        )}
      </form>
    </Modal>
  );
}
