import { createContext, useContext, useEffect, useState, type PropsWithChildren } from 'react';
import * as SecureStore from 'expo-secure-store';
import { registerAccount, signIn } from '@/lib/api';

type Account = { id: string; email: string };
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
    const session = createAccount ? await registerAccount(email, password) : await signIn(email, password);
    await SecureStore.setItemAsync('neuroscope-token', session.token);
    await SecureStore.setItemAsync('neuroscope-account', JSON.stringify(session.user));
    setAccount(session.user);
  }

  async function signOut() {
    await SecureStore.deleteItemAsync('neuroscope-token');
    await SecureStore.deleteItemAsync('neuroscope-account');
    setAccount(null);
  }

  return <AuthContext.Provider value={{ account, ready, authenticate, signOut }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider.');
  return context;
}