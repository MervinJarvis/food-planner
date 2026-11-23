import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { LANGUAGE_OPTIONS } from '../data/ingredientTranslations';
import { useLanguage } from '../context/LanguageContext';

export function LanguagePicker() {
  const { language, loading, error, setLanguage } = useLanguage();
  const [selectionError, setSelectionError] = useState<string | null>(null);

  const selectLanguage = async (nextLanguage: typeof language) => {
    setSelectionError(null);
    try {
      await setLanguage(nextLanguage);
    } catch {
      setSelectionError('Could not save language choice. Please try again.');
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Ingredient language</Text>
      <View style={styles.options}>
        {LANGUAGE_OPTIONS.map((option) => (
          <Pressable
            key={option.id}
            accessibilityRole="button"
            accessibilityState={{ selected: language === option.id, disabled: loading }}
            disabled={loading}
            onPress={() => void selectLanguage(option.id)}
            style={[styles.option, language === option.id && styles.optionSelected]}
          >
            <Text style={[styles.optionText, language === option.id && styles.optionTextSelected]}>
              {option.label}
            </Text>
          </Pressable>
        ))}
      </View>
      {selectionError || error ? (
        <Text accessibilityRole="alert" style={styles.error}>
          {selectionError ?? error}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 16,
  },
  label: {
    marginBottom: 8,
    color: '#5C4A3A',
    fontSize: 13,
    fontWeight: '700',
  },
  options: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  option: {
    minHeight: 40,
    minWidth: 62,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: '#D8C4B1',
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionSelected: {
    borderColor: '#2D6A4F',
    backgroundColor: '#EAF2ED',
  },
  optionText: {
    color: '#5C4A3A',
    fontSize: 14,
    fontWeight: '700',
  },
  optionTextSelected: {
    color: '#2D6A4F',
  },
  error: {
    marginTop: 6,
    color: '#9A3412',
    fontSize: 12,
  },
});
