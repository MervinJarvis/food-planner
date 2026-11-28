import { useRef, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type ScrollViewInstance,
} from 'react-native';
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
  const [tourStep, setTourStep] = useState<number | null>(null);
  const [dietAllergyY, setDietAllergyY] = useState(0);
  const [cookingPreferencesY, setCookingPreferencesY] = useState(0);
  const [savePreferencesY, setSavePreferencesY] = useState(0);
  const scrollViewRef = useRef<ScrollViewInstance>(null);
  const knownAllergies = ALLERGY_OPTIONS as readonly string[];

  const openQuickGuide = () => {
    setTourStep(0);
    scrollViewRef.current?.scrollTo({ y: Math.max(0, dietAllergyY - 16), animated: true });
  };

  const advanceTour = () => {
    if (tourStep === null) return;
    if (tourStep < 2) {
      const nextStep = tourStep + 1;
      setTourStep(nextStep);
      const nextY = nextStep === 1 ? cookingPreferencesY : savePreferencesY;
      scrollViewRef.current?.scrollTo({ y: Math.max(0, nextY - 16), animated: true });
    } else {
      setTourStep(null);
    }
  };

  const previousTour = () => {
    if (tourStep === null || tourStep === 0) return;
    const previousStep = tourStep - 1;
    setTourStep(previousStep);
    const previousY = previousStep === 0 ? dietAllergyY : cookingPreferencesY;
    scrollViewRef.current?.scrollTo({ y: Math.max(0, previousY - 16), animated: true });
  };

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
    <>
    <ScrollView
      ref={scrollViewRef}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.hero}>
        <View style={styles.heroTopRow}>
          <Text style={styles.eyebrow}>MAKE IT YOURS</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Open quick guide"
            onPress={openQuickGuide}
            style={styles.quickGuideButton}
          >
            <Text style={styles.quickGuideButtonText}>Quick guide</Text>
          </Pressable>
        </View>
        <Text style={styles.title}>Food preferences</Text>
        <Text style={styles.subtitle}>
          Save your food and cooking preferences for your meal-planning profile.
        </Text>
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}
      {saveError ? <Text style={styles.error}>{saveError}</Text> : null}
      {saved ? <Text style={styles.savedMessage}>Preferences saved on this device.</Text> : null}

      <View
        onLayout={(event) => setDietAllergyY(event.nativeEvent.layout.y)}
        style={tourStep === 0 ? styles.tourHighlight : undefined}
      >
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
      </View>

      <View
        onLayout={(event) => setCookingPreferencesY(event.nativeEvent.layout.y)}
        style={tourStep === 1 ? styles.tourHighlight : undefined}
      >
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
      </View>

      <View
        onLayout={(event) => setSavePreferencesY(event.nativeEvent.layout.y)}
        style={tourStep === 2 ? styles.tourHighlight : undefined}
      >
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
      </View>
    </ScrollView>
    {tourStep !== null ? (
      <View style={styles.tourTip}>
        <View style={styles.tourTipHeading}>
          <Text style={styles.tourTipStep}>STEP {tourStep + 1} OF 3</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close quick tour"
            onPress={() => setTourStep(null)}
            hitSlop={8}
          >
            <Text style={styles.tourTipClose}>×</Text>
          </Pressable>
        </View>
        <Text style={styles.tourTipTitle}>
          {tourStep === 0
            ? 'Set your diet and allergies'
            : tourStep === 1
              ? 'Add cooking preferences'
              : 'Save your profile'}
        </Text>
        <Text style={styles.tourTipMessage}>
          {tourStep === 0
            ? 'Choose a diet type and mark any allergies. Known ingredients that match saved allergies are hidden from meal suggestions.'
            : tourStep === 1
              ? 'Choose your cooking skill and available time. These preferences are saved, but do not yet filter recipes.'
              : 'Tap Save preferences to keep your selections on this device. Review ingredient labels even when recipes are suggested.'}
        </Text>
        <View style={styles.tourTipActions}>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ disabled: tourStep === 0 }}
            disabled={tourStep === 0}
            onPress={previousTour}
            style={[styles.tourTipPrevButton, tourStep === 0 && styles.tourTipPrevButtonDisabled]}
          >
            <Text style={styles.tourTipPrevButtonText}>Prev</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={advanceTour}
            style={styles.tourTipNextButton}
          >
            <Text style={styles.tourTipNextButtonText}>
              {tourStep === 2 ? 'Finish' : 'Next'}
            </Text>
          </Pressable>
        </View>
      </View>
    ) : null}
    </>
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
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  eyebrow: {
    color: '#2D6A4F',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1,
  },
  quickGuideButton: {
    minHeight: 44,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: '#C45C26',
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickGuideButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
  tourHighlight: {
    padding: 8,
    marginHorizontal: -8,
    borderWidth: 2,
    borderColor: '#C45C26',
    borderRadius: 14,
  },
  tourTip: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 16,
    zIndex: 20,
    maxWidth: 440,
    alignSelf: 'center',
    padding: 16,
    borderWidth: 1,
    borderColor: '#E8D5C4',
    borderRadius: 16,
    backgroundColor: '#FFF8F0',
    shadowColor: '#3D2B1F',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
    elevation: 8,
  },
  tourTipHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  tourTipStep: {
    color: '#C45C26',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
  },
  tourTipClose: {
    color: '#7A6B5E',
    fontSize: 24,
    lineHeight: 24,
  },
  tourTipTitle: {
    marginTop: 4,
    color: '#7A2E0E',
    fontSize: 17,
    fontWeight: '800',
  },
  tourTipMessage: {
    marginTop: 6,
    color: '#5C4A3A',
    fontSize: 14,
    lineHeight: 20,
  },
  tourTipActions: {
    marginTop: 12,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
  },
  tourTipPrevButton: {
    minHeight: 40,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: '#EDE2D7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tourTipPrevButtonText: {
    color: '#3D2B1F',
    fontSize: 13,
    fontWeight: '700',
  },
  tourTipPrevButtonDisabled: {
    opacity: 0.45,
  },
  tourTipNextButton: {
    minHeight: 40,
    paddingHorizontal: 16,
    borderRadius: 10,
    backgroundColor: '#2D6A4F',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tourTipNextButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
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
