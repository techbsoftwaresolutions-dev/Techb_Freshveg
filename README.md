# ShopNest — Full E-commerce Website (React)

A complete, working e-commerce storefront built with React, React Router and Vite —
in the style of Amazon / Flipkart. Runs entirely on the frontend with mock product
data, so it works with zero backend setup.

## Features

- **Home page** — hero banner, category tiles, "today's deals" and "trending" sections
- **Product listing** — filter by category, price range, rating; sort by price/rating; search
- **Product detail page** — image, price, stock, highlights, quantity selector, related products
- **Cart** — add/remove items, change quantity, live price breakdown with savings
- **Checkout** — delivery address form, payment method selection, order summary
- **Order success page**
- **Login / Sign up page** (mock — no backend, ready for you to connect one)
- Fully responsive (desktop, tablet, mobile)
- 22 sample products across 6 categories (Electronics, Fashion, Home, Books, Beauty, Sports)

## Tech stack

- React 18
- React Router v6
- Vite (dev server + build tool)
- Plain CSS (no framework needed, no extra setup)

## Getting started

1. **Install Node.js** (v18 or newer) from https://nodejs.org if you don't have it.
2. Open a terminal in this folder and install dependencies:

   ```bash
   npm install
   ```

3. Start the development server:

   ```bash
   npm run dev
   ```

4. Open the URL shown in the terminal (usually **http://localhost:5173**) in your browser.

That's it — the site is running locally.

## Building for production

```bash
npm run build
```

This creates an optimized build in the `dist/` folder. You can preview it locally with:

```bash
npm run preview
```

You can deploy the `dist/` folder to any static host (Vercel, Netlify, GitHub Pages, etc.).

## Project structure

```
ecommerce-app/
├── index.html
├── package.json
├── vite.config.js
└── src/
    ├── main.jsx              # App entry point
    ├── App.jsx               # Routes
    ├── index.css             # All styling
    ├── data/
    │   └── products.js       # Mock product catalog — replace with a real API later
    ├── context/
    │   └── CartContext.jsx   # Global cart state (React Context + useReducer)
    ├── components/
    │   ├── Header.jsx
    │   ├── Footer.jsx
    │   └── ProductCard.jsx
    └── pages/
        ├── Home.jsx
        ├── ProductList.jsx
        ├── ProductDetail.jsx
        ├── Cart.jsx
        ├── Checkout.jsx
        ├── OrderSuccess.jsx
        ├── Login.jsx
        └── NotFound.jsx
```

## Connecting a real backend

Everything currently runs on mock data in `src/data/products.js` and in-memory cart
state. To make this production-ready:

- Replace `products.js` with API calls (e.g. `fetch('/api/products')`) to your backend.
- Replace the mock `Login.jsx` submit handler with a real auth API call, and store the
  session (e.g. in an HTTP-only cookie set by your backend, or a token in memory).
- Replace the `Checkout.jsx` "Place Order" handler with a real order-creation API call
  and a payment gateway integration (Razorpay, Stripe, PayPal, etc.).
- Add a database (PostgreSQL/MongoDB) behind an API (Node/Express, Django, etc.) to
  persist products, users and orders.

## Notes

- Cart state resets on page refresh by design (kept in React state, not localStorage,
  to keep the demo simple and dependency-free). Ask if you'd like it persisted to
  localStorage or a backend instead.
- Product images are placeholder images from picsum.photos — swap in real product
  photos by changing the `image` field in `src/data/products.js`.
