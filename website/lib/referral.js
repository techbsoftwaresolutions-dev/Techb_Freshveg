// Invite link and share text for a customer's referral code. The link opens
// the sign-up page with the code already filled in.
export function inviteUrl(code) {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  return `${origin}/login?ref=${encodeURIComponent(code)}`;
}

export function inviteText(code, { friendReward, enabled = true } = {}, money = (v) => `₹${Math.round(v / 100)}`) {
  const reward = enabled && friendReward ? ` You get ${money(friendReward)} off after your first delivered order.` : "";
  return `Shop fresh groceries on Hosur Basket! Sign up with my referral code ${code}.${reward}`;
}

// Opens the phone's share sheet when there is one, otherwise copies the link.
// Returns "shared", "copied" or "" (dismissed / nothing happened).
export async function shareInvite(code, info) {
  const url = inviteUrl(code);
  const text = inviteText(code, info || {});
  try {
    if (typeof navigator !== "undefined" && navigator.share) {
      await navigator.share({ title: "Hosur Basket referral", text, url });
      return "shared";
    }
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      await navigator.clipboard.writeText(`${text} ${url}`);
      return "copied";
    }
  } catch {
    // Share sheet dismissed — nothing to do.
  }
  return "";
}
