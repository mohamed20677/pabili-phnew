// Pabili PH — full app shell: auth flow → role-based experience
import React, { useState } from 'react';
import { Modal, SafeAreaView, StatusBar, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFonts } from 'expo-font';
import { LangCtx, C } from './lib';
import { StoreProvider, useStore } from './store';
import { PhoneScreen, OtpScreen, TermsScreen } from './Auth';
import { HomeScreen, OrderForm, OrdersTab } from './Customer';
import Profile, { AlertsTab } from './Profile';
import Driver from './Driver';
import Vendor from './Vendor';
import Admin from './Admin';
import BottomNav from './BottomNav';

function Shell() {
  const { s, signIn, agreeTerms } = useStore();
  const [digits, setDigits] = useState('');
  const [step, setStep] = useState('phone'); // phone | otp
  const [tab, setTab] = useState('home');
  const [newOpen, setNewOpen] = useState(false);
  const [preselect, setPreselect] = useState(null);

  if (!s.auth) {
    return (
      <View style={{ flex: 1 }}>
        <StatusBar barStyle="light-content" />
        {step === 'phone'
          ? <PhoneScreen onDone={(d) => { setDigits(d); setStep('otp'); }} />
          : <OtpScreen digits={digits} onVerified={signIn} onBack={() => setStep('phone')} />}
      </View>
    );
  }
  if (!s.terms) return <TermsScreen onAgree={agreeTerms} />;
  if (s.auth.role === 'admin') return <Admin />;

  const role = s.activeRole;
  const main = tab === 'home'
    ? (role === 'driver' ? <Driver /> : role === 'vendor' ? <Vendor />
       : <HomeScreen goNew={(c) => { setPreselect(c); setNewOpen(true); }} />)
    : tab === 'orders' ? <OrdersTab />
    : tab === 'alerts' ? <AlertsTab />
    : <Profile />;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.paper }}>
      <StatusBar barStyle="dark-content" />
      <View style={{ flex: 1 }}>{main}</View>
      <BottomNav tab={tab} setTab={setTab} alerts={s.alerts} onFab={() => {
        if (role === 'customer') { setPreselect(null); setNewOpen(true); }
        else setTab('home');
      }} />
      <Modal visible={newOpen} animationType="slide" onRequestClose={() => setNewOpen(false)}>
        <SafeAreaView style={{ flex: 1 }}>
          <OrderForm preselect={preselect} onClose={() => setNewOpen(false)} />
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

export default function App() {
  // CHANGED: load approved brand fonts (Nunito) before first paint
  const [fontsLoaded] = useFonts({
    'Nunito-Regular': require('./assets/fonts/nunito-400.ttf'),
    'Nunito-Bold': require('./assets/fonts/nunito-700.ttf'),
  });
  const [lang, setLangState] = useState('en');
  const setLang = (l) => { setLangState(l); AsyncStorage.setItem('pabili.lang', l); };
  if (!fontsLoaded) return <View style={{ flex: 1, backgroundColor: '#0E7C5B' }} />;
  return (
    <LangCtx.Provider value={{ lang, setLang }}>
      <StoreProvider>
        <Shell />
      </StoreProvider>
    </LangCtx.Provider>
  );
}
