"use client";

import Link from "next/link";
import { rupees, when } from "@/lib/format";
import {
  IconBack,
  IconChevron,
  IconCrown,
  IconFile,
  IconGear,
  IconGift,
  IconHeadset,
  IconPin,
  IconShare,
  IconUser,
  IconWallet,
} from "./AccountIcons";
import SavedAddresses from "@/components/SavedAddresses";
import ReferralPanel from "@/components/ReferralPanel";
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
      {settings ? (
        <Link href="/account/edit" aria-label="Account settings" className="cat-mobile-btn">
          <IconGear width={22} height={22} />
        </Link>
      ) : null}
    </div>
  );
}

function Tile({ icon: Icon, title, value, note, children }) {
  return (
    <div className="am-tile">
      <span className="am-tile-icon">
        <Icon width={18} height={18} />
      </span>
      <span className="am-tile-title">{title}</span>
      <div className="am-tile-value">{value}</div>
      {note ? <span className="am-tile-note">{note}</span> : null}
      {children}
    </div>
  );
}

export default function AccountMobile({ user, initials, store, pincode, recentOrders, shared, onShare, onSignOut }) {
  return (
    <div className="acct-m">
      <AccountHead />

      <section className="am-profile">
        <svg className="am-leaf" viewBox="0 0 120 120" aria-hidden="true">
          <path d="M20 100C20 50 55 15 105 12c3 48-28 86-85 88Z" fill="currentColor" />
          <path d="M20 100C45 70 70 48 98 24" stroke="var(--brand)" strokeWidth="3" fill="none" strokeLinecap="round" />
        </svg>
        <span className="am-avatar" aria-hidden="true">
          {initials}
        </span>
        <div className="am-profile-copy">
          <strong>{user.name || "Add your name"}</strong>
          <span>+91 {user.phone}</span>
        </div>
        <div className="am-actions">
          <Link href="/account/edit" className="am-edit-btn" aria-label="Edit profile" title="Edit profile">
            <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M12 20h9" />
              <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
            </svg>
          </Link>
          <button type="button" className="am-signout" onClick={onSignOut}>
            Sign out
          </button>
        </div>
      </section>

      <div className="am-tiles">
        <Tile icon={IconWallet} title="Wallet balance" value={rupees(user.walletBalance)} />
        <Tile icon={IconCrown} title="Loyalty points" value={user.loyaltyPoints ?? 0} note="100 points = ₹10 off" />
        {user.referralCode ? (
          <div className="am-tile">
            <span className="am-tile-icon">
              <IconGift width={18} height={18} />
            </span>
            <span className="am-tile-title">Refer a friend</span>
            <div className="am-tile-row">
              <strong className="am-code">{user.referralCode}</strong>
              <button type="button" className="am-share" onClick={() => onShare(user.referralCode)} aria-label="Share referral code">
                {shared ? "Copied!" : <IconShare width={18} height={18} />}
              </button>
            </div>
          </div>
        ) : null}
        <Tile
          icon={IconPin}
          title="Delivery location"
          value={pincode || store?.address?.city || "Not set"}
          note={store?.name}
        />
      </div>

      {user.referralCode ? <ReferralPanel code={user.referralCode} /> : null}

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
          <p className="am-empty">No orders yet — when you place one it will show up here.</p>
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

      <nav className="am-card am-menu" aria-label="Account">
        <Link href="/account/edit" className="am-menu-row">
          <span className="am-menu-icon">
            <IconUser width={19} height={19} />
          </span>
          <span className="am-menu-copy">
            <strong>Edit profile</strong>
            <span>Update your name and email</span>
          </span>
          <IconChevron className="am-chev" width={16} height={16} />
        </Link>
        <Link href="/terms" className="am-menu-row">
          <span className="am-menu-icon">
            <IconFile width={19} height={19} />
          </span>
          <span className="am-menu-copy">
            <strong>Terms &amp; Conditions</strong>
          </span>
          <IconChevron className="am-chev" width={16} height={16} />
        </Link>
        <Link href="/help" className="am-menu-row">
          <span className="am-menu-icon">
            <IconHeadset width={19} height={19} />
          </span>
          <span className="am-menu-copy">
            <strong>Help Center</strong>
          </span>
          <IconChevron className="am-chev" width={16} height={16} />
        </Link>
      </nav>
    </div>
  );
}
