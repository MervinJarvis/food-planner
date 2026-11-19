import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import type { PropsWithChildren } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { FunctionsHttpError } from '@supabase/supabase-js';
import type { Session, User } from '@supabase/supabase-js';
import { supabase, supabaseConfigurationError } from '../lib/supabase';
import {
  GUEST_MODE_STORAGE_KEY,
  GUEST_PANTRY_STORAGE_KEY,
  GUEST_SIGNUP_PENDING_KEY,
  LEGACY_PANTRY_STORAGE_KEY,
  PENDING_GUEST_PANTRY_IMPORT_KEY,
  PENDING_PANTRY_IMPORT_KEY,
} from '../lib/pantryStorage';

type SignUpResult = {
  emailConfirmationRequired: boolean;
  pantryImportPending: boolean;
  guestPantryImportPending: boolean;
  pantryImportWarning: string | null;
};

type AuthContextValue = {
  session: Session | null;
  user: User | null;
  guest: boolean;
  loading: boolean;
  accountSetupPending: boolean;
  sessionError: string | null;
  configurationError: string | null;
  pendingPantryImportUserId: string | null;
  pendingGuestPantryImportUserId: string | null;
  signIn: (identifier: string, password: string) => Promise<void>;
  signUp: (username: string, email: string, password: string) => Promise<SignUpResult>;
  startGuestMode: () => Promise<void>;
  leaveGuestMode: () => Promise<void>;
  prepareGuestAccountSignup: () => Promise<void>;
  signOut: () => Promise<void>;
  clearPendingPantryImport: (userId: string, removeLegacyPantry: boolean) => Promise<void>;
  clearPendingGuestPantryImport: (userId: string, removeGuestPantry: boolean) => Promise<void>;
};

type UsernameLoginResponse = {
  access_token: string;
  refresh_token: string;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function normalizeLoginIdentifier(value: string): string {
  const trimmed = value.trim();
  const compactPhone = trimmed.replace(/[\s().-]/g, '');
  if (/^\+?\d+$/.test(compactPhone)) return compactPhone;
  return trimmed.toLowerCase();
}

function requireSupabase() {
  if (!supabase) {
    throw new Error(supabaseConfigurationError ?? 'Supabase is not configured.');
  }
  return supabase;
}

export function AuthProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<Session | null>(null);
  const [guest, setGuest] = useState(false);
  const [loading, setLoading] = useState(true);
  const [accountSetupPending, setAccountSetupPending] = useState(false);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [pendingPantryImportUserId, setPendingPantryImportUserId] = useState<string | null>(null);
  const [pendingGuestPantryImportUserId, setPendingGuestPantryImportUserId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const authListener = supabase?.auth.onAuthStateChange((_event, nextSession) => {
      if (!active) return;
      setSession(nextSession);
      if (nextSession) setGuest(false);
      setSessionError(null);
      setLoading(false);
    });

    Promise.all([
      supabase
        ? supabase.auth.getSession().then(({ data, error }) => {
          if (error) throw error;
          return data.session;
        })
        : Promise.resolve(null),
      AsyncStorage.multiGet([
        GUEST_MODE_STORAGE_KEY,
        PENDING_PANTRY_IMPORT_KEY,
        PENDING_GUEST_PANTRY_IMPORT_KEY,
      ]),
    ])
      .then(([nextSession, storedValues]) => {
        if (!active) return;
        const values = new Map(storedValues);
        setSession(nextSession);
        setGuest(!nextSession && values.get(GUEST_MODE_STORAGE_KEY) === 'true');
        setPendingPantryImportUserId(values.get(PENDING_PANTRY_IMPORT_KEY) ?? null);
        setPendingGuestPantryImportUserId(
          values.get(PENDING_GUEST_PANTRY_IMPORT_KEY) ?? null,
        );
        setSessionError(null);
      })
      .catch((sessionError: unknown) => {
        if (active) {
          setSession(null);
          setSessionError(
            `Could not restore your sign-in: ${
              sessionError instanceof Error ? sessionError.message : 'Unexpected session error.'
            }`,
          );
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
      authListener?.data.subscription.unsubscribe();
    };
  }, []);

  const signIn = useCallback(async (identifier: string, password: string) => {
    const client = requireSupabase();
    const { data, error } = await client.functions.invoke<UsernameLoginResponse>(
      'login-with-username',
      { body: { identifier: normalizeLoginIdentifier(identifier), password } },
    );
    if (error instanceof FunctionsHttpError) {
      const responseBody: unknown = await error.context.json().catch(() => null);
      if (
        typeof responseBody === 'object' &&
        responseBody !== null &&
        'error' in responseBody &&
        typeof responseBody.error === 'string'
      ) {
        throw new Error(responseBody.error);
      }
    }
    if (error) throw new Error(error.message);
    if (!data?.access_token || !data.refresh_token) {
      throw new Error('Sign-in did not return a valid session.');
    }

    await AsyncStorage.removeItem(GUEST_MODE_STORAGE_KEY);
    await AsyncStorage.removeItem(GUEST_SIGNUP_PENDING_KEY);
    const { error: sessionError } = await client.auth.setSession({
      access_token: data.access_token,
      refresh_token: data.refresh_token,
    });
    if (sessionError) throw sessionError;
  }, []);

  const signUp = useCallback(async (
    username: string,
    email: string,
    password: string,
  ): Promise<SignUpResult> => {
    const client = requireSupabase();
    const normalizedUsername = normalizeLoginIdentifier(username);
    if (!normalizedUsername) throw new Error('Enter a username or phone number.');
    if (password.length < 8) throw new Error('Password must be at least 8 characters.');

    setAccountSetupPending(true);
    try {
      const { data, error } = await client.auth.signUp({
        email: email.trim().toLowerCase(),
        password,
        options: { data: { username: normalizedUsername } },
      });
      if (error) throw error;

      let pantryImportPending = false;
      let guestPantryImportPending = false;
      let pantryImportWarning: string | null = null;
      if (data.user) {
        try {
          const legacyPantry = await AsyncStorage.getItem(LEGACY_PANTRY_STORAGE_KEY);
          if (legacyPantry !== null) {
            const currentImportOwner = await AsyncStorage.getItem(PENDING_PANTRY_IMPORT_KEY);
            if (currentImportOwner && currentImportOwner !== data.user.id) {
              pantryImportWarning = 'This device has pantry data queued for another account.';
            } else {
              await AsyncStorage.setItem(PENDING_PANTRY_IMPORT_KEY, data.user.id);
              setPendingPantryImportUserId(data.user.id);
              pantryImportPending = true;
            }
          }
        } catch (storageError) {
          pantryImportWarning = storageError instanceof Error
            ? `Account created, but this device's pantry could not be queued for import: ${storageError.message}`
            : 'Account created, but this device’s pantry could not be queued for import.';
        }
      }
      if (data.user) {
        try {
          const guestSignupPending = await AsyncStorage.getItem(GUEST_SIGNUP_PENDING_KEY);
          const guestPantry = await AsyncStorage.getItem(GUEST_PANTRY_STORAGE_KEY);
          if (guestSignupPending === 'true') {
            if (guestPantry !== null) {
              const currentImportOwner = await AsyncStorage.getItem(PENDING_GUEST_PANTRY_IMPORT_KEY);
              if (currentImportOwner && currentImportOwner !== data.user.id) {
                pantryImportWarning = 'Guest pantry data is queued for another account.';
              } else {
                await AsyncStorage.setItem(PENDING_GUEST_PANTRY_IMPORT_KEY, data.user.id);
                setPendingGuestPantryImportUserId(data.user.id);
                guestPantryImportPending = true;
                await AsyncStorage.removeItem(GUEST_SIGNUP_PENDING_KEY);
              }
            } else {
              await AsyncStorage.removeItem(GUEST_SIGNUP_PENDING_KEY);
            }
          }
        } catch (storageError) {
          pantryImportWarning = storageError instanceof Error
            ? `Account created, but guest pantry could not be queued for import: ${storageError.message}`
            : 'Account created, but guest pantry could not be queued for import.';
        }
      }

      return {
        emailConfirmationRequired: data.session === null,
        pantryImportPending,
        guestPantryImportPending,
        pantryImportWarning,
      };
    } finally {
      setAccountSetupPending(false);
    }
  }, []);

  const startGuestMode = useCallback(async () => {
    if (session) throw new Error('Sign out before entering guest mode.');
    await AsyncStorage.setItem(GUEST_MODE_STORAGE_KEY, 'true');
    await AsyncStorage.removeItem(GUEST_SIGNUP_PENDING_KEY);
    setGuest(true);
    setSessionError(null);
  }, [session]);

  const leaveGuestMode = useCallback(async () => {
    await AsyncStorage.removeItem(GUEST_MODE_STORAGE_KEY);
    await AsyncStorage.removeItem(GUEST_SIGNUP_PENDING_KEY);
    setGuest(false);
  }, []);

  const prepareGuestAccountSignup = useCallback(async () => {
    if (!guest) throw new Error('Guest mode is not active.');
    await AsyncStorage.setItem(GUEST_SIGNUP_PENDING_KEY, 'true');
    await AsyncStorage.removeItem(GUEST_MODE_STORAGE_KEY);
    setGuest(false);
  }, [guest]);

  const signOut = useCallback(async () => {
    await AsyncStorage.removeItem(GUEST_MODE_STORAGE_KEY);
    await AsyncStorage.removeItem(GUEST_SIGNUP_PENDING_KEY);
    setGuest(false);
    const client = requireSupabase();
    const { error } = await client.auth.signOut();
    if (error) throw error;
  }, []);

  const clearPendingPantryImport = useCallback(async (
    userId: string,
    removeLegacyPantry: boolean,
  ) => {
    const pendingUserId = await AsyncStorage.getItem(PENDING_PANTRY_IMPORT_KEY);
    if (pendingUserId !== userId) return;
    if (removeLegacyPantry) {
      await AsyncStorage.removeItem(LEGACY_PANTRY_STORAGE_KEY);
    }
    await AsyncStorage.removeItem(PENDING_PANTRY_IMPORT_KEY);
    setPendingPantryImportUserId(null);
  }, []);

  const clearPendingGuestPantryImport = useCallback(async (
    userId: string,
    removeGuestPantry: boolean,
  ) => {
    const pendingUserId = await AsyncStorage.getItem(PENDING_GUEST_PANTRY_IMPORT_KEY);
    if (pendingUserId !== userId) return;
    if (removeGuestPantry) {
      await AsyncStorage.removeItem(GUEST_PANTRY_STORAGE_KEY);
    }
    await AsyncStorage.removeItem(PENDING_GUEST_PANTRY_IMPORT_KEY);
    setPendingGuestPantryImportUserId(null);
  }, []);

  const value = useMemo<AuthContextValue>(() => ({
    session,
    user: session?.user ?? null,
    guest,
    loading,
    accountSetupPending,
    sessionError,
    configurationError: supabaseConfigurationError,
    pendingPantryImportUserId,
    pendingGuestPantryImportUserId,
    signIn,
    signUp,
    startGuestMode,
    leaveGuestMode,
    prepareGuestAccountSignup,
    signOut,
    clearPendingPantryImport,
    clearPendingGuestPantryImport,
  }), [
    accountSetupPending,
    clearPendingPantryImport,
    clearPendingGuestPantryImport,
    guest,
    loading,
    pendingPantryImportUserId,
    pendingGuestPantryImportUserId,
    prepareGuestAccountSignup,
    session,
    sessionError,
    signIn,
    signOut,
    signUp,
    startGuestMode,
    leaveGuestMode,
  ]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider.');
  return context;
}
