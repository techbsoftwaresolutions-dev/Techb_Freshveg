"use client";

import { useEffect, useRef, useState } from "react";

// Renders its children only when they are about to scroll into view (500px ahead), so the
// home page paints the top of the page first instead of building every product row at once.
// Until then it holds the space with a placeholder so the page does not jump.
export default function LazySection({ children, minHeight = 340 }) {
  const ref = useRef(null);
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (show || !ref.current) return undefined;
    if (!("IntersectionObserver" in window)) {
      setShow(true);
      return undefined;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setShow(true);
          observer.disconnect();
        }
      },
      { rootMargin: "500px 0px" }
    );
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, [show]);

  return (
    <div ref={ref} style={show ? undefined : { minHeight }}>
      {show ? children : null}
    </div>
  );
}
