// A "use client" page cannot export metadata, so the title for this route
// lives in a thin server layout alongside it.
export const metadata = {
  title: "Edit profile",
  robots: { index: false, follow: false },
};

export default function Layout({ children }) {
  return children;
}
