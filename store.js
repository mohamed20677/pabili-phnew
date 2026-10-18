// Pabili PH — local engine: state, persistence, order lifecycle,
// multi-round negotiation with 30s/60s deadlines, photo proof chain,
// wallets, commissions, KYC queue, admin actions + audit, bot counterparties.
import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { uid, now } from './lib';

const KEY = 'pabili.ph.v1';
const DRIVER_NAMES = ['Juan D.', 'Maria S.', 'Pedro R.', 'Ana L.'];
const BOT_CUSTOMERS = ['Ramon C.', 'Liza M.', 'Jose P.', 'Karen V.'];
const ITEMS = ['2kg rice, 1 tomato paste, 3 eggs', '1 LPG tank refill', 'Pain reliever + vitamins', 'Bread, milk, coffee', 'Phone load ₱100', 'Fried chicken bucket'];

const DEMO_USERS = [
  { id: 'u_c1', name: 'Ramon Cruz', role: 'customer', phone: '+63917111001', wallet: 350, credit: 40, frozen: false, verified: true },
  { id: 'u_c2', name: 'Liza Mercado', role: 'customer', phone: '+63917111002', wallet: 90, credit: 0, frozen: false, verified: true },
  { id: 'u_d1', name: 'Juan Dela Cruz', role: 'driver', phone: '+63917111003', wallet: 720, credit: 130, frozen: false, verified: true },
  { id: 'u_d2', name: 'Maria Santos', role: 'driver', phone: '+63917111004', wallet: 150, credit: 60, frozen: false, verified: true },
  { id: 'u_v1', name: 'Aling Nena Sari-sari', role: 'vendor', phone: '+63917111005', wallet: 2400, credit: 0, frozen: false, verified: true },
  { id: 'u_v2', name: 'Botika ni Jose', role: 'vendor', phone: '+63917111006', wallet: 980, credit: 0, frozen: false, verified: false },
];

const DEFAULTS = () => ({
  auth: null, terms: false,
  roles: { driver: { status: 'none', data: null }, vendor: { status: 'none', data: null } },
  activeRole: 'customer',
  profile: { name: 'Pabili User', rating: 5.0, coupons: [] },
  addresses: [
    { label: 'Home', addr: '3641 Yarmouk St, Aqrabiyah, Brgy. Sta. Rosa' },
    { label: 'Work', addr: '3918 Al Hasa St, Al Khaleej' },
  ],
  wallet: { balance: 0, credit: 0, tx: [] },
  catalog: [
    { id: 'c1', name: 'Rice 1kg', price: 58 },
    { id: 'c2', name: 'Softdrinks 1.5L', price: 75 },
    { id: 'c3', name: 'Instant noodles', price: 18 },
  ],
  orders: [], alerts: [], audit: [],
  users: DEMO_USERS,
  kyc: [
    { id: uid(), userId: 'u_v2', name: 'Botika ni Jose', role: 'vendor', status: 'pending', ts: now() - 86400000,
      data: { store: 'Botika ni Jose', type: 'Pharmacy', permit: 'permit-photo.jpg', front: 'storefront.jpg' } },
    { id: uid(), userId: 'u_d2', name: 'Maria Santos', role: 'driver', status: 'pending', ts: now() - 43200000,
      data: { vehicle: 'Motorbike', model: 'Honda Click 125', plate: 'ABC-1234', license: 'license.jpg', selfie: 'selfie-id.jpg' } },
  ],
  settings: {
    commissions: { customerPct: 3, vendorPct: 8, driverPct: 10 },
    offerSecs: 30, vendorSecs: 60, maxDrivers: 3,
    categories: ['Sari-sari', 'Groceries', 'Pharmacy', 'Gas / LPG', 'Food', 'Parcel', 'Flowers', 'Hardware'],
    banner: { title: 'Your favorite store has no delivery?', cta: 'Order it from here' },
    promoBar: true,
  },
  botSeed: 0,
});

const Ctx = createContext(null);
export const useStore = () => useContext(Ctx);

export function StoreProvider({ children }) {
  const [s, setS] = useState(null);
  const [tick, setTick] = useState(0);
  const sRef = useRef(s); sRef.current = s;

  useEffect(() => { AsyncStorage.getItem(KEY).then((v) => setS(v ? JSON.parse(v) : DEFAULTS())); }, []);
  useEffect(() => { if (s) AsyncStorage.setItem(KEY, JSON.stringify(s)); }, [s]);

  // ---------- engine tick: deadlines + bot progress every 1s ----------
  useEffect(() => {
    const t = setInterval(() => { setTick((x) => x + 1); setS((cur) => engine(cur)); }, 1000);
    return () => clearInterval(t);
  }, []);

  function engine(cur) {
    if (!cur) return cur;
    let changed = false;
    const orders = cur.orders.map((o) => {
      const n = { ...o };
      const age = (now() - n.updated) / 1000;

      // --- MY customer orders: bot vendor quotes ---
      if (n.mine && n.kind === 'order' && n.status === 'vendor_quote' && age > 4) {
        n.price = Math.round(80 + Math.random() * 220);
        n.photos = { ...n.photos, product: photo('vendor', 'product') };
        n.neg = { phase: 'vendor', turn: 'me', amount: n.price, deadline: now() + cur.settings.vendorSecs * 1000,
                  history: [{ by: 'vendor', amount: n.price, ts: now(), note: 'Store quote + product photo' }] };
        n.status = 'quote_review'; n.updated = now(); changed = true;
      }
      // --- bot vendor answers my counter ---
      if (n.mine && n.neg && n.neg.phase === 'vendor' && n.neg.turn === 'them' && age > 3) {
        const base = n.neg.history[0].amount;
        const ask = n.neg.amount;
        if (ask >= base * 0.8) { // accept my counter
          n.neg.history.push({ by: 'vendor', amount: ask, ts: now(), note: 'Store accepted your price' });
          n.price = ask; n.neg = null; n.status = 'quote_review'; n.updated = now();
          n.acceptPrice = true;
        } else {
          const mid = Math.round((ask + base) / 2);
          n.neg = { ...n.neg, turn: 'me', amount: mid, deadline: now() + cur.settings.offerSecs * 1000,
                    history: [...n.neg.history, { by: 'vendor', amount: mid, ts: now(), note: 'Store counter' }] };
          n.updated = now();
        }
        changed = true;
      }
      // --- vendor quote timeout (my turn to answer the store) -> keep waiting (customer owns cancel) ---
      // --- MY orders: driver dispatch chain ---
      if (n.mine && (n.status === 'finding_driver' || n.status === 'driver_offer') && !n.neg) {
        const idx = n.driverIdx || 0;
        if (n.status === 'finding_driver' && age > 3) {
          if (idx >= cur.settings.maxDrivers) {
            n.widened = true; n.note = 'Widening search area…'; n.updated = now(); changed = true; return n;
          }
          const fee = n.fee;
          n.status = 'driver_offer';
          n.neg = { phase: 'driver', turn: 'them', amount: fee, deadline: now() + cur.settings.offerSecs * 1000,
                    driver: DRIVER_NAMES[idx % DRIVER_NAMES.length],
                    history: [{ by: 'customer', amount: fee, ts: now(), note: 'Your fee offer' }] };
          n.updated = now(); changed = true;
        }
      }
      // --- bot driver answers the offer (their turn) after 2s ---
      if (n.mine && n.status === 'driver_offer' && n.neg && n.neg.phase === 'driver' && n.neg.turn === 'them' && age > 2) {
        const ask = n.neg.amount;
        const botAccepts = ask >= 40 || Math.random() > 0.35;
        if (botAccepts) {
          n.neg = null; n.status = 'accepted'; n.acceptedBy = n.neg0 || n.driver; n.driver = n.neg ? n.neg.driver : n.driver;
          n.driver = n.driver || DRIVER_NAMES[(n.driverIdx || 0) % DRIVER_NAMES.length];
          n.updated = now(); pushAlert(cur, 'Courier accepted — store is preparing your order');
        } else {
          const counter = Math.round(ask * 1.25);
          n.neg = { ...n.neg, turn: 'me', amount: counter, deadline: now() + cur.settings.offerSecs * 1000,
                    history: [...n.neg.history, { by: 'driver', amount: counter, ts: now(), note: (n.neg.driver || 'Courier') + ' countered' }] };
          n.updated = now();
        }
        changed = true;
      }
      // --- bot driver answers my counter-offer ---
      if (n.mine && n.neg && n.neg.phase === 'driver' && n.neg.turn === 'them' && n.status === 'driver_talk' && age > 3) {
        const first = n.neg.history[0].amount;
        const ask = n.neg.amount;
        if (ask >= first * 1.1) {
          n.fee = ask; n.neg = null; n.status = 'accepted'; n.updated = now();
          pushAlert(cur, 'Courier accepted your offer');
        } else {
          const mid = Math.round((ask + first * 1.3) / 2);
          n.neg = { ...n.neg, turn: 'me', amount: mid, deadline: now() + cur.settings.offerSecs * 1000,
                    history: [...n.neg.history, { by: 'driver', amount: mid, ts: now(), note: 'Courier countered' }] };
          n.status = 'driver_offer'; n.updated = now();
        }
        changed = true;
      }
      // --- deadline expiry: offer to me expired -> refuse -> next driver ---
      if (n.mine && n.neg && n.neg.turn === 'me' && n.neg.phase === 'driver' && n.neg.deadline && now() > n.neg.deadline) {
        n.neg = null; n.driverIdx = (n.driverIdx || 0) + 1; n.status = 'finding_driver'; n.updated = now();
        pushAlert(cur, 'No answer in time — offering to the next courier');
        changed = true;
      }
      // --- bot progress after acceptance (vendor packs, etc.) for MY orders ---
      if (n.mine && n.status === 'accepted' && age > 5 && !n.photos?.packed) {
        n.photos = { ...n.photos, packed: photo('vendor', 'packed') };
        n.status = 'ready_pickup'; n.updated = now();
        pushAlert(cur, 'Store packed your order (photo attached)');
        changed = true;
      }
      if (n.mine && n.status === 'ready_pickup' && age > 6 && !n.photos?.pickup) {
        n.photos = { ...n.photos, pickup: photo('driver', 'pickup') };
        n.status = 'picked_up'; n.updated = now();
        pushAlert(cur, 'Courier picked up your order (photo attached)');
        changed = true;
      }
      if (n.mine && n.status === 'picked_up' && age > 8 && !n.photos?.delivery) {
        n.photos = { ...n.photos, delivery: photo('driver', 'delivery') };
        n.status = 'delivered'; n.updated = now();
        pushAlert(cur, 'Courier delivered — please confirm receipt');
        changed = true;
      }

      // --- orders where I am the VENDOR: bot customer responds to my quote/counter ---
      if (!n.mine && n.myRole === 'vendor' && n.neg && n.neg.turn === 'them' && age > 3) {
        const quote = n.neg.amount; // my quoted price
        if (quote <= 250 || Math.random() > 0.35) {
          n.neg = null; n.status = 'accepted'; n.updated = now();
          pushAlert(cur, 'Customer accepted your quote — payment held');
        } else {
          const mid = Math.round(quote * 0.85);
          n.neg = { ...n.neg, turn: 'me', amount: mid, deadline: now() + cur.settings.vendorSecs * 1000,
                    history: [...n.neg.history, { by: 'customer', amount: mid, ts: now(), note: 'Customer countered' }] };
          n.updated = now();
        }
        changed = true;
      }
      // --- orders where I am the DRIVER: bot customer answers my counter ---
      if (!n.mine && n.myRole === 'driver' && n.neg && n.neg.phase === 'driver' && n.neg.turn === 'them' && age > 3) {
        const ask = n.neg.amount; const first = n.neg.history[0].amount;
        if (ask <= first * 1.5) {
          n.fee = ask; n.neg = null; n.status = 'accepted'; n.updated = now();
          pushAlert(cur, 'Customer accepted your fare');
        } else {
          const mid = Math.round((ask + first) / 2);
          n.neg = { ...n.neg, turn: 'me', amount: mid, deadline: now() + cur.settings.offerSecs * 1000,
                    history: [...n.neg.history, { by: 'customer', amount: mid, ts: now(), note: 'Customer countered' }] };
          n.updated = now();
        }
        changed = true;
      }
      // --- my deadline on bot orders expires -> I lose it ---
      if (!n.mine && n.neg && n.neg.turn === 'me' && n.neg.deadline && now() > n.neg.deadline) {
        n.expired = true; n.neg = null; n.updated = now();
        pushAlert(cur, 'Offer expired — assigned to someone else');
        changed = true;
      }
      // --- bot pipeline for accepted bot-orders where I'm the vendor ---
      if (!n.mine && n.myRole === 'vendor' && n.status === 'accepted' && age > 8) {
        n.status = 'awaiting_pack'; n.updated = now(); changed = true;
      }
      // --- bot driver picked up my packed order, then delivers ---
      if (!n.mine && n.myRole === 'vendor' && n.status === 'handover_done' && age > 7) {
        n.photos = { ...n.photos, pickup: photo('driver', 'pickup') }; n.status = 'picked_up'; n.updated = now(); changed = true;
      }
      if (!n.mine && n.myRole === 'vendor' && n.status === 'picked_up' && age > 8) {
        n.photos = { ...n.photos, delivery: photo('driver', 'delivery') }; n.status = 'delivered'; n.updated = now(); changed = true;
      }
      if (!n.mine && n.myRole === 'vendor' && n.status === 'delivered' && age > 5) {
        n.status = 'completed'; n.updated = now();
        const earn = Math.round(n.price * (1 - cur.settings.commissions.vendorPct / 100));
        credit(cur, earn, 'sale', n.id); pushAlert(cur, 'Order completed — earnings added to your wallet');
        changed = true;
      }
      // --- bot pipeline where I'm the driver: vendor packs after accept ---
      if (!n.mine && n.myRole === 'driver' && n.status === 'accepted' && age > 6) {
        n.photos = { ...n.photos, packed: photo('vendor', 'packed') }; n.status = 'ready_pickup'; n.updated = now(); changed = true;
      }
      if (!n.mine && n.myRole === 'driver' && n.status === 'delivered' && age > 5) {
        n.status = 'completed'; n.updated = now();
        const earn = Math.round(n.fee * (1 - cur.settings.commissions.driverPct / 100));
        credit(cur, earn, 'delivery', n.id); pushAlert(cur, 'Delivered — earnings added to your wallet');
        changed = true;
      }
      return n;
    });

    // --- spawn bot orders for my driver/vendor dashboards ---
    let botSeed = cur.botSeed;
    const meDriverOn = cur.roles.driver.status === 'approved' && cur.driverOnline;
    const meVendorOn = cur.roles.vendor.status === 'approved' && cur.storeOpen;
    if ((meDriverOn || meVendorOn) && now() - (cur.lastBotAt || 0) > 45000) {
      const role = meVendorOn && (!meDriverOn || Math.random() > 0.5) ? 'vendor' : 'driver';
      const o = {
        id: uid(), mine: false, myRole: role, kind: 'order',
        customer: BOT_CUSTOMERS[Math.floor(Math.random() * BOT_CUSTOMERS.length)],
        items: ITEMS[Math.floor(Math.random() * ITEMS.length)],
        pickup: 'Aling Nena Sari-sari, Brgy. Sta. Rosa', dropoff: 'Blk 4 Lot 12, Brgy. Malinis',
        fee: 20 + Math.round(Math.random() * 40), price: 0, status: role === 'vendor' ? 'vendor_quote' : 'finding_driver',
        photos: {}, created: now(), updated: now(),
      };
      if (role === 'vendor') {
        o.neg = { phase: 'vendor', turn: 'me', amount: 0, history: [{ by: 'customer', amount: 0, ts: now(), note: 'New order — set your price' }] };
      } else {
        o.neg = { phase: 'driver', turn: 'me', amount: o.fee, deadline: now() + cur.settings.offerSecs * 1000,
                  history: [{ by: 'customer', amount: o.fee, ts: now(), note: 'Customer fee offer' }] };
      }
      orders.unshift(o); cur.lastBotAt = now(); botSeed++;
      pushAlert(cur, role === 'vendor' ? 'New order for your store' : 'New delivery offer');
      changed = true;
    }
    return changed ? { ...cur, orders, botSeed } : cur;
  }

  function photo(by, kind) {
    return { by, kind, ts: now(), uri: null, stamp: new Date().toLocaleString() + ' · GPS locked', simulated: true };
  }
  function pushAlert(cur, text) {
    cur.alerts = [{ id: uid(), text, ts: now(), read: false }, ...(cur.alerts || [])].slice(0, 50);
  }
  function credit(cur, amount, kind, orderId) {
    cur.wallet.credit = Math.round((cur.wallet.credit + amount) * 100) / 100;
    cur.wallet.tx = [{ id: uid(), amount, kind, orderId, ts: now() }, ...cur.wallet.tx];
  }
  function audit(cur, action, detail) {
    cur.audit = [{ id: uid(), action, detail, by: 'admin (0562989152)', ts: now() }, ...(cur.audit || [])].slice(0, 200);
  }

  // ---------- public actions ----------
  const api = {
    tick,
    signIn: (session) => setS((c) => ({ ...c, auth: session, activeRole: session.role === 'admin' ? 'admin' : 'customer' })),
    agreeTerms: () => setS((c) => ({ ...c, terms: true })),
    signOut: () => setS((c) => ({ ...c, auth: null, terms: false, activeRole: 'customer' })),

    placeOrder: (draft) => setS((c) => {
      const serviceFee = Math.round(draft.fee * c.settings.commissions.customerPct / 100);
      const o = { id: uid(), mine: true, kind: draft.kind, category: draft.category, items: draft.text,
                  pickup: draft.pickup, dropoff: draft.dropoff, fee: draft.fee, serviceFee,
                  status: draft.kind === 'send' ? 'finding_driver' : 'vendor_quote',
                  photos: {}, neg: null, driverIdx: 0, created: now(), updated: now(), payVia: draft.payVia };
      const next = { ...c, orders: [o, ...c.orders] };
      pushAlert(next, 'Order placed');
      return next;
    }),

    // customer answers vendor quote/counter
    quoteAnswer: (orderId, action, amount) => setS((c) => ({
      ...c, orders: c.orders.map((o) => {
        if (o.id !== orderId) return o;
        const n = { ...o, updated: now() };
        if (action === 'accept') { n.neg = null; n.status = 'finding_driver'; n.paidHeld = true; pushAlert(c, 'Quote approved — payment held'); }
        if (action === 'counter') {
          n.neg = { ...n.neg, turn: 'them', amount, history: [...n.neg.history, { by: 'customer', amount, ts: now(), note: 'You countered' }] };
          n.status = 'vendor_talk';
        }
        if (action === 'cancel') { n.neg = null; n.status = 'cancelled'; }
        return n;
      }),
    })),

    // customer answers driver counter (accept/counter/refuse -> next driver)
    driverAnswer: (orderId, action, amount) => setS((c) => ({
      ...c, orders: c.orders.map((o) => {
        if (o.id !== orderId) return o;
        const n = { ...o, updated: now() };
        if (action === 'accept') { n.fee = n.neg.amount; n.driver = n.neg.driver || DRIVER_NAMES[(n.driverIdx || 0) % 4]; n.neg = null; n.status = 'accepted'; pushAlert(c, 'Fare confirmed'); }
        if (action === 'counter') {
          n.neg = { ...n.neg, turn: 'them', amount, history: [...n.neg.history, { by: 'customer', amount, ts: now(), note: 'You countered' }] };
          n.status = 'driver_talk';
        }
        if (action === 'refuse') { n.neg = null; n.driverIdx = (n.driverIdx || 0) + 1; n.status = 'finding_driver'; pushAlert(c, 'Offer refused — next courier'); }
        return n;
      }),
    })),

    // driver/vendor answer bot offers (my dashboards)
    offerAnswer: (orderId, action, amount) => setS((c) => ({
      ...c, orders: c.orders.map((o) => {
        if (o.id !== orderId) return o;
        const n = { ...o, updated: now() };
        if (action === 'accept') { n.neg = null; n.status = 'accepted'; }
        if (action === 'refuse') { n.expired = true; n.neg = null; }
        if (action === 'counter') {
          n.neg = { ...n.neg, turn: 'them', amount,
                    history: [...n.neg.history, { by: n.myRole, amount, ts: now(), note: 'Your counter' }] };
        }
        return n;
      }),
    })),

    // vendor sets price + product photo (required)
    vendorQuote: (orderId, price, photoObj) => setS((c) => ({
      ...c, orders: c.orders.map((o) => o.id !== orderId ? o : {
        ...o, price, photos: { ...o.photos, product: photoObj }, updated: now(),
        neg: { phase: 'vendor', turn: 'them', amount: price,
               history: [...(o.neg ? o.neg.history : []), { by: 'vendor', amount: price, ts: now(), note: 'Your quote + product photo' }] },
      }),
    })),
    vendorPacked: (orderId, photoObj) => setS((c) => ({
      ...c, orders: c.orders.map((o) => o.id !== orderId ? o : { ...o, photos: { ...o.photos, packed: photoObj }, status: 'ready_pickup', updated: now() }),
    })),
    vendorHandover: (orderId) => setS((c) => ({
      ...c, orders: c.orders.map((o) => o.id !== orderId ? o : { ...o, status: 'handover_done', updated: now() }),
    })),
    driverPickup: (orderId, photoObj) => setS((c) => ({
      ...c, orders: c.orders.map((o) => o.id !== orderId ? o : { ...o, photos: { ...o.photos, pickup: photoObj }, status: 'picked_up', updated: now() }),
    })),
    driverDeliver: (orderId, photoObj) => setS((c) => ({
      ...c, orders: c.orders.map((o) => o.id !== orderId ? o : { ...o, photos: { ...o.photos, delivery: photoObj }, status: 'delivered', updated: now() }),
    })),
    customerConfirm: (orderId) => setS((c) => {
      const o = c.orders.find((x) => x.id === orderId);
      const next = { ...c, orders: c.orders.map((x) => x.id !== orderId ? x : { ...x, status: 'completed', updated: now() }) };
      if (o && o.paidHeld) { next.wallet.tx = [{ id: uid(), amount: -(o.price + o.fee), kind: 'payment', orderId, ts: now() }, ...next.wallet.tx]; }
      pushAlert(next, 'Delivery confirmed — funds released');
      return next;
    }),
    cancelOrder: (orderId) => setS((c) => ({
      ...c, orders: c.orders.map((o) => o.id !== orderId ? o : { ...o, status: 'cancelled', updated: now() }),
    })),
    dispute: (orderId) => setS((c) => ({
      ...c, orders: c.orders.map((o) => o.id !== orderId ? o : { ...o, status: 'disputed', updated: now() }),
    })),

    // role switch + KYC
    switchRole: (role) => setS((c) => ({ ...c, activeRole: role })),
    submitKyc: (role, data) => setS((c) => {
      const entry = { id: uid(), userId: 'me', name: c.profile.name, role, status: 'pending', ts: now(), data };
      return { ...c, roles: { ...c.roles, [role]: { status: 'pending', data } }, kyc: [entry, ...c.kyc] };
    }),
    toggleOnline: (kind, v) => setS((c) => ({ ...c, [kind === 'driver' ? 'driverOnline' : 'storeOpen']: v })),

    // wallet / profile
    topUp: (amount) => setS((c) => { const n = { ...c }; n.wallet.balance += amount;
      n.wallet.tx = [{ id: uid(), amount, kind: 'topup', ts: now() }, ...n.wallet.tx]; return n; }),
    addCoupon: (code) => setS((c) => ({ ...c, profile: { ...c.profile, coupons: [...c.profile.coupons, code] } })),
    catalogAdd: (name, price) => setS((c) => ({ ...c, catalog: [...(c.catalog || []), { id: uid(), name, price }] })),
    catalogDel: (id) => setS((c) => ({ ...c, catalog: (c.catalog || []).filter((x) => x.id !== id) })),
    addAddress: (a) => setS((c) => ({ ...c, addresses: [...c.addresses, a] })),
    setName: (name) => setS((c) => ({ ...c, profile: { ...c.profile, name } })),

    // ---------- ADMIN ----------
    adminDecideKyc: (id, ok) => setS((c) => {
      const k = c.kyc.find((x) => x.id === id);
      const next = { ...c, kyc: c.kyc.map((x) => x.id !== id ? x : { ...x, status: ok ? 'approved' : 'rejected' }) };
      if (k && k.userId === 'me') next.roles = { ...c.roles, [k.role]: { status: ok ? 'approved' : 'rejected', data: k.data } };
      audit(next, ok ? 'KYC approved' : 'KYC rejected', (k ? k.name + ' (' + k.role + ')' : id));
      return next;
    }),
    adminOrders: null, // derived
    adminCancelRefund: (orderId) => setS((c) => {
      const o = c.orders.find((x) => x.id === orderId);
      const next = { ...c, orders: c.orders.map((x) => x.id !== orderId ? x : { ...x, status: 'cancelled', updated: now() }) };
      if (o && o.paidHeld) { next.wallet.balance += o.price + o.fee;
        next.wallet.tx = [{ id: uid(), amount: o.price + o.fee, kind: 'refund', orderId, ts: now() }, ...next.wallet.tx]; }
      audit(next, 'Order cancelled + refunded', orderId);
      return next;
    }),
    adminReassign: (orderId) => setS((c) => {
      const next = { ...c, orders: c.orders.map((x) => x.id !== orderId ? x : { ...x, status: 'finding_driver', neg: null, driverIdx: 0, updated: now() }) };
      audit(next, 'Order reassigned', orderId); return next;
    }),
    adminFreeze: (userId, v) => setS((c) => {
      const next = { ...c, users: c.users.map((u) => u.id !== userId ? u : { ...u, frozen: v }) };
      audit(next, v ? 'User frozen' : 'User unfrozen', userId); return next;
    }),
    adminAdjustWallet: (userId, amount, reason) => setS((c) => {
      const next = { ...c, users: c.users.map((u) => u.id !== userId ? u : { ...u, wallet: Math.round((u.wallet + amount) * 100) / 100 }) };
      audit(next, 'Wallet adjusted ' + (amount > 0 ? '+' : '') + amount, userId + ' — reason: ' + reason);
      return next;
    }),
    adminSetCommissions: (cm) => setS((c) => { const n = { ...c, settings: { ...c.settings, commissions: cm } };
      audit(n, 'Commissions updated', JSON.stringify(cm)); return n; }),
    adminSetSettings: (patch) => setS((c) => { const n = { ...c, settings: { ...c.settings, ...patch } };
      audit(n, 'Settings updated', Object.keys(patch).join(',')); return n; }),
    adminSetCategories: (cats) => setS((c) => { const n = { ...c, settings: { ...c.settings, categories: cats } };
      audit(n, 'Categories updated', cats.join(', ')); return n; }),
    adminSetBanner: (b) => setS((c) => { const n = { ...c, settings: { ...c.settings, banner: b } };
      audit(n, 'Banner updated', b.title); return n; }),
    adminBroadcast: (text, target) => setS((c) => { const n = { ...c };
      pushAlert(n, '📣 ' + text); audit(n, 'Broadcast sent', target + ': ' + text); return n; }),

    resetAll: () => { AsyncStorage.removeItem(KEY); setS(DEFAULTS()); },
  };

  if (!s) return null;
  return <Ctx.Provider value={{ s, ...api }}>{children}</Ctx.Provider>;
}
