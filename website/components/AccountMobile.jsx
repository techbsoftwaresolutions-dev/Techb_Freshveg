"use client";

import Link from "next/link";
import { rupees, when } from "@/lib/format";
import {
  IconBack,
  IconChevron,
  IconCrown,
  IconFile,
  IconGift,
  IconHeadset,
  IconPin,
  IconShare,
  IconUser,
  IconWallet,
} from "./AccountIcons";
import SavedAddresses from "@/components/SavedAddresses";
import { StatusBadge } from "./OrderCard";

// The account screen as a phone sees it. It is only a different arrangement of
// what the page already has: the same user, store and recent-orders data, and
// the page's own share and sign-out handlers, passed in. Above 720px this is
// hidden and the desktop dashboard shows instead (see .acct-m in globals.css).
// Having .cat-mobile-head on the page is also what steps the site header, its
// search and category bars and the footer aside on phones.

export function AccountHead({ settings = true }) {
  return (
    <div className="cat-mobile-head acct-head">
      <Link href="/" aria-label="Back" className="cat-mobile-btn">
        <IconBack width={22} height={22} strokeWidth={2} />
      </Link>
      <h1 className="cat-mobile-title">My Account</h1>
      {settings ? <span className="cat-mobile-btn" aria-hidden="true" style={{ visibility: "hidden" }} /> : null}
    </div>
  );
}

const IconBag = (props) => (
  <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
    <path d="M5 8h14l-1 12H6L5 8Z" />
    <path d="M9 8V6.5a3 3 0 0 1 6 0V8" />
  </svg>
);
const IconHeart = (props) => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
    <path d="M12 20.5s-7.5-4.6-10-9.3C.6 8 1.8 4.5 5 3.4c2.1-.7 4.2 0 5.6 1.8l1.4 1.8 1.4-1.8c1.4-1.8 3.5-2.5 5.6-1.8 3.2 1.1 4.4 4.6 3 7.8-2.5 4.7-10 9.3-10 9.3Z" />
  </svg>
);
const IconTruck = (props) => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
    <path d="M3 6h11v9H3zM14 9h4l3 3v3h-7" />
    <circle cx="7" cy="17" r="1.8" />
    <circle cx="17" cy="17" r="1.8" />
  </svg>
);
const IconReturn = (props) => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
    <path d="M9 14 4 9l5-5" />
    <path d="M4 9h10a6 6 0 0 1 0 12h-3" />
  </svg>
);
const IconLogout = (props) => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
    <path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3" />
    <path d="M10 8l-4 4 4 4M6 12h10" />
  </svg>
);

function Row({ href, icon: Icon, title, note, value, onClick, tone }) {
  const inner = (
    <>
      <span className="ah-row-icon">
        <Icon width={20} height={20} />
      </span>
      <span className="ah-row-copy">
        <strong>{title}</strong>
        {note ? <span>{note}</span> : null}
      </span>
      {value !== undefined && value !== null && value !== "" ? <span className="ah-row-value">{value}</span> : null}
      {href || onClick ? <IconChevron className="ah-chev" width={16} height={16} /> : null}
    </>
  );
  if (!href && !onClick) return <div className="ah-row static">{inner}</div>;
  return href ? (
    <Link href={href} className={`ah-row${tone ? ` ${tone}` : ""}`}>
      {inner}
    </Link>
  ) : (
    <button type="button" className={`ah-row${tone ? ` ${tone}` : ""}`} onClick={onClick}>
      {inner}
    </button>
  );
}

export default function AccountMobile({ user, initials, store, pincode, recentOrders, shared, onShare, onSignOut }) {
  return (
    <div className="acct-m">
      <div className="ah-hero">
        {/* Having .cat-mobile-head on the page steps the site header and footer aside on phones. */}
        <div className="cat-mobile-head acct-head ah-top">
          <Link href="/" aria-label="Back" className="ah-back">
            <IconBack width={20} height={20} strokeWidth={2} />
          </Link>
        </div>

        <span className="ah-avatar-wrap">
          <span className="ah-avatar" aria-hidden="true">
            {user.avatar ? <img className="avatar-photo" src={user.avatar} alt="" /> : user.name ? initials : <IconUser width={44} height={44} />}
          </span>
          <Link href="/account/edit" className="ah-avatar-edit" aria-label="Edit profile" title="Edit profile">
            <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
            </svg>
          </Link>
        </span>
        <h1 className="ah-name">{user.name || "Your account"}</h1>
        <p className="ah-phone">+91 {user.phone}</p>
      </div>

      <div className="ah-quick">
        <Link href="/orders" className="ah-quick-tile">
          <IconBag />
          <span>Your orders</span>
        </Link>
        <div className="ah-quick-tile">
          <IconWallet width={26} height={26} />
          <span>Wallet {rupees(user.walletBalance)}</span>
        </div>
        <Link href="/help" className="ah-quick-tile">
          <IconHeadset width={26} height={26} />
          <span>Need help?</span>
        </Link>
      </div>

      <section className="ah-card">
        <h2 className="ah-card-title">Your information</h2>
        <Row href="/account/edit" icon={IconUser} title="Edit profile" note="Update your name and email" />
        <Row href="/wishlist" icon={IconHeart} title="Your wishlist" />
        <Row href="/track-order" icon={IconTruck} title="Track order" />
        <Row href="/returns" icon={IconReturn} title="Returns & refunds" />
      </section>

      <section className="ah-card">
        <h2 className="ah-card-title">Rewards</h2>
        <Row icon={IconCrown} title="Loyalty points" note="100 points = ₹10 off" value={user.loyaltyPoints ?? 0} />
        {user.referralCode ? (
          <Row
            icon={IconGift}
            title="Refer code"
            note={shared ? "Copied!" : "Tap to share"}
            onClick={() => onShare(user.referralCode)}
          />
        ) : null}
        <Row icon={IconPin} title="Delivery location" note={store?.name} value={pincode || store?.address?.city || "Not set"} />
      </section>

      <section className="am-card">
        <div className="am-card-head">
          <h2>Recent orders</h2>
          <Link href="/orders" className="am-link">
            View all
          </Link>
        </div>

        {recentOrders === null ? (
          <p className="am-empty">Loading…</p>
        ) : recentOrders.length ? (
          recentOrders.map((order) => {
            const items = order.items || [];
            const image = items.find((i) => i.image)?.image;
            return (
              <Link key={order.id} href={`/orders/${order.id}`} className="am-order">
                <span className="am-order-thumb">{image ? <img src={image} alt="" loading="lazy" /> : items[0]?.name?.[0]}</span>
                <span className="am-order-body">
                  <span className="am-order-r1">
                    <strong className="tabular am-order-code">{order.code}</strong>
                    <strong className="am-order-total">{rupees(order.pricing?.total)}</strong>
                  </span>
                  <span className="am-order-r2">
                    <span className="am-order-meta">
                      {when(order.placedAt)} · {items.length} item{items.length === 1 ? "" : "s"}
                    </span>
                    <StatusBadge status={order.status} />
                  </span>
                </span>
                <IconChevron className="am-chev" width={14} height={14} />
              </Link>
            );
          })
        ) : (
          null
        )}
      </section>

      <section className="am-card">
        <div className="am-card-head">
          <h2 className="am-card-title">
            <IconPin width={18} height={18} />
            Saved addresses
          </h2>
        </div>
        <SavedAddresses />
      </section>

      <section className="ah-card">
        <h2 className="ah-card-title">Help and legal</h2>
        <Row href="/help" icon={IconHeadset} title="Help Center" />
        <Row href="/terms" icon={IconFile} title="Terms & Conditions" />
        <Row icon={IconLogout} title="Log out" onClick={onSignOut} tone="danger" />
      </section>
    </div>
  );
}
