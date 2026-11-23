import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { PropsWithChildren } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { isAppLanguage, type AppLanguage } from '../data/ingredientTranslations';

const LANGUAGE_STORAGE_KEY = '@food-planner/language';

type LanguageContextValue = {
  language: AppLanguage;
  loading: boolean;
  error: string | null;
  setLanguage: (language: AppLanguage) => Promise<void>;
};

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: PropsWithChildren) {
  const [language, setLanguageState] = useState<AppLanguage>('en');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const loadLanguage = async () => {
      try {
        const storedLanguage = await AsyncStorage.getItem(LANGUAGE_STORAGE_KEY);
        if (active && isAppLanguage(storedLanguage)) {
          setLanguageState(storedLanguage);
        }
      } catch {
        if (active) setError('Language preference could not be loaded. Using English.');
      } finally {
        if (active) setLoading(false);
      }
    };

    void loadLanguage();
    return () => {
      active = false;
    };
  }, []);

  const setLanguage = useCallback(async (nextLanguage: AppLanguage) => {
    setError(null);
    try {
      await AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, nextLanguage);
      setLanguageState(nextLanguage);
    } catch (saveError) {
      setError('Language preference could not be saved.');
      throw saveError;
    }
  }, []);

  const value = useMemo(
    () => ({ language, loading, error, setLanguage }),
    [language, loading, error, setLanguage],
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage(): LanguageContextValue {
  const context = useContext(LanguageContext);
  if (!context) throw new Error('useLanguage must be used within a LanguageProvider.');
  return context;
}
