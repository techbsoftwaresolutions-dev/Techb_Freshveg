// A "use client" page cannot export metadata, so the title for this route
// lives in a thin server layout alongside it. A wishlist is per person: keep it out of search.
export const metadata = {
  title: "Your wishlist",
  description: "Items you have saved at Hosur Basket.",
  robots: { index: false, follow: false },
};

export default function Layout({ children }) {
  return children;
}
