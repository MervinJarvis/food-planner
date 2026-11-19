import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { PropsWithChildren } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { INGREDIENT_BY_ID } from '../data/ingredients';
import { useAuth } from './AuthContext';
import { supabase } from '../lib/supabase';
import {
  GUEST_PANTRY_STORAGE_KEY,
  LEGACY_PANTRY_STORAGE_KEY,
} from '../lib/pantryStorage';
import {
  getPantryUnit,
  getRecipeDeduction,
  normalizePantryStock,
  type PantryStock,
  type RecipeUsage,
} from '../lib/pantry';

type PantryContextValue = {
  pantry: PantryStock[];
  loading: boolean;
  error: string | null;
  addStock: (ingredientId: string, quantity: number) => Promise<void>;
  setStock: (ingredientId: string, quantity: number) => Promise<void>;
  removeStock: (ingredientId: string) => Promise<void>;
  consumeRecipe: (usage: RecipeUsage[]) => Promise<void>;
  retryLoad: () => void;
};

type PantryLoadState = {
  ownerId: string;
  attempt: number;
  pendingImportUserId: string | null;
  pendingGuestImportUserId: string | null;
  status: 'loaded' | 'error';
  message?: string;
};

const GUEST_OWNER_ID = 'guest';

const PantryContext = createContext<PantryContextValue | null>(null);

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'An unexpected pantry storage error occurred.';
}

export function PantryProvider({ children }: PropsWithChildren) {
  const {
    user,
    guest,
    loading: authLoading,
    accountSetupPending,
    pendingPantryImportUserId,
    pendingGuestPantryImportUserId,
    clearPendingPantryImport,
    clearPendingGuestPantryImport,
  } = useAuth();
  const [pantry, setPantry] = useState<PantryStock[]>([]);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [loadState, setLoadState] = useState<PantryLoadState | null>(null);
  const [saveError, setSaveError] = useState<{ ownerId: string; message: string } | null>(null);
  const pantryRef = useRef<PantryStock[]>([]);
  const currentUserId = useRef<string | null>(null);
  const writeQueue = useRef<Promise<void>>(Promise.resolve());

  const ownerId = user?.id ?? (guest ? GUEST_OWNER_ID : null);
  const activeLoadState = ownerId &&
    loadState?.ownerId === ownerId &&
    loadState.attempt === loadAttempt &&
    loadState.pendingImportUserId === pendingPantryImportUserId &&
    loadState.pendingGuestImportUserId === pendingGuestPantryImportUserId
    ? loadState
    : null;
  const loading = authLoading || Boolean(
    ownerId && (!activeLoadState || activeLoadState.status !== 'loaded'),
  );
  const error = ownerId && saveError?.ownerId === ownerId
    ? saveError.message
    : activeLoadState?.status === 'error'
      ? activeLoadState.message ?? 'Pantry could not be loaded.'
      : null;
  const visiblePantry = useMemo(
    () => activeLoadState?.status === 'loaded' ? pantry : [],
    [activeLoadState, pantry],
  );

  useEffect(() => {
    let active = true;
    const activeOwnerId = user?.id ?? (guest ? GUEST_OWNER_ID : null);
    currentUserId.current = activeOwnerId;

    if (authLoading || accountSetupPending || !activeOwnerId) {
      if (!activeOwnerId) pantryRef.current = [];
      return () => {
        active = false;
      };
    }

    pantryRef.current = [];
    if (guest) {
      const loadGuestPantry = async () => {
        try {
          let stored = await AsyncStorage.getItem(GUEST_PANTRY_STORAGE_KEY);
          if (stored === null) {
            stored = await AsyncStorage.getItem(LEGACY_PANTRY_STORAGE_KEY);
            if (stored !== null) {
              const legacyPantry = normalizePantryStock(JSON.parse(stored));
              if (legacyPantry === null) {
                throw new Error('Saved guest pantry data is invalid. It could not be loaded.');
              }
              await AsyncStorage.setItem(GUEST_PANTRY_STORAGE_KEY, JSON.stringify(legacyPantry));
              await AsyncStorage.removeItem(LEGACY_PANTRY_STORAGE_KEY);
              stored = JSON.stringify(legacyPantry);
            }
          }
          const parsed: unknown = stored === null ? [] : JSON.parse(stored);
          const normalized = normalizePantryStock(parsed);
          if (normalized === null) {
            throw new Error('Saved guest pantry data is invalid. It could not be loaded.');
          }
          if (active && currentUserId.current === activeOwnerId) {
            pantryRef.current = normalized;
            setPantry(normalized);
            setLoadState({
              ownerId: activeOwnerId,
              attempt: loadAttempt,
              pendingImportUserId: pendingPantryImportUserId,
              pendingGuestImportUserId: pendingGuestPantryImportUserId,
              status: 'loaded',
            });
          }
        } catch (loadError: unknown) {
          if (active && currentUserId.current === activeOwnerId) {
            setLoadState({
              ownerId: activeOwnerId,
              attempt: loadAttempt,
              pendingImportUserId: pendingPantryImportUserId,
              pendingGuestImportUserId: pendingGuestPantryImportUserId,
              status: 'error',
              message: `Could not load guest pantry: ${getErrorMessage(loadError)}`,
            });
          }
        }
      };
      void loadGuestPantry();
      return () => {
        active = false;
      };
    }

    const client = supabase;
    if (!client) {
      Promise.resolve().then(() => {
        if (active) {
          setLoadState({
            ownerId: activeOwnerId,
            attempt: loadAttempt,
            pendingImportUserId: pendingPantryImportUserId,
            pendingGuestImportUserId: pendingGuestPantryImportUserId,
            status: 'error',
            message: 'Supabase is not configured. Add the required environment variables and restart the app.',
          });
        }
      });
      return () => {
        active = false;
      };
    }

    const loadPantry = async () => {
      try {
        const { data, error: loadError } = await client
          .from('pantry_stock')
          .select('ingredient_id, quantity, unit')
          .eq('user_id', activeOwnerId);
        if (loadError) throw loadError;
        const normalized = normalizePantryStock(
          (data ?? []).map((item) => ({
            ingredientId: item.ingredient_id,
            quantity: item.quantity,
            unit: item.unit,
          })),
        );
        if (normalized === null) {
          throw new Error('Saved pantry data is invalid. It could not be loaded.');
        }
        let nextPantry = normalized;
        if (pendingPantryImportUserId === activeOwnerId) {
          if (!active || currentUserId.current !== activeOwnerId) return;
          const legacyData = await AsyncStorage.getItem(LEGACY_PANTRY_STORAGE_KEY);
          let removeLegacyPantry = false;
          if (legacyData !== null) {
            removeLegacyPantry = true;
            let parsedLegacyData: unknown;
            try {
              parsedLegacyData = JSON.parse(legacyData);
            } catch {
              throw new Error('Existing device pantry data is invalid and could not be imported.');
            }
            const legacyPantry = normalizePantryStock(parsedLegacyData);
            if (legacyPantry === null) {
              throw new Error('Existing device pantry data is invalid and could not be imported.');
            }
            if (normalized.length === 0) {
              if (legacyPantry.length > 0) {
                if (!active || currentUserId.current !== activeOwnerId) return;
                const { error: importError } = await client.rpc('replace_my_pantry', {
                  p_items: legacyPantry.map((item) => ({
                    ingredient_id: item.ingredientId,
                    quantity: item.quantity,
                    unit: item.unit,
                  })),
                });
                if (importError) throw importError;
              }
              nextPantry = legacyPantry;
            }
          }
          if (!active || currentUserId.current !== activeOwnerId) return;
          await clearPendingPantryImport(activeOwnerId, removeLegacyPantry);
        }
        if (pendingGuestPantryImportUserId === activeOwnerId) {
          if (!active || currentUserId.current !== activeOwnerId) return;
          const guestData = await AsyncStorage.getItem(GUEST_PANTRY_STORAGE_KEY);
          let removeGuestPantry = false;
          if (guestData !== null) {
            const parsedGuest: unknown = JSON.parse(guestData);
            const guestPantry = normalizePantryStock(parsedGuest);
            if (guestPantry === null) {
              throw new Error('Saved guest pantry data is invalid and could not be imported.');
            }
            if (nextPantry.length === 0) {
              if (guestPantry.length > 0) {
                if (!active || currentUserId.current !== activeOwnerId) return;
                const { error: importError } = await client.rpc('replace_my_pantry', {
                  p_items: guestPantry.map((item) => ({
                    ingredient_id: item.ingredientId,
                    quantity: item.quantity,
                    unit: item.unit,
                  })),
                });
                if (importError) throw importError;
              }
              nextPantry = guestPantry;
              removeGuestPantry = true;
            }
          }
          if (!active || currentUserId.current !== activeOwnerId) return;
          await clearPendingGuestPantryImport(activeOwnerId, removeGuestPantry);
        }
        if (active && currentUserId.current === activeOwnerId) {
          pantryRef.current = nextPantry;
          setPantry(nextPantry);
          setSaveError((current) =>
            current?.ownerId === activeOwnerId ? null : current,
          );
          setLoadState({
            ownerId: activeOwnerId,
            attempt: loadAttempt,
            pendingImportUserId: pendingPantryImportUserId,
            pendingGuestImportUserId: pendingGuestPantryImportUserId,
            status: 'loaded',
          });
        }
      } catch (loadError: unknown) {
        if (active && currentUserId.current === activeOwnerId) {
          setLoadState({
            ownerId: activeOwnerId,
            attempt: loadAttempt,
            pendingImportUserId: pendingPantryImportUserId,
            pendingGuestImportUserId: pendingGuestPantryImportUserId,
            status: 'error',
            message: `Could not load pantry: ${getErrorMessage(loadError)}`,
          });
        }
      }
    };
    void loadPantry();

    return () => {
      active = false;
    };
  }, [
    authLoading,
    accountSetupPending,
    guest,
    clearPendingPantryImport,
    clearPendingGuestPantryImport,
    loadAttempt,
    pendingPantryImportUserId,
    pendingGuestPantryImportUserId,
    user?.id,
  ]);

  const persistPantry = useCallback((update: (current: PantryStock[]) => PantryStock[]) => {
    if (loading) throw new Error('Pantry is still loading. Please try again.');
    if (error) throw new Error(error);
    if (!user && !guest) throw new Error('Sign in or continue as a guest to save pantry stock.');
    if (activeLoadState?.status !== 'loaded') {
      throw new Error('Pantry is still loading. Please try again.');
    }

    const activeOwnerId = user?.id ?? (guest ? GUEST_OWNER_ID : null);
    if (!activeOwnerId) throw new Error('Sign in or continue as a guest to save pantry stock.');
    const client = user ? supabase : null;
    if (user && !client) throw new Error('Supabase is not configured.');
    const write = writeQueue.current
      .catch(() => undefined)
      .then(async () => {
        if (currentUserId.current !== activeOwnerId) {
          throw new Error('Your account changed. Please try again.');
        }

        const nextPantry = update(pantryRef.current);
        if (guest) {
          await AsyncStorage.setItem(GUEST_PANTRY_STORAGE_KEY, JSON.stringify(nextPantry));
        } else {
          if (!client) throw new Error('Supabase is not configured.');
          const { error: saveErrorResult } = await client.rpc('replace_my_pantry', {
            p_items: nextPantry.map((item) => ({
              ingredient_id: item.ingredientId,
              quantity: item.quantity,
              unit: item.unit,
            })),
          });
          if (saveErrorResult) throw saveErrorResult;
        }

        if (currentUserId.current === activeOwnerId) {
          pantryRef.current = nextPantry;
          setPantry(nextPantry);
          setSaveError(null);
        }
      });
    writeQueue.current = write;

    return write.catch((writeError: unknown) => {
      const message = `Pantry could not be saved: ${getErrorMessage(writeError)}`;
      if (currentUserId.current === activeOwnerId) setSaveError({ ownerId: activeOwnerId, message });
      throw new Error(message);
    });
  }, [activeLoadState, error, guest, loading, user]);

  const addStock = useCallback(async (ingredientId: string, quantity: number) => {
    if (!INGREDIENT_BY_ID[ingredientId]) throw new Error('Choose a valid ingredient.');
    if (!Number.isFinite(quantity) || quantity <= 0) {
      throw new Error('Enter an amount greater than zero.');
    }

    const unit = getPantryUnit(ingredientId);
    if (['piece', 'clove', 'leaf'].includes(unit) && !Number.isInteger(quantity)) {
      throw new Error(`${INGREDIENT_BY_ID[ingredientId].name} must be a whole number.`);
    }

    await persistPantry((current) => {
      const existing = current.find((item) => item.ingredientId === ingredientId);
      return existing
        ? current.map((item) =>
          item.ingredientId === ingredientId
            ? { ...item, quantity: item.quantity + quantity }
            : item,
        )
        : [...current, { ingredientId, quantity, unit }];
    });
  }, [persistPantry]);

  const setStock = useCallback(async (ingredientId: string, quantity: number) => {
    if (!INGREDIENT_BY_ID[ingredientId]) throw new Error('Choose a valid ingredient.');
    if (!Number.isFinite(quantity) || quantity < 0) {
      throw new Error('Enter a valid amount.');
    }

    const unit = getPantryUnit(ingredientId);
    if (['piece', 'clove', 'leaf'].includes(unit) && !Number.isInteger(quantity)) {
      throw new Error(`${INGREDIENT_BY_ID[ingredientId].name} must be a whole number.`);
    }

    await persistPantry((current) => quantity === 0
      ? current.filter((item) => item.ingredientId !== ingredientId)
      : current.some((item) => item.ingredientId === ingredientId)
        ? current.map((item) =>
          item.ingredientId === ingredientId
            ? { ingredientId, quantity, unit }
            : item,
        )
        : [...current, { ingredientId, quantity, unit }]);
  }, [persistPantry]);

  const removeStock = useCallback(async (ingredientId: string) => {
    await persistPantry((current) =>
      current.filter((item) => item.ingredientId !== ingredientId),
    );
  }, [persistPantry]);

  const consumeRecipe = useCallback(async (usage: RecipeUsage[]) => {
    if (loading) throw new Error('Pantry is still loading. Please try again.');
    if (error) throw new Error(error);
    if (!user && !guest) throw new Error('Sign in or continue as a guest to save pantry stock.');

    const { nextPantry, shortages } = getRecipeDeduction(usage, pantryRef.current);
    if (shortages.length > 0) {
      const names = shortages
        .map((item) => INGREDIENT_BY_ID[item.id]?.name ?? item.id)
        .join(', ');
      throw new Error(`Not enough pantry stock for: ${names}. Add stock and try again.`);
    }
    await persistPantry(() => nextPantry);
  }, [error, guest, loading, persistPantry, user]);

  const value = useMemo<PantryContextValue>(() => ({
    pantry: visiblePantry,
    loading,
    error,
    addStock,
    setStock,
    removeStock,
    consumeRecipe,
    retryLoad: () => {
      setSaveError(null);
      setLoadAttempt((attempt) => attempt + 1);
    },
  }), [
    addStock,
    consumeRecipe,
    error,
    loading,
    removeStock,
    setStock,
    visiblePantry,
  ]);

  return <PantryContext.Provider value={value}>{children}</PantryContext.Provider>;
}

export function usePantry(): PantryContextValue {
  const context = useContext(PantryContext);
  if (!context) throw new Error('usePantry must be used inside PantryProvider.');
  return context;
}
