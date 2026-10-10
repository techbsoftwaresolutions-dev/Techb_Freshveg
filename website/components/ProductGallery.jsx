"use client";

import { useState } from "react";
import { img } from "@/lib/format";
import { imageAlt } from "@/lib/seo";

// The single client island on the media side of the product page: which
// shot is enlarged. Everything else there stays server-rendered HTML.
export default function ProductGallery({ media = [], name, badge }) {
  const shots = media.filter((m) => m?.url);
  const [active, setActive] = useState(0);
  const current = shots[active] || shots[0];

  return (
    <div className="gallery">
      <div className="gallery-main card-media" style={{ aspectRatio: "1 / 1", border: "1px solid var(--border)" }}>
        {current ? <img src={img(current.url, 900)} alt={imageAlt(name, current, shots.indexOf(current))} /> : null}
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
              <img src={img(shot.url, 160)} alt={imageAlt(name, shot, index)} loading="lazy" />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
