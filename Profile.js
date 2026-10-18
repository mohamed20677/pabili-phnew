// My Page (reference-matched) + role switch dialog + KYC forms + alerts tab
import React, { useState } from 'react';
import { Modal, Pressable, ScrollView, View } from 'react-native';
import { C, LangCtx, peso, useT } from './lib';
import { useStore } from './store';
import { Btn, Card, Field, Row, Section, Txt } from './ui';

const mkDoc = (name) => name;

export function AlertsTab() {
  const { s } = useStore();
  return (
    <ScrollView style={{ flex: 1, backgroundColor: C.paper, padding: 14 }}>
      <Txt b s={20} style={{ marginBottom: 10 }}>🔔 Alerts</Txt>
      {s.alerts.length === 0 && <Txt c={C.mute} style={{ textAlign: 'center', marginTop: 60 }}>No alerts yet.</Txt>}
      {s.alerts.map((a) => (
        <Card key={a.id} style={{ marginBottom: 8, paddingVertical: 12 }}>
          <Txt s={13}>{a.text}</Txt>
          <Txt s={10} c={C.mute} style={{ marginTop: 3 }}>{new Date(a.ts).toLocaleString()}</Txt>
        </Card>
      ))}
      <View style={{ height: 100 }} />
    </ScrollView>
  );
}

function RoleDialog({ visible, onClose, onPick }) {
  const T = useT();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: 'rgba(15,23,42,0.55)', alignItems: 'center', justifyContent: 'center', padding: 30 }}>
        <Card style={{ width: '100%', padding: 22 }}>
          <Txt b s={18}>{T('switchTitle')}</Txt>
          <Txt s={13} c={C.mute} style={{ marginTop: 10, lineHeight: 19 }}>{T('switchBody')}</Txt>
          <View style={{ flexDirection: 'row', marginTop: 16 }}>
            <Btn title={T('switchDo')} onPress={onPick} style={{ flex: 1, marginRight: 8, marginTop: 0 }} />
            <Btn kind="ghost" title={T('back')} onPress={onClose} style={{ flex: 1, marginTop: 0 }} />
          </View>
        </Card>
      </View>
    </Modal>
  );
}

function KycForm({ role, onDone }) {
  const { submitKyc } = useStore();
  const isDriver = role === 'driver';
  const [d, setD] = useState(isDriver
    ? { vehicle: 'Motorbike', model: 'Honda Click 125', plate: '', license: null, selfie: null }
    : { store: '', type: 'Sari-sari', address: '', permit: null, front: null });
  const set = (k, v) => setD({ ...d, [k]: v });
  const need = isDriver ? ['plate', 'license', 'selfie'] : ['store', 'address', 'permit', 'front'];
  const ready = need.every((k) => d[k]);
  const DocBtn = ({ k, label }) => (
    <Btn small kind={d[k] ? 'ghost' : 'main'} title={d[k] ? '✓ ' + d[k] : '📷 ' + label}
         onPress={() => set(k, mkDoc(label.toLowerCase().replace(/\s/g, '-') + '.jpg'))} />
  );
  return (
    <ScrollView style={{ flex: 1, backgroundColor: C.paper, padding: 16 }}>
      <Card style={{ borderTopWidth: 4, borderTopColor: C.green }}>
        <Txt b s={18}>{isDriver ? '🛵 Driver verification' : '🏪 Store verification'}</Txt>
        <Txt s={12} c={C.mute} style={{ marginTop: 4 }}>Step 1 of 1 — admin reviews before features unlock.</Txt>
        {isDriver ? (
          <View style={{ marginTop: 12 }}>
            <Txt b s={13}>Vehicle</Txt>
            <View style={{ flexDirection: 'row', marginTop: 6 }}>
              {['Motorbike', 'Car', 'Bicycle'].map((v) => (
                <Pressable key={v} onPress={() => set('vehicle', v)}
                  style={{ borderWidth: 1.5, borderColor: d.vehicle === v ? C.green : C.line, borderRadius: 12,
                           paddingVertical: 8, paddingHorizontal: 12, marginRight: 8,
                           backgroundColor: d.vehicle === v ? '#EAF3EF' : '#fff' }}>
                  <Txt s={12} b={d.vehicle === v} c={d.vehicle === v ? C.green : C.ink}>{v}</Txt>
                </Pressable>
              ))}
            </View>
            <Field value={d.model} onChangeText={(v) => set('model', v)} placeholder="Model (e.g. Honda Click 125)" style={{ marginTop: 10 }} />
            <Field value={d.plate} onChangeText={(v) => set('plate', v)} placeholder="Plate number *" style={{ marginTop: 8 }} />
            <DocBtn k="license" label="Driving license photo *" />
            <DocBtn k="selfie" label="Selfie with ID *" />
          </View>
        ) : (
          <View style={{ marginTop: 12 }}>
            <Field value={d.store} onChangeText={(v) => set('store', v)} placeholder="Store name *" />
            <Field value={d.address} onChangeText={(v) => set('address', v)} placeholder="Store address (barangay, town) *" style={{ marginTop: 8 }} />
            <DocBtn k="permit" label="Business permit photo *" />
            <DocBtn k="front" label="Storefront photo *" />
          </View>
        )}
        <Btn title="Submit for review" disabled={!ready} onPress={() => { submitKyc(role, d); onDone(); }} />
        <Btn kind="ghost" title="Back" onPress={onDone} />
      </Card>
      <View style={{ height: 100 }} />
    </ScrollView>
  );
}

function Pending({ role }) {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 30 }}>
      <Txt s={50}>⏳</Txt>
      <Txt b s={19} style={{ marginTop: 12 }}>Pending admin review</Txt>
      <Txt s={13} c={C.mute} style={{ textAlign: 'center', marginTop: 8 }}>
        Your {role} documents were submitted. Features unlock after the admin approves.</Txt>
    </View>
  );
}

export default function Profile() {
  const { s, signOut, topUp, addCoupon, switchRole } = useStore();
  const T = useT();
  const { lang, setLang } = React.useContext(LangCtx);
  const [dlg, setDlg] = useState(false);
  const [kyc, setKyc] = useState(null);
  const [coupon, setCoupon] = useState('');
  const role = s.activeRole;
  const myOrders = s.orders.filter((o) => o.mine).length;
  const verified = role === 'customer' || s.roles[role]?.status === 'approved';

  if (kyc) return <KycForm role={kyc} onDone={() => setKyc(null)} />;
  if ((role === 'driver' || role === 'vendor') && s.roles[role].status === 'pending') return <Pending role={role} />;

  const pickRole = () => {
    setDlg(false);
    // reference app switches instantly; we require verification for driver/vendor
    if (role === 'customer') {
      if (s.roles.driver.status === 'approved') switchRole('driver');
      else setKyc('driver');
    } else switchRole('customer');
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: '#fff' }}>
      <View style={{ backgroundColor: C.greenDk, padding: 18, paddingBottom: 26 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View style={{ width: 62, height: 62, borderRadius: 31, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' }}>
            <Txt s={30}>👤</Txt>
          </View>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Txt b s={16} c="#fff">{s.profile.name}</Txt>
            <Txt s={13} c="#F2A900">★★★★★ {s.profile.rating.toFixed(1)}</Txt>
            <View style={{ backgroundColor: verified ? C.green : '#6B7A72', borderRadius: 8, alignSelf: 'flex-start',
                           paddingHorizontal: 8, paddingVertical: 2, marginTop: 4 }}>
              <Txt s={10} b c="#fff">{verified ? '✓ Verified' : 'Unverified'}</Txt>
            </View>
          </View>
          <Pressable onPress={signOut}><Txt s={22} c="#fff">⏻</Txt></Pressable>
        </View>
      </View>

      <Row icon="👛" label={T('wallet')} right={
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Txt b s={15}>{peso(s.wallet.balance)}</Txt>
          <Btn small title="+ Add" onPress={() => topUp(100)} style={{ marginLeft: 10, marginTop: 0, paddingHorizontal: 14, paddingVertical: 6 }} />
        </View>} />
      <Row icon="💳" label={T('deliveryCredit')} value={peso(s.wallet.credit)} />
      <Row icon="🛵" label={T('ordersCount')} value={String(myOrders)} green />
      <Row icon="📍" label={T('savedAddr')} value={String(s.addresses.length)} onPress={() => {}} green />
      <Row icon="👤" label={T('userMode')} onPress={() => setDlg(true)}
           right={<Txt b s={13} c={C.green}>{role === 'customer' ? 'Shopping mode' : role === 'driver' ? 'Courier mode' : 'Store mode'} ›</Txt>} />
      <Row icon="⭐" label={T('ratings')} value="0" onPress={() => {}} green />
      <Row icon="💬" label={T('notes')} value="0" onPress={() => {}} green />
      <Row icon="％" label={T('coupons')} right={
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Field value={coupon} onChangeText={setCoupon} placeholder="Code" style={{ width: 90, padding: 6 }} />
          <Btn small kind="ghost" title="+ Add" disabled={!coupon} onPress={() => { addCoupon(coupon); setCoupon(''); }}
               style={{ marginLeft: 6, marginTop: 0 }} />
        </View>} />
      <Row icon="🌐" label={T('lang')} right={
        <View style={{ flexDirection: 'row' }}>
          {['en', 'tl'].map((l) => (
            <Pressable key={l} onPress={() => setLang(l)}
              style={{ borderWidth: 1.5, borderColor: lang === l ? C.green : C.line, borderRadius: 10,
                       paddingHorizontal: 12, paddingVertical: 5, marginLeft: 6,
                       backgroundColor: lang === l ? '#EAF3EF' : '#fff' }}>
              <Txt s={12} b={lang === l} c={lang === l ? C.green : C.ink}>{l === 'en' ? 'English' : 'Tagalog'}</Txt>
            </Pressable>
          ))}
        </View>} />
      <Row icon="❓" label={T('support')} onPress={() => {}} />
      <Row icon="🛡" label={T('offers')} onPress={() => {}} />
      <Row icon="⚙️" label={T('settings')} onPress={() => {}} />
      <Row icon="💳" label={T('payMethods')} onPress={() => {}} />
      <View style={{ padding: 16 }}>
        {(role === 'customer' && s.roles.vendor.status !== 'approved' && s.roles.vendor.status !== 'pending') && (
          <Btn kind="ghost" title="🏪 Register my store" onPress={() => setKyc('vendor')} />
        )}
        {role === 'customer' && s.roles.vendor.status === 'approved' && (
          <Btn kind="ghost" title="🏪 Switch to store mode" onPress={() => switchRole('vendor')} />
        )}
        {role !== 'customer' && <Btn kind="ghost" title="🛒 Back to shopping mode" onPress={() => switchRole('customer')} />}
        <Btn kind="bad" title={T('logout')} onPress={signOut} />
      </View>
      <View style={{ height: 90 }} />
      <RoleDialog visible={dlg} onClose={() => setDlg(false)} onPick={pickRole} />
    </ScrollView>
  );
}
