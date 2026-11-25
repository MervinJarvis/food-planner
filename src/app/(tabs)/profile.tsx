import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import {
  ALLERGY_OPTIONS,
  COOKING_SKILLS,
  COOKING_TIMES,
  DIET_TYPES,
  type ProfilePreferences,
  useProfile,
} from '../../context/ProfileContext';

function ChoiceGroup<T extends string | number | null>({
  label,
  options,
  value,
  onChange,
  disabled,
}: {
  label: string;
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  disabled: boolean;
}) {
  return (
    <>
      <Text style={styles.section}>{label}</Text>
      <View style={styles.choices}>
        {options.map((option) => {
          const selected = value === option.value;
          return (
            <Pressable
              key={String(option.value)}
              accessibilityRole="button"
              accessibilityState={{ selected, disabled }}
              disabled={disabled}
              onPress={() => onChange(option.value)}
              style={[styles.choice, selected && styles.choiceSelected, disabled && styles.disabled]}
            >
              <Text style={[styles.choiceText, selected && styles.choiceTextSelected]}>
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </>
  );
}

export default function ProfileScreen() {
  const profile = useProfile();

  if (profile.loading) {
    return (
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.status}>Loading your preferences…</Text>
      </ScrollView>
    );
  }

  return (
    <ProfileForm
      preferences={profile.preferences}
      error={profile.error}
      savePreferences={profile.savePreferences}
    />
  );
}

function ProfileForm({
  preferences,
  error,
  savePreferences,
}: {
  preferences: ProfilePreferences;
  error: string | null;
  savePreferences: (preferences: ProfilePreferences) => Promise<void>;
}) {
  const [draft, setDraft] = useState<ProfilePreferences>(preferences);
  const [otherAllergies, setOtherAllergies] = useState(() => {
    const knownAllergies = ALLERGY_OPTIONS as readonly string[];
    return preferences.allergies.filter((allergy) => !knownAllergies.includes(allergy)).join(', ');
  });
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const knownAllergies = ALLERGY_OPTIONS as readonly string[];

  const updateDraft = (update: (current: ProfilePreferences) => ProfilePreferences) => {
    setDraft(update);
    setSaved(false);
  };

  const toggleAllergy = (allergy: string) => {
    updateDraft((current) => ({
      ...current,
      allergies: current.allergies.includes(allergy)
        ? current.allergies.filter((item) => item !== allergy)
        : [...current.allergies, allergy],
    }));
  };

  const save = async () => {
    const customAllergies = otherAllergies
      .split(',')
      .map((allergy) => allergy.trim())
      .filter(Boolean);
    setSaving(true);
    setSaveError(null);
    setSaved(false);
    try {
      await savePreferences({
        ...draft,
        allergies: [...draft.allergies.filter((allergy) =>
          knownAllergies.includes(allergy),
        ), ...customAllergies],
      });
      setSaved(true);
    } catch (saveFailure) {
      setSaveError(
        saveFailure instanceof Error ? saveFailure.message : 'Profile preferences could not be saved.',
      );
    } finally {
      setSaving(false);
    }
  };

  const disabled = saving;

  return (
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <View style={styles.hero}>
        <Text style={styles.eyebrow}>MAKE IT YOURS</Text>
        <Text style={styles.title}>Food preferences</Text>
        <Text style={styles.subtitle}>
          Save your food and cooking preferences for your meal-planning profile.
        </Text>
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}
      {saveError ? <Text style={styles.error}>{saveError}</Text> : null}
      {saved ? <Text style={styles.savedMessage}>Preferences saved on this device.</Text> : null}

      <ChoiceGroup
        label="Diet type"
        options={DIET_TYPES}
        value={draft.dietType}
        onChange={(dietType) => updateDraft((current) => ({ ...current, dietType }))}
        disabled={disabled}
      />

      <Text style={styles.section}>Allergies</Text>
      <Text style={styles.helper}>Choose any that apply. Add others separated by commas.</Text>
      <View style={styles.choices}>
        {ALLERGY_OPTIONS.map((allergy) => {
          const selected = draft.allergies.includes(allergy);
          return (
            <Pressable
              key={allergy}
              accessibilityRole="button"
              accessibilityState={{ selected, disabled }}
              disabled={disabled}
              onPress={() => toggleAllergy(allergy)}
              style={[styles.choice, selected && styles.choiceSelected, disabled && styles.disabled]}
            >
              <Text style={[styles.choiceText, selected && styles.choiceTextSelected]}>
                {selected ? '✓ ' : ''}{allergy}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <TextInput
        accessibilityLabel="Other allergies"
        editable={!disabled}
        placeholder="Other allergies (comma separated)"
        placeholderTextColor="#7A6B5E"
        value={otherAllergies}
        onChangeText={(value) => {
          setOtherAllergies(value);
          setSaved(false);
        }}
        style={styles.input}
      />

      <ChoiceGroup
        label="Cooking skill"
        options={COOKING_SKILLS}
        value={draft.cookingSkill}
        onChange={(cookingSkill) => updateDraft((current) => ({ ...current, cookingSkill }))}
        disabled={disabled}
      />

      <ChoiceGroup
        label="Available cooking time"
        options={COOKING_TIMES}
        value={draft.cookingTimeMinutes}
        onChange={(cookingTimeMinutes) => updateDraft((current) => ({
          ...current,
          cookingTimeMinutes,
        }))}
        disabled={disabled}
      />

      <Text style={styles.disclaimer}>
        Known ingredients matching saved allergies are hidden from meal suggestions. Diet type,
        cooking skill, and available time are saved but do not yet filter recipes. Always review
        ingredient labels.
      </Text>

      <Pressable
        accessibilityRole="button"
        disabled={disabled}
        onPress={save}
        style={[styles.saveButton, disabled && styles.saveButtonDisabled]}
      >
        <Text style={styles.saveButtonText}>{saving ? 'Saving…' : 'Save preferences'}</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    width: '100%',
    maxWidth: 720,
    alignSelf: 'center',
    padding: 20,
    paddingBottom: 44,
    backgroundColor: '#FFF8F0',
  },
  hero: {
    marginBottom: 12,
    paddingVertical: 8,
  },
  eyebrow: {
    color: '#2D6A4F',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1,
  },
  title: {
    marginTop: 6,
    color: '#7A2E0E',
    fontSize: 30,
    fontWeight: '800',
  },
  subtitle: {
    marginTop: 6,
    color: '#5C4A3A',
    fontSize: 15,
    lineHeight: 22,
  },
  status: {
    marginBottom: 8,
    color: '#5C4A3A',
    fontSize: 14,
  },
  error: {
    marginBottom: 8,
    color: '#9A3412',
    fontSize: 14,
  },
  savedMessage: {
    marginBottom: 8,
    color: '#2D6A4F',
    fontSize: 14,
    fontWeight: '700',
  },
  section: {
    marginTop: 22,
    marginBottom: 10,
    color: '#3D2B1F',
    fontSize: 17,
    fontWeight: '800',
  },
  helper: {
    marginBottom: 10,
    color: '#5C4A3A',
    fontSize: 14,
    lineHeight: 20,
  },
  choices: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  choice: {
    minHeight: 42,
    justifyContent: 'center',
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: '#E8D5C4',
    borderRadius: 999,
    backgroundColor: '#FFFFFF',
  },
  choiceSelected: {
    borderColor: '#2D6A4F',
    backgroundColor: '#EAF2ED',
  },
  choiceText: {
    color: '#5C4A3A',
    fontSize: 14,
    fontWeight: '700',
  },
  choiceTextSelected: {
    color: '#2D6A4F',
  },
  disabled: {
    opacity: 0.6,
  },
  input: {
    minHeight: 48,
    marginTop: 12,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: '#E8D5C4',
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    color: '#3D2B1F',
    fontSize: 15,
  },
  disclaimer: {
    marginTop: 22,
    color: '#6E542F',
    fontSize: 13,
    lineHeight: 19,
  },
  saveButton: {
    minHeight: 52,
    marginTop: 18,
    borderRadius: 14,
    backgroundColor: '#2D6A4F',
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButtonDisabled: {
    opacity: 0.65,
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
});
