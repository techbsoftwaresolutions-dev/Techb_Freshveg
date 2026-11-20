"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/client-api";

// Pincode -> true (we deliver) / false (we don't) / undefined (not checked yet).
// Answers are remembered for the life of the page, so opening the address
// picker again does not ask the server about the same pincodes twice.
const known = new Map();

export function useServiceability(pincodes) {
  const [, rerender] = useState(0);
  const key = [...new Set((pincodes || []).filter((p) => /^\d{6}$/.test(p)))].sort().join(",");

  useEffect(() => {
    let alive = true;
    const todo = key.split(",").filter((p) => p && !known.has(p));
    if (!todo.length) return undefined;

    Promise.all(
      todo.map((pincode) =>
        api
          .get("/storefront/serviceability", { pincode })
          .then((data) => known.set(pincode, Boolean(data.serviceable)))
          // A failed check says nothing about the pincode, so it stays unknown.
          .catch(() => {})
      )
    ).then(() => {
      if (alive) rerender((n) => n + 1);
    });

    return () => {
      alive = false;
    };
  }, [key]);

  return (pincode) => known.get(pincode);
}
