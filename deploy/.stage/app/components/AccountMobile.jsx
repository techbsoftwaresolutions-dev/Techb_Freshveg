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

const MAX_ADDRESSES = 2;

export default function AccountMobile({ user, initials, store, pincode, recentOrders, shared, onShare, onSignOut }) {
  const addresses = user.addresses || [];
  const shownAddresses = addresses.slice(0, MAX_ADDRESSES);
  const moreAddresses = addresses.length - shownAddresses.length;

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
          <Link href="/account/edit" className="am-edit">
            Edit profile
          </Link>
        </div>
        <button type="button" className="am-signout" onClick={onSignOut}>
          Sign out
        </button>
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
                <span className="am-order-main">
                  <strong className="tabular">{order.code}</strong>
                  <span>{when(order.placedAt)}</span>
                  <span>
                    {items.length} item{items.length === 1 ? "" : "s"}
                  </span>
                </span>
                <span className="am-order-side">
                  <strong>{rupees(order.pricing?.total)}</strong>
                  <StatusBadge status={order.status} />
                </span>
                <IconChevron className="am-chev" width={16} height={16} />
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
        {shownAddresses.length ? (
          <>
            {shownAddresses.map((address) => (
              <div key={address.id} className="am-address">
                <strong>
                  {address.label}
                  {address.isDefault ? <span className="am-default">Default</span> : null}
                </strong>
                <span>
                  {[address.line1, address.line2, address.landmark, address.city, address.pincode].filter(Boolean).join(", ")}
                </span>
              </div>
            ))}
            {moreAddresses > 0 ? <p className="am-more">+{moreAddresses} more saved</p> : null}
          </>
        ) : (
          <p className="am-empty">No addresses saved yet — you can add one at checkout.</p>
        )}
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
        <Link href="/account/refer" className="am-menu-row">
          <span className="am-menu-icon">
            <IconCrown width={19} height={19} />
          </span>
          <span className="am-menu-copy">
            <strong>Refer &amp; earn</strong>
            <span>Your code, friends&apos; progress and rewards</span>
          </span>
          <IconChevron className="am-chev" width={16} height={16} />
        </Link>
        <Link href="/account/coupons" className="am-menu-row">
          <span className="am-menu-icon">
            <IconFile width={19} height={19} />
          </span>
          <span className="am-menu-copy">
            <strong>My coupons</strong>
            <span>Rewards ready to use at checkout</span>
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
