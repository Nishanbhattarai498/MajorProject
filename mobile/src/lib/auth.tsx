import { createContext, useContext, useEffect, useState, type PropsWithChildren } from 'react';
import * as SecureStore from 'expo-secure-store';
import { registerAccount, signIn } from '@/lib/api';

type Account = { id: string; email: string };
export const DEMO_EMAIL = 'demo@neuroscope.local';
export const DEMO_PASSWORD = 'NeuroScopeDemo123!';

type AuthContextValue = {
  account: Account | null;
  ready: boolean;
  authenticate: (email: string, password: string, createAccount?: boolean) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: PropsWithChildren) {
  const [account, setAccount] = useState<Account | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    SecureStore.getItemAsync('neuroscope-account')
      .then((value) => { if (value) setAccount(JSON.parse(value) as Account); })
      .finally(() => setReady(true));
  }, []);

  async function authenticate(email: string, password: string, createAccount = false) {
    if (!createAccount && email.trim().toLowerCase() === DEMO_EMAIL && password === DEMO_PASSWORD) {
      const demoAccount = { id: 'neuroscope-demo', email: DEMO_EMAIL };
      await SecureStore.deleteItemAsync('neuroscope-token');
      await SecureStore.setItemAsync('neuroscope-account', JSON.stringify(demoAccount));
      await SecureStore.setItemAsync('neuroscope-demo-session', 'true');
      setAccount(demoAccount);
      return;
    }

    const session = createAccount ? await registerAccount(email, password) : await signIn(email, password);
    await SecureStore.deleteItemAsync('neuroscope-demo-session');
    await SecureStore.setItemAsync('neuroscope-token', session.token);
    await SecureStore.setItemAsync('neuroscope-account', JSON.stringify(session.user));
    setAccount(session.user);
  }

  async function signOut() {
    await SecureStore.deleteItemAsync('neuroscope-token');
    await SecureStore.deleteItemAsync('neuroscope-account');
    await SecureStore.deleteItemAsync('neuroscope-demo-session');
    setAccount(null);
  }

  return <AuthContext.Provider value={{ account, ready, authenticate, signOut }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider.');
  return context;
}