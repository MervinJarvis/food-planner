import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { INGREDIENT_BY_ID } from '../data/ingredients';
import { getIngredientName } from '../data/ingredientTranslations';
import type { AppLanguage } from '../data/ingredientTranslations';
import { hasWeakMatch, isMealType, findDishes, type MatchedRecipe } from '../lib/matchRecipes';
import { useLanguage } from '../context/LanguageContext';
import { usePantry } from '../context/PantryContext';
import { formatPantryQuantity, getRecipeDeductionPreview } from '../lib/pantry';
import { LanguagePicker } from '../components/LanguagePicker';

function parseList(value: string | string[] | undefined): string[] {
  const text = Array.isArray(value) ? value[0] : value;
  return text ? text.split(',').filter(Boolean) : [];
}

function formatAccompaniments(items: string[]): string {
  const names = items.map((item) => item.toLowerCase());
  if (names.length < 2) return names[0] ?? '';
  if (names.length === 2) return `${names[0]} or ${names[1]}`;
  return `${names.slice(0, -1).join(', ')} or ${names[names.length - 1]}`;
}

function formatMacro(value: number): string {
  return `${Math.round(value)} g`;
}

function RecipeCard({
  recipe,
  index,
  cooked,
  onCook,
  language,
}: {
  recipe: MatchedRecipe;
  index: number;
  cooked: boolean;
  onCook: () => void;
  language: AppLanguage;
}) {
  return (
    <View style={styles.card}>
      <Text style={styles.kicker}>DISH {index + 1}</Text>
      <Text style={styles.dishName}>{recipe.name}</Text>
      {recipe.tags.length > 0 ? (
        <View style={styles.tagsRow}>
          {recipe.tags.map((tag) => (
            <View key={tag} style={styles.tag}>
              <Text style={styles.tagText}>{tag}</Text>
            </View>
          ))}
        </View>
      ) : null}
      <View style={styles.dishNutrition}>
        <Text style={styles.dishNutritionTitle}>DISH {index + 1} nutrition per person</Text>
        <Text style={styles.dishNutritionValues}>
          {formatMacro(recipe.nutritionPerServing.carbs)} carbs ·{' '}
          {formatMacro(recipe.nutritionPerServing.protein)} protein ·{' '}
          {formatMacro(recipe.nutritionPerServing.fat)} fat
        </Text>
      </View>
      {recipe.missing.length > 0 ? (
        <View style={styles.missingBox}>
          <Text style={styles.missingTitle}>Missing for this recipe</Text>
          <Text style={styles.missingText}>
            {recipe.missing.map((id) => getIngredientName(id, language)).join(', ')}
          </Text>
        </View>
      ) : null}

      <Text style={styles.heading}>Ingredients for your servings</Text>
      {recipe.ingredients.map((item) => (
        <View key={item.id} style={styles.ingredientLine}>
          <Text style={[styles.bullet, item.missing && styles.missingBullet]}>
            {item.missing ? '!' : '•'}
          </Text>
          <Text style={[styles.line, item.missing && styles.missingIngredient]}>
            {item.label} · {item.missing
              ? `need more · have ${item.availableLabel}`
              : item.selected
                ? `in pantry · ${item.availableLabel}`
                : item.pantryStaple
                  ? 'pantry staple not tracked'
                  : item.required
                    ? `not selected · have ${item.availableLabel}`
                    : `optional · have ${item.availableLabel}`}
          </Text>
        </View>
      ))}

      <Text style={styles.heading}>How to make it</Text>
      {recipe.steps.map((step, stepIndex) => (
        <View key={`${recipe.id}-step-${stepIndex}`} style={styles.stepRow}>
          <Text style={styles.stepNumber}>{stepIndex + 1}</Text>
          <Text style={styles.step}>{step}</Text>
        </View>
      ))}

      <View style={styles.serveBox}>
        <Text style={styles.serveLabel}>GOOD WITH</Text>
        <Text style={styles.serve}>Serve with {formatAccompaniments(recipe.accompaniments)}</Text>
      </View>
      {cooked ? (
        <Text style={styles.cookedMessage}>Cooked — pantry stock has been updated.</Text>
      ) : (
        <>
          <Pressable
            accessibilityRole="button"
            disabled={recipe.missing.length > 0}
            onPress={onCook}
            style={[styles.cookButton, recipe.missing.length > 0 && styles.cookButtonDisabled]}
          >
            <Text style={styles.cookButtonText}>
              {recipe.missing.length > 0 ? 'Add missing stock to cook' : 'Cooked this'}
            </Text>
          </Pressable>
          {recipe.missing.length > 0 ? (
            <Text style={styles.cookHint}>Required ingredients need to be in your pantry before stock can be deducted.</Text>
          ) : null}
        </>
      )}
    </View>
  );
}

export default function ResultsScreen() {
  const { language } = useLanguage();
  const {
    pantry,
    loading: pantryLoading,
    error: pantryError,
    consumeRecipe,
    retryLoad,
  } = usePantry();
  const params = useLocalSearchParams<{
    meals?: string | string[];
    ingredients?: string | string[];
    people?: string | string[];
  }>();
  const meals = parseList(params.meals).filter(isMealType);
  const ingredientIds = parseList(params.ingredients).filter((id) => Boolean(INGREDIENT_BY_ID[id]));
  const parsedPeople = Number(Array.isArray(params.people) ? params.people[0] : params.people);
  const people = Number.isInteger(parsedPeople) ? Math.min(12, Math.max(1, parsedPeople)) : 3;

  const initialDishes = findDishes({ meals, ingredientIds, people, pantry, language });
  const [plannedRecipeIds] = useState(() => initialDishes.map((dish) => dish.id));
  const dishes = findDishes({
    meals,
    ingredientIds,
    people,
    pantry,
    recipeIds: plannedRecipeIds,
    language,
  });
  const weakMatch = hasWeakMatch(dishes);
  const [pendingRecipe, setPendingRecipe] = useState<MatchedRecipe | null>(null);
  const [cookedRecipeIds, setCookedRecipeIds] = useState<string[]>([]);
  const [savingCook, setSavingCook] = useState(false);
  const [cookError, setCookError] = useState<string | null>(null);

  const confirmCooked = async () => {
    if (!pendingRecipe) return;
    setSavingCook(true);
    setCookError(null);
    try {
      await consumeRecipe(pendingRecipe.usage);
      setCookedRecipeIds((current) => [...current, pendingRecipe.id]);
      setPendingRecipe(null);
    } catch (error) {
      setCookError(error instanceof Error ? error.message : 'Pantry stock could not be updated.');
    } finally {
      setSavingCook(false);
    }
  };

  return (
    <>
    <ScrollView contentContainerStyle={styles.content}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Go back to meal planner"
        style={styles.back}
        onPress={() => {
          if (router.canGoBack()) router.back();
          else router.replace('/(tabs)');
        }}
      >
        <Text style={styles.backText}>←  Edit your ingredients</Text>
      </Pressable>
      <LanguagePicker />

      <Text style={styles.title}>Your meal plan</Text>
      <Text style={styles.subtitle}>
        {meals.length > 0 ? meals.join(' · ') : 'Meal'} · {people} {people === 1 ? 'person' : 'people'}
      </Text>

      {weakMatch ? (
        <View style={styles.weakBox}>
          <Text style={styles.weakTitle}>Not many pantry matches yet</Text>
          <Text style={styles.weakText}>
            These are the closest recipes in our catalog. Missing ingredients are highlighted, so you can decide what to add.
          </Text>
        </View>
      ) : (
        <Text style={styles.intro}>Best matches from the recipes in our collection.</Text>
      )}

      {pantryLoading ? (
        <Text style={styles.empty}>Loading pantry stock…</Text>
      ) : null}
      {pantryError ? (
        <View style={styles.pantryError}>
          <Text style={styles.pantryErrorText}>{pantryError}</Text>
          <Pressable accessibilityRole="button" onPress={retryLoad}>
            <Text style={styles.retryText}>Try again</Text>
          </Pressable>
        </View>
      ) : null}
      {!pantryLoading && dishes.length === 0 ? (
        <Text style={styles.empty}>
          We couldn’t find recipes for that meal selection. Go back and choose breakfast, lunch, or dinner.
        </Text>
      ) : null}
      {!pantryLoading ? dishes.map((dish, index) => (
        <RecipeCard
          key={dish.id}
          recipe={dish}
          index={index}
          cooked={cookedRecipeIds.includes(dish.id)}
          onCook={() => setPendingRecipe(dish)}
          language={language}
        />
      )) : null}

      <Pressable
        accessibilityRole="button"
        style={styles.button}
        onPress={() => router.replace('/(tabs)')}
      >
        <Text style={styles.buttonText}>Plan another meal</Text>
      </Pressable>
    </ScrollView>
    <Modal
      visible={pendingRecipe !== null}
      transparent
      animationType="fade"
      onRequestClose={() => {
        if (!savingCook) setPendingRecipe(null);
      }}
    >
      <View style={styles.modalBackdrop}>
        <View style={styles.modalCard}>
          <Text style={styles.modalTitle}>Update your pantry?</Text>
          <Text style={styles.modalSubtitle}>
            Marking {pendingRecipe?.name ?? 'this recipe'} as cooked will use:
          </Text>
          <ScrollView style={styles.modalList}>
            {pendingRecipe ? getRecipeDeductionPreview(pendingRecipe.usage, pantry).map((item) => {
              const ingredientName = getIngredientName(item.ingredientId, language);
              return (
                <Text key={item.ingredientId} style={styles.modalLine}>
                  {ingredientName}: use {formatPantryQuantity(item.quantity, item.unit, item.ingredientId)} ·{' '}
                  {formatPantryQuantity(item.remaining, item.unit, item.ingredientId)} remaining
                </Text>
              );
            }) : null}
          </ScrollView>
          {cookError ? <Text style={styles.modalError}>{cookError}</Text> : null}
          <View style={styles.modalActions}>
            <Pressable
              accessibilityRole="button"
              disabled={savingCook}
              onPress={() => setPendingRecipe(null)}
              style={styles.cancelButton}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              disabled={savingCook || pantryLoading}
              onPress={confirmCooked}
              style={[styles.confirmButton, (savingCook || pantryLoading) && styles.cookButtonDisabled]}
            >
              <Text style={styles.confirmButtonText}>{savingCook ? 'Saving…' : 'Confirm cooked'}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
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
  back: {
    alignSelf: 'flex-start',
    minHeight: 44,
    justifyContent: 'center',
    paddingRight: 12,
  },
  backText: {
    color: '#2D6A4F',
    fontSize: 15,
    fontWeight: '700',
  },
  title: {
    marginTop: 8,
    color: '#7A2E0E',
    fontSize: 30,
    fontWeight: '800',
  },
  subtitle: {
    marginTop: 6,
    color: '#5C4A3A',
    fontSize: 15,
    textTransform: 'capitalize',
  },
  intro: {
    marginTop: 12,
    marginBottom: 16,
    color: '#5C4A3A',
    fontSize: 15,
  },
  weakBox: {
    marginTop: 16,
    marginBottom: 16,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E9BF83',
    backgroundColor: '#FFF1D6',
  },
  weakTitle: {
    color: '#75430C',
    fontSize: 16,
    fontWeight: '800',
  },
  weakText: {
    marginTop: 4,
    color: '#6E542F',
    fontSize: 14,
    lineHeight: 21,
  },
  empty: {
    marginTop: 20,
    color: '#5C4A3A',
    fontSize: 16,
    lineHeight: 24,
  },
  pantryError: {
    marginTop: 12,
    padding: 12,
    borderRadius: 10,
    backgroundColor: '#FFF0EA',
  },
  pantryErrorText: {
    color: '#9A3412',
    fontSize: 14,
  },
  retryText: {
    marginTop: 8,
    color: '#2D6A4F',
    fontWeight: '800',
  },
  card: {
    marginBottom: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E8D5C4',
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
  },
  kicker: {
    color: '#2D6A4F',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1,
  },
  dishName: {
    marginTop: 4,
    color: '#7A2E0E',
    fontSize: 23,
    fontWeight: '800',
  },
  tagsRow: {
    marginTop: 8,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  tag: {
    borderRadius: 999,
    backgroundColor: '#F6E6CF',
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  tagText: {
    color: '#7A2E0E',
    fontSize: 12,
    fontWeight: '700',
  },
  dishNutrition: {
    marginTop: 10,
    padding: 10,
    borderRadius: 8,
    backgroundColor: '#EEF5F0',
  },
  dishNutritionTitle: {
    color: '#2D6A4F',
    fontSize: 12,
    fontWeight: '800',
  },
  dishNutritionValues: {
    marginTop: 3,
    color: '#3D2B1F',
    fontSize: 14,
    lineHeight: 20,
  },
  missingBox: {
    marginTop: 10,
    padding: 10,
    borderRadius: 8,
    backgroundColor: '#FFF0EA',
  },
  missingTitle: {
    color: '#9A3412',
    fontSize: 13,
    fontWeight: '800',
  },
  missingText: {
    marginTop: 2,
    color: '#9A3412',
    fontSize: 14,
  },
  heading: {
    marginTop: 18,
    marginBottom: 8,
    color: '#2D6A4F',
    fontSize: 16,
    fontWeight: '800',
  },
  ingredientLine: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  bullet: {
    width: 14,
    color: '#2D6A4F',
    fontSize: 16,
    fontWeight: '700',
  },
  missingBullet: {
    color: '#B42318',
  },
  line: {
    flex: 1,
    color: '#3D2B1F',
    fontSize: 15,
    lineHeight: 23,
  },
  missingIngredient: {
    color: '#9A3412',
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 9,
  },
  stepNumber: {
    width: 24,
    height: 24,
    overflow: 'hidden',
    borderRadius: 12,
    backgroundColor: '#EAF2ED',
    color: '#2D6A4F',
    textAlign: 'center',
    lineHeight: 24,
    fontSize: 13,
    fontWeight: '800',
  },
  step: {
    flex: 1,
    color: '#3D2B1F',
    fontSize: 15,
    lineHeight: 23,
  },
  serveBox: {
    marginTop: 12,
    padding: 12,
    borderRadius: 10,
    backgroundColor: '#FDF1E8',
  },
  serveLabel: {
    color: '#8C431C',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
  },
  serve: {
    marginTop: 3,
    color: '#8C431C',
    fontSize: 15,
    fontWeight: '700',
  },
  cookButton: {
    minHeight: 48,
    marginTop: 14,
    borderRadius: 12,
    backgroundColor: '#2D6A4F',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cookButtonDisabled: {
    backgroundColor: '#9BB8A9',
  },
  cookButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  cookHint: {
    marginTop: 6,
    color: '#9A3412',
    fontSize: 13,
    lineHeight: 18,
  },
  cookedMessage: {
    marginTop: 14,
    padding: 12,
    borderRadius: 10,
    backgroundColor: '#EAF2ED',
    color: '#2D6A4F',
    fontSize: 14,
    fontWeight: '800',
  },
  modalBackdrop: {
    flex: 1,
    padding: 20,
    backgroundColor: 'rgba(25, 20, 15, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCard: {
    width: '100%',
    maxWidth: 480,
    maxHeight: '80%',
    padding: 20,
    borderRadius: 18,
    backgroundColor: '#FFF8F0',
  },
  modalTitle: {
    color: '#7A2E0E',
    fontSize: 22,
    fontWeight: '800',
  },
  modalSubtitle: {
    marginTop: 8,
    color: '#5C4A3A',
    fontSize: 15,
    lineHeight: 22,
  },
  modalList: {
    marginTop: 12,
    marginBottom: 12,
  },
  modalLine: {
    paddingVertical: 6,
    color: '#3D2B1F',
    fontSize: 14,
    lineHeight: 20,
  },
  modalError: {
    marginBottom: 8,
    color: '#9A3412',
    fontSize: 14,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
  },
  cancelButton: {
    minHeight: 44,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: '#EDE2D7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButtonText: {
    color: '#3D2B1F',
    fontSize: 14,
    fontWeight: '700',
  },
  confirmButton: {
    minHeight: 44,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: '#2D6A4F',
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  button: {
    minHeight: 54,
    marginTop: 4,
    borderRadius: 14,
    backgroundColor: '#2D6A4F',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
});
