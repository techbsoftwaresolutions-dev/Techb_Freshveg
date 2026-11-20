// Fire-and-forget toast from anywhere (the API client, a page, the Banner).
// `generic` marks the automatic "saved" message from the API client: a page's
// own, more specific message replaces it instead of showing twice.
export const toast = (text, tone = "ok", generic = false) => {
  if (text) window.dispatchEvent(new CustomEvent("app:toast", { detail: { text, tone, generic } }));
};
