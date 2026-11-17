const scope = (owner, showtime) => `${encodeURIComponent(owner)}:${encodeURIComponent(showtime)}`;
const cartKey = (owner, showtime, revision) => `booking:cart:${scope(owner, showtime)}:${revision}`;
const cartPointer = (owner, showtime) => `booking:cart-current:${scope(owner, showtime)}`;
const checkoutPrefix = (owner, showtime) => `booking:checkout:${scope(owner, showtime)}:`;
const checkoutKey = (owner, showtime, order) => checkoutPrefix(owner, showtime) + order;
const checkoutPointer = (owner, showtime) => `booking:checkout-current:${scope(owner, showtime)}`;
const parse = (value) => { try { return JSON.parse(value); } catch { return null; } };

export function readCart(owner, showtime) {
  const revision = localStorage.getItem(cartPointer(owner, showtime));
  const seats = revision && parse(localStorage.getItem(cartKey(owner, showtime, revision)));
  return Array.isArray(seats) ? { seats, revision } : { seats: [], revision: null };
}

export function saveCart(owner, showtime, seats, previousRevision = null) {
  const revision = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  localStorage.setItem(cartKey(owner, showtime, revision), JSON.stringify(seats));
  localStorage.setItem(cartPointer(owner, showtime), revision);
  if (previousRevision) localStorage.removeItem(cartKey(owner, showtime, previousRevision));
  return revision;
}

export function rememberCheckout(owner, showtime, orderId, cartRevision = null) {
  localStorage.setItem(checkoutKey(owner, showtime, orderId), JSON.stringify({
    owner, showtime, orderId, cartRevision, savedAt: Date.now(),
  }));
  localStorage.setItem(checkoutPointer(owner, showtime), orderId);
}

export function checkoutReferences(owner, showtime) {
  const prefix = checkoutPrefix(owner, showtime);
  const records = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key?.startsWith(prefix)) continue;
    const record = parse(localStorage.getItem(key));
    if (record?.owner === owner && record.showtime === showtime && record.orderId) records.push(record);
  }
  const latest = localStorage.getItem(checkoutPointer(owner, showtime));
  records.sort((a, b) => Number(b.orderId === latest) - Number(a.orderId === latest) || b.savedAt - a.savedAt);
  // Old keys have no owner. They are read-only candidates until the API verifies
  // ownership; never delete them on behalf of a different account or old order.
  const legacy = localStorage.getItem(`checkout_order_${showtime}`);
  if (legacy && !records.some(record => record.orderId === legacy)) records.push({ orderId: legacy, legacy: true });
  return records;
}

export function finishCheckout(owner, showtime, orderId) {
  if (!showtime) {
    // Expired checkout responses may intentionally have no seats/showtime.
    // Find only this account's exact order; never clear a shared showtime key.
    const prefix = `booking:checkout:${encodeURIComponent(owner)}:`;
    for (let i = 0; i < localStorage.length; i++) {
      const candidate = localStorage.key(i);
      if (!candidate?.startsWith(prefix)) continue;
      const record = parse(localStorage.getItem(candidate));
      if (record?.owner === owner && record.orderId === orderId && record.showtime) {
        finishCheckout(owner, record.showtime, orderId);
        return;
      }
    }
    return;
  }
  const key = checkoutKey(owner, showtime, orderId);
  const record = parse(localStorage.getItem(key));
  localStorage.removeItem(key);
  if (record?.cartRevision) localStorage.removeItem(cartKey(owner, showtime, record.cartRevision));
  // Do not compare-and-delete a shared pointer: another tab can replace it
  // between those operations. Delete only this order's immutable cart record.
}
