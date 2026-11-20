const PHONE = "919003597158";
const MESSAGE = "Hi Hosur Basket, I need help with my order.";

export default function WhatsAppChat() {
  const href = `https://wa.me/${PHONE}?text=${encodeURIComponent(MESSAGE)}`;

  return (
    <a
      className="whatsapp-chat"
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Chat with Hosur Basket on WhatsApp"
      title="Chat with us on WhatsApp"
    >
      <svg viewBox="0 0 32 32" aria-hidden="true" focusable="false">
        <path fill="currentColor" d="M16.02 3.2A12.65 12.65 0 0 0 5.12 22.27L3.4 28.6l6.48-1.7a12.63 12.63 0 1 0 6.14-23.7Zm0 22.96c-1.91 0-3.78-.51-5.42-1.48l-.39-.23-3.85 1.01 1.03-3.75-.25-.4a10.26 10.26 0 1 1 8.88 4.85Zm5.63-7.69c-.31-.16-1.82-.9-2.1-1-.29-.1-.5-.15-.71.16-.21.32-.8 1-.98 1.21-.18.21-.36.24-.67.08-.31-.16-1.31-.48-2.5-1.52-.92-.82-1.54-1.83-1.72-2.14-.18-.32-.02-.49.14-.65.14-.14.31-.36.47-.53.16-.18.21-.31.31-.52.11-.21.06-.4-.03-.56-.08-.16-.71-1.71-.97-2.34-.25-.61-.51-.53-.7-.54h-.6c-.21 0-.55.08-.84.4-.29.32-1.1 1.06-1.1 2.59s1.12 3 1.28 3.21c.15.21 2.2 3.36 5.33 4.71.75.32 1.33.51 1.78.65.75.24 1.43.21 1.97.13.6-.09 1.82-.74 2.08-1.45.25-.71.25-1.32.18-1.45-.08-.13-.29-.21-.6-.37Z" />
      </svg>
    </a>
  );
}
