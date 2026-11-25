import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { PropsWithChildren } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const PROFILE_STORAGE_KEY = '@food-planner/profile-preferences';

export const DIET_TYPES = [
  { value: 'no-preference', label: 'No preference' },
  { value: 'vegetarian', label: 'Vegetarian' },
  { value: 'vegan', label: 'Vegan' },
  { value: 'pescatarian', label: 'Pescatarian' },
  { value: 'non-vegetarian', label: 'Non-vegetarian' },
] as const;

export const COOKING_SKILLS = [
  { value: 'beginner', label: 'Beginner' },
  { value: 'intermediate', label: 'Intermediate' },
  { value: 'advanced', label: 'Advanced' },
] as const;

export const COOKING_TIMES = [
  { value: null, label: 'Any time' },
  { value: 15, label: '15 min' },
  { value: 30, label: '30 min' },
  { value: 45, label: '45 min' },
  { value: 60, label: '60 min' },
] as const;

export const ALLERGY_OPTIONS = [
  'Dairy',
  'Eggs',
  'Fish',
  'Peanuts',
  'Sesame',
  'Shellfish',
  'Soy',
  'Tree nuts',
  'Wheat / gluten',
] as const;

export type DietType = (typeof DIET_TYPES)[number]['value'];
export type CookingSkill = (typeof COOKING_SKILLS)[number]['value'];
export type CookingTime = (typeof COOKING_TIMES)[number]['value'];

export type ProfilePreferences = {
  dietType: DietType;
  allergies: string[];
  cookingSkill: CookingSkill;
  cookingTimeMinutes: CookingTime;
};

const DEFAULT_PREFERENCES: ProfilePreferences = {
  dietType: 'no-preference',
  allergies: [],
  cookingSkill: 'beginner',
  cookingTimeMinutes: null,
};

type ProfileContextValue = {
  preferences: ProfilePreferences;
  loading: boolean;
  error: string | null;
  savePreferences: (preferences: ProfilePreferences) => Promise<void>;
};

const ProfileContext = createContext<ProfileContextValue | null>(null);

function isDietType(value: unknown): value is DietType {
  return DIET_TYPES.some((option) => option.value === value);
}

function isCookingSkill(value: unknown): value is CookingSkill {
  return COOKING_SKILLS.some((option) => option.value === value);
}

function isCookingTime(value: unknown): value is CookingTime {
  return COOKING_TIMES.some((option) => option.value === value);
}

function parsePreferences(value: string | null): ProfilePreferences {
  if (!value) return DEFAULT_PREFERENCES;
  const parsed: unknown = JSON.parse(value);
  if (!parsed || typeof parsed !== 'object') return DEFAULT_PREFERENCES;

  const stored = parsed as Record<string, unknown>;
  return {
    dietType: isDietType(stored.dietType) ? stored.dietType : DEFAULT_PREFERENCES.dietType,
    allergies: Array.isArray(stored.allergies)
      ? [...new Set(stored.allergies
        .filter((allergy): allergy is string => typeof allergy === 'string')
        .map((allergy) => allergy.trim())
        .filter(Boolean))].slice(0, 20)
      : [],
    cookingSkill: isCookingSkill(stored.cookingSkill)
      ? stored.cookingSkill
      : DEFAULT_PREFERENCES.cookingSkill,
    cookingTimeMinutes: isCookingTime(stored.cookingTimeMinutes)
      ? stored.cookingTimeMinutes
      : DEFAULT_PREFERENCES.cookingTimeMinutes,
  };
}

export function ProfileProvider({ children }: PropsWithChildren) {
  const [preferences, setPreferences] = useState(DEFAULT_PREFERENCES);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const loadPreferences = async () => {
      try {
        const stored = await AsyncStorage.getItem(PROFILE_STORAGE_KEY);
        const loaded = parsePreferences(stored);
        if (active) setPreferences(loaded);
      } catch {
        if (active) setError('Profile preferences could not be loaded.');
      } finally {
        if (active) setLoading(false);
      }
    };

    void loadPreferences();
    return () => {
      active = false;
    };
  }, []);

  const savePreferences = useCallback(async (nextPreferences: ProfilePreferences) => {
    const normalized: ProfilePreferences = {
      ...nextPreferences,
      allergies: [...new Set(nextPreferences.allergies.map((allergy) => allergy.trim()).filter(Boolean))]
        .slice(0, 20),
    };
    setError(null);
    try {
      await AsyncStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(normalized));
      setPreferences(normalized);
    } catch (saveError) {
      setError('Profile preferences could not be saved.');
      throw saveError;
    }
  }, []);

  const value = useMemo(
    () => ({ preferences, loading, error, savePreferences }),
    [preferences, loading, error, savePreferences],
  );

  return <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>;
}

export function useProfile(): ProfileContextValue {
  const context = useContext(ProfileContext);
  if (!context) throw new Error('useProfile must be used within a ProfileProvider.');
  return context;
}
