// Small line icons for the account screen — 24px grid, stroke only, coloured by
// the parent (currentColor), in the same hand-drawn style as the rest of the
// site's inline icons.

const base = {
  viewBox: "0 0 24 24",
  width: 20,
  height: 20,
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": true,
};

const make = (paths) =>
  function Icon(props) {
    return <svg {...base} {...props}>{paths}</svg>;
  };

export const IconWallet = make(
  <>
    <path d="M4 7.5A2.5 2.5 0 0 1 6.5 5H18v3" />
    <path d="M4 7.5V17a2 2 0 0 0 2 2h12.5a1.5 1.5 0 0 0 1.5-1.5v-8A1.5 1.5 0 0 0 18.5 8H6.5A2.5 2.5 0 0 1 4 5.5" />
    <circle cx="16" cy="13.5" r="1.1" fill="currentColor" stroke="none" />
  </>
);
export const IconCrown = make(
  <>
    <path d="m4 8 4.5 4L12 6l3.5 6L20 8l-1.5 9h-13L4 8Z" />
    <path d="M6 20h12" />
  </>
);
export const IconGift = make(
  <>
    <rect x="3.5" y="9" width="17" height="4" rx="1" />
    <path d="M5 13v6.5h14V13M12 9v10.5" />
    <path d="M12 9c-2.8 0-4.5-1-4.5-2.6C7.5 5.2 8.4 4.5 9.5 4.5 11 4.5 12 6.5 12 9Zm0 0c2.8 0 4.5-1 4.5-2.6 0-1.2-.9-1.9-2-1.9C13 4.5 12 6.5 12 9Z" />
  </>
);
export const IconPin = make(
  <>
    <path d="M12 21s6.5-5.7 6.5-11A6.5 6.5 0 0 0 5.5 10c0 5.3 6.5 11 6.5 11Z" />
    <circle cx="12" cy="10" r="2.3" />
  </>
);
export const IconGear = make(
  <>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 14.5a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.6 1.6 0 0 0-1-1.5 1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.6 1.6 0 0 0 1.5-1 1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3h0a1.6 1.6 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8v0a1.6 1.6 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1Z" />
  </>
);
export const IconFile = make(
  <>
    <path d="M7 3.5h7l4 4V20a.5.5 0 0 1-.5.5h-10.5A.5.5 0 0 1 6.5 20V4a.5.5 0 0 1 .5-.5Z" />
    <path d="M14 3.5V8h4M9 12.5h6M9 16h6" />
  </>
);
export const IconHeadset = make(
  <>
    <path d="M4.5 14v-2a7.5 7.5 0 0 1 15 0v2" />
    <rect x="3.5" y="13.5" width="4" height="6" rx="1.5" />
    <rect x="16.5" y="13.5" width="4" height="6" rx="1.5" />
    <path d="M18.5 19.5c0 1.2-1.4 2-3.5 2h-2" />
  </>
);
export const IconHeart = make(
  <path d="M12 20.5s-7.5-4.6-10-9.3C.6 8 1.8 4.5 5 3.4c2.1-.7 4.2 0 5.6 1.8l1.4 1.8 1.4-1.8c1.4-1.8 3.5-2.5 5.6-1.8 3.2 1.1 4.4 4.6 3 7.8-2.5 4.7-10 9.3-10 9.3Z" />
);
export const IconChevron = make(<path d="m9 5 7 7-7 7" />);
export const IconShare = make(
  <>
    <circle cx="6" cy="12" r="2.3" />
    <circle cx="17.5" cy="6" r="2.3" />
    <circle cx="17.5" cy="18" r="2.3" />
    <path d="m8 11 7.5-3.8M8 13l7.5 3.8" />
  </>
);
export const IconBack = make(<path d="M19 12H5M11 6l-6 6 6 6" />);
