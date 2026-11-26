// Small, dependency-free line-icon set keyed by keyword. No icon package is
// installed and nothing here pretends to be a product photo — just a
// coloured glyph that gives each department a visual anchor, the same way
// the disc placeholders it replaces did.
const ICONS = {
  fruit: (
    <path d="M12 8c-3.5 0-6 2.6-6 6.2C6 18 8.7 21 12 21s6-3 6-6.8C18 10.6 15.5 8 12 8Z M12 8c0-2 1-3.6 2.6-4.4 M9.8 5.2c.6-1 1.6-1.7 2.2-1.7" />
  ),
  vegetable: (
    <path d="M12 4c3 0 5 2.4 5 6 0 5-2.6 9.5-5 11-2.4-1.5-5-6-5-11 0-3.6 2-6 5-6Z M12 4V2 M9 6.5c1-1 2-1.5 3-1.5s2 .5 3 1.5" />
  ),
  dairy: (
    <path d="M9 3h6l.8 3.2c.2.7.2 1.4 0 2.1L15 12v7a2 2 0 0 1-2 2h-2a2 2 0 0 1-2-2v-7l-.8-3.7c-.2-.7-.2-1.4 0-2.1L9 3Z M9 9h6" />
  ),
  staple: (
    <path d="M7 9h10l-1 10a2 2 0 0 1-2 1.8h-4A2 2 0 0 1 8 19L7 9Z M9 9V7a3 3 0 0 1 6 0v2" />
  ),
  oil: (
    <path d="M10 3h4l1 3-1 2v10a2 2 0 0 1-2 2 2 2 0 0 1-2-2V8L9 6l1-3Z M9.5 12h5" />
  ),
  spice: (
    <path d="M6 10a6 6 0 0 1 12 0c0 5-2 9-6 11-4-2-6-6-6-11Z M9.5 9.5h5M9 13h6" />
  ),
  snack: (
    <path d="M5 8h14l-1.4 10.2A2 2 0 0 1 15.6 20H8.4a2 2 0 0 1-2-1.8L5 8Z M8 8 9.5 4h5L16 8" />
  ),
  beverage: (
    <path d="M8 3h8l-1 4H9L8 3Z M9 7l1 12.2A1.8 1.8 0 0 0 11.8 21h.4a1.8 1.8 0 0 0 1.8-1.8L15 7 M9.5 12h5" />
  ),
  household: (
    <path d="M4 11 12 4l8 7 M6 10.5V20a1 1 0 0 0 1 1h3v-5h4v5h3a1 1 0 0 0 1-1v-9.5" />
  ),
  personal: (
    <path d="M12 3a3 3 0 0 1 3 3c0 1.3-.7 2.2-1.5 3.1-.6.6-.9 1-.9 1.9v1h-1.2v-1c0-.9-.3-1.3-.9-1.9C9.7 8.2 9 7.3 9 6a3 3 0 0 1 3-3Z M9.5 14h5l1 6a1 1 0 0 1-1 1.2h-5a1 1 0 0 1-1-1.2l1-6Z" />
  ),
  baby: (
    <path d="M12 14c4 0 6.5 2.3 6.5 5.2 0 .5-.4.8-.9.8H6.4c-.5 0-.9-.3-.9-.8C5.5 16.3 8 14 12 14Z M9 7a3 3 0 1 1 6 0 3 3 0 0 1-6 0Z M9 6.5c-1.2 0-2-.7-2-1.7M15 6.5c1.2 0 2-.7 2-1.7" />
  ),
  bakery: (
    <path d="M12 5c3.5 0 6 2.7 6 6.3 0 .5-.1.9-.3 1.3.9.5 1.5 1.4 1.5 2.5 0 1.7-1.5 3-3.4 3H8.2c-1.9 0-3.4-1.3-3.4-3 0-1.1.6-2 1.5-2.5A3.3 3.3 0 0 1 6 11.3C6 7.7 8.5 5 12 5Z" />
  ),
  frozen: (
    <path d="M12 3v18M4.5 7.5l15 9M19.5 7.5l-15 9 M12 12l3.5-2M12 12l-3.5-2M12 12l3.5 2M12 12l-3.5 2" />
  ),
  meat: (
    <path d="M8 15c-2.5 0-4-1.8-4-4a4 4 0 0 1 6.8-2.8l6 6A4 4 0 1 1 11 20l-.7-.7 M9.5 9.5l5 5" />
  ),
  offer: (
    <path d="M20 12.5 12.5 20a2 2 0 0 1-2.8 0l-6.7-6.7a2 2 0 0 1-.6-1.4V5a2 2 0 0 1 2-2h6.9a2 2 0 0 1 1.4.6l6.7 6.7a2 2 0 0 1 .1 2.2Z M8 8h.01" />
  ),
  basket: (
    <path d="M4 9h16l-1.6 9.3A2 2 0 0 1 16.5 20h-9a2 2 0 0 1-2-1.7L4 9Z M8 9 9.5 4h5L16 9 M10 13v3M14 13v3" />
  ),
};

const RULES = [
  [/fruit/i, "fruit"],
  [/veg|leafy|exotic/i, "vegetable"],
  [/dairy|milk|egg/i, "dairy"],
  [/staple|grain|rice|atta|flour/i, "staple"],
  [/oil|ghee/i, "oil"],
  [/spice|masala/i, "spice"],
  [/snack/i, "snack"],
  [/beverage|drink|juice/i, "beverage"],
  [/household|clean|home/i, "household"],
  [/personal|hair|beauty|hygiene|care/i, "personal"],
  [/baby|kid/i, "baby"],
  [/bakery|bread/i, "bakery"],
  [/frozen/i, "frozen"],
  [/meat|fish|poultry/i, "meat"],
  [/offer|deal/i, "offer"],
];

export function iconKeyFor(name = "") {
  const match = RULES.find(([re]) => re.test(name));
  return match ? match[1] : "basket";
}

export default function CategoryIcon({ name, className }) {
  const key = iconKeyFor(name);
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {ICONS[key]}
    </svg>
  );
}
