// Customer: reference home + order form + orders tab with negotiation + photo timeline
import React, { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { C, ORDER_STATUS, peso, useT } from './lib';
import { useStore } from './store';
import { Btn, Card, Chip, Countdown, Field, Section, Txt } from './ui';

export function photoBubble(p) {
  if (!p) return null;
  return (
    <View style={{ backgroundColor: '#EAF3EF', borderRadius: 12, padding: 10, marginTop: 8, borderWidth: 1, borderColor: C.green }}>
      <Txt s={13} b c={C.green}>📷 {p.kind} — photo proof</Txt>
      <Txt s={10} c={C.mute}>{p.stamp}</Txt>
    </View>
  );
}

export function PhotoTimeline({ o }) {
  const steps = [['product', '📦'], ['packed', '✅'], ['pickup', '🛵'], ['delivery', '🏠']];
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'center', marginTop: 10 }}>
      {steps.map(([k, ic], i) => {
        const done = !!(o.photos && o.photos[k]);
        return (
          <View key={k} style={{ flexDirection: 'row', alignItems: 'center' }}>
            <View style={{ width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center',
                           backgroundColor: done ? C.green : '#fff', borderWidth: 1.5, borderColor: done ? C.green : C.line }}>
              <Txt s={15}>{done ? '📷' : ic}</Txt>
            </View>
            {i < 3 && <View style={{ width: 26, height: 2, backgroundColor: done && o.photos[steps[i + 1][0]] ? C.green : C.line }} />}
          </View>
        );
      })}
    </View>
  );
}

export function Negotiation({ o, onAnswer, counterLabel }) {
  const [amount, setAmount] = useState('');
  const [open, setOpen] = useState(false);
  const { tick } = useStore();
  void tick;
  if (!o.neg) return null;
  const left = o.neg.deadline ? Math.max(0, Math.ceil((o.neg.deadline - Date.now()) / 1000)) : null;
  const total = o.neg.phase === 'vendor' ? 60 : 30;
  return (
    <View style={{ marginTop: 10, backgroundColor: '#FBF7EC', borderRadius: 14, padding: 12, borderWidth: 1, borderColor: C.gold }}>
      <Txt b s={13} c={C.amber}>💬 Negotiation — {o.neg.phase === 'vendor' ? 'store price' : 'courier fare'}</Txt>
      {(o.neg.history || []).map((h, i) => (
        <View key={i} style={{ marginTop: 6, alignSelf: h.by === 'customer' || (h.by === o.myRole) ? 'flex-end' : 'flex-start',
                 backgroundColor: h.by === 'customer' || h.by === o.myRole ? C.green : '#fff',
                 borderRadius: 12, paddingHorizontal: 10, paddingVertical: 6, maxWidth: '85%' }}>
          <Txt s={12} c={h.by === 'customer' || h.by === o.myRole ? '#fff' : C.ink}>{h.note}{h.amount ? ' — ' + peso(h.amount) : ''}</Txt>
        </View>
      ))}
      {left != null && <Countdown left={left} total={total} />}
      {left != null && <Txt s={11} c={left <= 10 ? C.bad : C.mute} style={{ marginTop: 4 }}>⏱ {left}s left to answer</Txt>}
      {o.neg.turn === 'me' && (
        <View>
          {o.neg.phase === 'vendor' && o.myRole !== 'vendor' && o.photos && o.photos.product && photoBubble(o.photos.product)}
          <View style={{ flexDirection: 'row', marginTop: 10 }}>
            <Btn small title="Accept" onPress={() => onAnswer(o.id, 'accept')} style={{ flex: 1, marginRight: 6 }} />
            <Btn small kind="ghost" title={counterLabel || 'Counter'} onPress={() => setOpen(!open)} style={{ flex: 1, marginRight: 6 }} />
            <Btn small kind="bad" title={o.myRole ? 'Refuse' : 'Cancel'} onPress={() => onAnswer(o.id, o.myRole ? 'refuse' : 'cancel')} style={{ flex: 1 }} />
          </View>
          {open && (
            <View style={{ flexDirection: 'row', marginTop: 8, alignItems: 'center' }}>
              <Field value={amount} onChangeText={(v) => setAmount(v.replace(/[^0-9]/g, ''))} keyboardType="number-pad"
                     placeholder="Your amount ₱" style={{ flex: 1, padding: 10 }} />
              <Btn small title="Send" onPress={() => { if (amount) { onAnswer(o.id, 'counter', Number(amount)); setOpen(false); setAmount(''); } }}
                   style={{ marginLeft: 8, marginTop: 0, paddingHorizontal: 18 }} />
            </View>
          )}
        </View>
      )}
      {o.neg.turn === 'them' && <Txt s={12} c={C.mute} style={{ marginTop: 8 }}>Waiting for the other side…</Txt>}
    </View>
  );
}

export function HomeScreen({ goNew }) {
  const { s } = useStore();
  const T = useT();
  const cats = s.settings.categories;
  return (
    <ScrollView style={{ flex: 1, backgroundColor: C.paper }}>
      <View style={{ backgroundColor: '#EAF3EF', padding: 16, paddingTop: 8, borderBottomLeftRadius: 24, borderBottomRightRadius: 24 }}>
        <Pressable style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Txt s={17}>📍</Txt>
          <View style={{ flex: 1, marginLeft: 6 }}>
            <Txt b s={14}>Home — <Txt s={12} c={C.mute}>{s.addresses[0].addr}</Txt></Txt>
          </View>
          <Txt c={C.mute}>⌄</Txt>
        </Pressable>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 14 }}>
          {cats.map((c2, i) => (
            <Pressable key={c2} onPress={() => goNew(c2)} style={{ alignItems: 'center', marginRight: 16 }}>
              <View style={{ width: 58, height: 58, borderRadius: 16, alignItems: 'center', justifyContent: 'center',
                             backgroundColor: i === 0 ? C.green : '#fff', borderWidth: 1, borderColor: C.line }}>
                <Txt s={24}>{['🛖', '🛒', '💊', '🔥', '🍽️', '📦', '💐', '🔧'][i % 8]}</Txt>
              </View>
              <Txt s={11} b={i === 0} c={i === 0 ? C.green : C.ink} style={{ marginTop: 4 }}>{c2}</Txt>
            </Pressable>
          ))}
        </ScrollView>
        <View style={{ backgroundColor: '#fff', borderRadius: 14, borderWidth: 1, borderColor: C.line,
                       padding: 13, marginTop: 14, flexDirection: 'row', alignItems: 'center' }}>
          <Txt s={16} c={C.mute}>🔍</Txt>
          <Txt c={C.mute} s={14} style={{ marginLeft: 8 }}>{T('howHelp')}</Txt>
        </View>
      </View>

      <View style={{ margin: 14, borderRadius: 18, overflow: 'hidden', backgroundColor: '#111' }}>
        <View style={{ padding: 18 }}>
          <Txt s={17} b c={C.gold}>{s.settings.banner.title}</Txt>
          <Txt s={13} c="#fff" style={{ marginTop: 4 }}>Any store, even without an app</Txt>
          <Pressable onPress={() => goNew(null)} style={{ backgroundColor: '#fff', borderRadius: 20, paddingVertical: 9,
                     paddingHorizontal: 18, alignSelf: 'flex-start', marginTop: 12 }}>
            <Txt b s={13}>{s.settings.banner.cta}</Txt>
          </Pressable>
        </View>
      </View>

      <Section title={'🚩 ' + T('nearYou')}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <Pressable onPress={() => goNew(null)} style={{ width: 200, marginRight: 12 }}>
            <Card style={{ borderColor: C.green, borderWidth: 2 }}>
              <View style={{ backgroundColor: C.green, alignSelf: 'flex-start', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 }}>
                <Txt s={10} b c="#fff">{T('mostReq')}</Txt>
              </View>
              <Txt s={44} style={{ textAlign: 'center', marginVertical: 8 }}>📍</Txt>
              <Txt b s={16}>{T('orderAny')}</Txt>
              <Txt s={11} c={C.mute}>{T('orderAnySub')}</Txt>
            </Card>
          </Pressable>
          <Pressable onPress={() => goNew('Parcel')} style={{ width: 200 }}>
            <Card>
              <View style={{ height: 38 }} />
              <Txt s={44} style={{ textAlign: 'center', marginVertical: 8 }}>📦</Txt>
              <Txt b s={16}>{T('sendAny')}</Txt>
              <Txt s={11} c={C.mute}>{T('sendAnySub')}</Txt>
            </Card>
          </Pressable>
        </ScrollView>
      </Section>

      <Section title={T('needHelp')}>
        <Card style={{ backgroundColor: '#FBF3E6', borderColor: '#F0E0C0' }}>
          <Txt s={60}>🚚</Txt>
          <Txt b s={16}>{T('needHelp')}</Txt>
          <Txt s={12} c={C.mute}>{T('helpSub')}</Txt>
        </Card>
      </Section>
      <View style={{ height: 90 }} />
    </ScrollView>
  );
}

export function OrderForm({ preselect, onClose }) {
  const { s, placeOrder } = useStore();
  const T = useT();
  const [kind, setKind] = useState(preselect === 'Parcel' ? 'send' : 'order');
  const [cat, setCat] = useState(preselect && preselect !== 'Parcel' ? preselect : 'Food');
  const [text, setText] = useState('');
  const [fee, setFee] = useState('20');
  const [payVia, setPayVia] = useState('wallet');
  const cats = ['Food', 'Coffee', 'Supermarket', 'Pharmacy', 'Sari-sari', 'Gas / LPG', 'Flowers', 'Parcel'];
  const f = Number(fee) || 0;
  const serviceFee = Math.round(f * s.settings.commissions.customerPct / 100);
  return (
    <ScrollView style={{ flex: 1, backgroundColor: '#fff' }}>
      <View style={{ backgroundColor: C.greenDk, padding: 18, paddingTop: 12, borderBottomLeftRadius: 24, borderBottomRightRadius: 24 }}>
        <Pressable onPress={onClose}><Txt c="#fff" s={22}>✕</Txt></Pressable>
        <Txt b s={20} c="#fff" style={{ marginTop: 8 }}>{kind === 'send' ? '📦 ' + T('sendAny') : '📍 ' + T('orderAny')}</Txt>
        <Txt s={12} c="#fff" style={{ opacity: 0.85 }}>{kind === 'send' ? T('sendAnySub') : T('orderAnySub')}</Txt>
      </View>
      <View style={{ padding: 16 }}>
        <View style={{ flexDirection: 'row', marginBottom: 4 }}>
          <Chip label={T('orderAny')} active={kind === 'order'} onPress={() => setKind('order')} />
          <Chip label={T('sendAny')} active={kind === 'send'} onPress={() => setKind('send')} />
        </View>
        <Section title={T('orderDetails')}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {cats.map((c2) => <Chip key={c2} label={c2} active={cat === c2} onPress={() => setCat(c2)} />)}
          </ScrollView>
          <Field multiline numberOfLines={4} value={text} onChangeText={setText} placeholder={T('describe')}
                 style={{ marginTop: 12, minHeight: 100, textAlignVertical: 'top' }} />
        </Section>
        <Section title={T('deliveryDetails')}>
          <Card style={{ borderColor: C.green, borderWidth: 1.5 }}>
            <Txt s={12} c={C.mute}>{T('pickupFrom')}</Txt>
            <Txt b s={14}>{kind === 'send' ? 'Your current location' : cat + ' — nearest store (auto)'}</Txt>
          </Card>
          <View style={{ width: 2, height: 16, backgroundColor: C.line, alignSelf: 'center' }} />
          <Card>
            <Txt s={12} c={C.mute}>{T('deliverTo')}</Txt>
            <Txt b s={14}>🏠 {s.addresses[0].label} — <Txt s={12} c={C.mute}>{s.addresses[0].addr}</Txt></Txt>
          </Card>
        </Section>
        <Section title={T('feeOffer')}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Field value={fee} onChangeText={(v) => setFee(v.replace(/[^0-9]/g, ''))} keyboardType="number-pad"
                   style={{ width: 110, textAlign: 'center', fontSize: 22, fontWeight: '800' }} />
            <Txt s={14} c={C.mute} style={{ marginLeft: 12 }}>+ {peso(serviceFee)} service fee</Txt>
          </View>
        </Section>
        <Section title={T('payMethod')}>
          <Card>
            <Pressable onPress={() => setPayVia('wallet')} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 6 }}>
              <Txt s={17}>👛</Txt><Txt s={14} style={{ flex: 1, marginLeft: 10 }}>Wallet ({peso(s.wallet.balance)})</Txt>
              <Txt s={16} c={payVia === 'wallet' ? C.green : C.line}>{payVia === 'wallet' ? '●' : '○'}</Txt>
            </Pressable>
            <Pressable onPress={() => setPayVia('cod')} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 6 }}>
              <Txt s={17}>💵</Txt><Txt s={14} style={{ flex: 1, marginLeft: 10 }}>Cash on delivery (held)</Txt>
              <Txt s={16} c={payVia === 'cod' ? C.green : C.line}>{payVia === 'cod' ? '●' : '○'}</Txt>
            </Pressable>
          </Card>
        </Section>
        <Btn title={T('placeOrder') + ' · ' + peso(f + serviceFee)} disabled={!text.trim() || f <= 0}
             onPress={() => { placeOrder({ kind, category: cat, text, fee: f, payVia, pickup: 'auto', dropoff: s.addresses[0].addr }); onClose(); }} />
        <View style={{ height: 100 }} />
      </View>
    </ScrollView>
  );
}

export function OrdersTab() {
  const { s, quoteAnswer, driverAnswer, customerConfirm, cancelOrder, dispute } = useStore();
  const T = useT();
  const mine = s.orders.filter((o) => o.mine);
  return (
    <ScrollView style={{ flex: 1, backgroundColor: C.paper, padding: 14 }}>
      <Txt b s={20} style={{ marginBottom: 10 }}>{T('orders')}</Txt>
      {mine.length === 0 && <Txt c={C.mute} style={{ textAlign: 'center', marginTop: 60 }}>No orders yet — tap ✨ to place one.</Txt>}
      {mine.map((o) => (
        <Card key={o.id} style={{ marginBottom: 12 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Txt b s={15} style={{ flex: 1 }}>{o.items}</Txt>
            <View style={{ backgroundColor: o.status === 'cancelled' ? '#FDECEC' : o.status === 'completed' ? '#EAF3EF' : '#FBF7EC',
                           borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3, alignSelf: 'flex-start' }}>
              <Txt s={11} b c={o.status === 'cancelled' ? C.bad : o.status === 'completed' ? C.green : C.amber}>
                {ORDER_STATUS[o.status] || o.status}</Txt>
            </View>
          </View>
          <Txt s={11} c={C.mute} style={{ marginTop: 4 }}>{o.category} · fee {peso(o.fee)} · {new Date(o.created).toLocaleTimeString()}</Txt>
          <PhotoTimeline o={o} />
          {['product', 'packed', 'pickup', 'delivery'].map((k) => o.photos && o.photos[k] ? <View key={k}>{photoBubble(o.photos[k])}</View> : null)}
          {(o.status === 'quote_review' || o.status === 'vendor_talk') && o.neg &&
            <Negotiation o={o} onAnswer={quoteAnswer} />}
          {(o.status === 'driver_offer' || o.status === 'driver_talk') && o.neg &&
            <Negotiation o={o} onAnswer={driverAnswer} />}
          {o.status === 'vendor_quote' && <Txt s={12} c={C.mute} style={{ marginTop: 8 }}>⏳ {T('waitingStore')}</Txt>}
          {o.status === 'finding_driver' && <Txt s={12} c={C.mute} style={{ marginTop: 8 }}>⏳ {T('waitingDriver')}{o.widened ? ' · ' + o.note : ''} (courier #{(o.driverIdx || 0) + 1})</Txt>}
          {o.status === 'accepted' && <Txt s={12} c={C.green} style={{ marginTop: 8 }}>🛵 {o.driver || 'Courier'} accepted — store is preparing</Txt>}
          {o.status === 'ready_pickup' && <Txt s={12} c={C.green} style={{ marginTop: 8 }}>✅ Packed — courier is picking up</Txt>}
          {o.status === 'picked_up' && <Txt s={12} c={C.green} style={{ marginTop: 8 }}>🛵 {T('onTheWay')}</Txt>}
          {o.status === 'delivered' && (
            <View>
              <Btn small title={T('confirm') + ' ✓'} onPress={() => customerConfirm(o.id)} />
              <Btn small kind="ghost" title="Report a problem" onPress={() => dispute(o.id)} />
            </View>
          )}
          {['vendor_quote', 'quote_review', 'finding_driver'].includes(o.status) &&
            <Btn small kind="bad" title={T('cancel')} onPress={() => cancelOrder(o.id)} />}
          {o.status === 'cancelled' && <Btn small kind="ghost" title={'↻ ' + T('reorder')} onPress={() => {}} />}
        </Card>
      ))}
      <View style={{ height: 100 }} />
    </ScrollView>
  );
}
