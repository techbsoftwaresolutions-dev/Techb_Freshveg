"use client";

import { useState } from "react";
import { img } from "@/lib/format";

// The single client island on the media side of the product page: which
// shot is enlarged. Everything else there stays server-rendered HTML.
export default function ProductGallery({ media = [], name, badge }) {
  const shots = media.filter((m) => m?.url);
  const [active, setActive] = useState(0);
  const [zoom, setZoom] = useState(false);
  const [origin, setOrigin] = useState("50% 50%");
  const current = shots[active] || shots[0];

  function moveZoom(event) {
    if (event.pointerType === "touch") return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - bounds.left) / bounds.width) * 100;
    const y = ((event.clientY - bounds.top) / bounds.height) * 100;
    setOrigin(`${x}% ${y}%`);
  }

  return (
    <div className="gallery">
      <div
        className={`gallery-main card-media${zoom ? " zooming" : ""}`}
        style={{ aspectRatio: "1 / 1", border: "1px solid var(--border)" }}
        onPointerEnter={(event) => { if (event.pointerType !== "touch") setZoom(true); }}
        onPointerMove={moveZoom}
        onPointerLeave={() => { setZoom(false); setOrigin("50% 50%"); }}
      >
        {current ? <img src={img(current.url, 1200)} alt={name} style={{ transformOrigin: origin }} /> : null}
        {badge}
      </div>

      {shots.length > 1 ? (
        <div className="gallery-thumbs">
          {shots.map((shot, index) => (
            <button
              key={shot.url + index}
              type="button"
              className={`gallery-thumb${index === active ? " on" : ""}`}
              onClick={() => setActive(index)}
              aria-label={`Show photo ${index + 1} of ${shots.length}`}
              aria-pressed={index === active}
            >
              <img src={img(shot.url, 160)} alt="" />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
