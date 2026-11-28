import { useMemo, useRef, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type ScrollViewInstance,
  type TextInputInstance,
} from 'react-native';
import { router } from 'expo-router';
import { CATEGORIES, INGREDIENTS } from '../../data/ingredients';
import {
  getCategoryName,
  getIngredientName,
  getIngredientSearchNames,
} from '../../data/ingredientTranslations';
import type { Ingredient, IngredientCategory } from '../../data/ingredients';
import type { MealType } from '../../data/recipes';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { usePantry } from '../../context/PantryContext';
import { useProfile } from '../../context/ProfileContext';
import { formatPantryAmount, getPantryUnit } from '../../lib/pantry';
import { getConflictingAllergies } from '../../lib/allergies';
import { LanguagePicker } from '../../components/LanguagePicker';

const MEALS: { id: MealType; label: string }[] = [
  { id: 'breakfast', label: 'Breakfast' },
  { id: 'lunch', label: 'Lunch' },
  { id: 'dinner', label: 'Dinner' },
];

type PlanningWarning = {
  title: string;
  message: string;
  canContinue: boolean;
};

function Chip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[styles.chip, selected && styles.chipSelected]}
    >
      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{label}</Text>
    </Pressable>
  );
}

export default function PlanScreen() {
  const { guest, signOut, prepareGuestAccountSignup } = useAuth();
  const { language } = useLanguage();
  const { preferences, loading: profileLoading, error: profileError } = useProfile();
  const {
    pantry,
    loading: pantryLoading,
    error: pantryError,
    addStock,
    retryLoad,
  } = usePantry();
  const [meals, setMeals] = useState<MealType[]>(['breakfast']);
  const [selectedIngredients, setSelectedIngredients] = useState<string[] | null>(null);
  const [people, setPeople] = useState(3);
  const [ingredientSearch, setIngredientSearch] = useState('');
  const [ingredientToAdd, setIngredientToAdd] = useState<Ingredient | null>(null);
  const [stockAmount, setStockAmount] = useState('1');
  const [stockError, setStockError] = useState<string | null>(null);
  const [accountError, setAccountError] = useState<string | null>(null);
  const [savingStock, setSavingStock] = useState(false);
  const [planningWarning, setPlanningWarning] = useState<PlanningWarning | null>(null);
  const [tourStep, setTourStep] = useState<number | null>(null);
  const [ingredientSectionY, setIngredientSectionY] = useState(0);
  const [peopleSectionY, setPeopleSectionY] = useState(0);
  const [findDishesY, setFindDishesY] = useState(0);
  const scrollViewRef = useRef<ScrollViewInstance>(null);
  const ingredientSearchRef = useRef<TextInputInstance>(null);
  const pantryById = useMemo(
    () => new Map(pantry.map((item) => [item.ingredientId, item])),
    [pantry],
  );
  const pantryIngredientIds = pantry.map((item) => item.ingredientId);

  const goToLogin = async () => {
    setAccountError(null);
    try {
      if (guest) {
        await prepareGuestAccountSignup();
      } else {
        await signOut();
      }
    } catch (accountError) {
      setAccountError(
        accountError instanceof Error ? accountError.message : 'Could not go to the login page.',
      );
    }
  };

  const byCategory = useMemo(() => {
    const groups: Record<IngredientCategory, typeof INGREDIENTS> = {
      vegetables: [],
      fruits: [],
      grains_flours: [],
      pulses_dals: [],
      spices: [],
      oils: [],
      spices_nuts: [],
      other_ingredients: [],
      dairy_products: [],
      meat: [],
    };
    const query = ingredientSearch.trim().toLocaleLowerCase();
    for (const ingredient of INGREDIENTS) {
      if ((pantryById.has(ingredient.id) || query.length > 0) &&
          (!query || getIngredientSearchNames(ingredient.id, language).some((name) =>
            name.toLocaleLowerCase().includes(query),
          ))) {
        groups[ingredient.category].push(ingredient);
      }
    }
    return groups;
  }, [ingredientSearch, language, pantryById]);

  const toggleMeal = (id: MealType) => {
    setMeals((current) =>
      current.includes(id) ? current.filter((meal) => meal !== id) : [...current, id],
    );
  };

  const toggleIngredient = (id: string) => {
    setSelectedIngredients((current) => {
      const selected = current ?? pantryIngredientIds;
      return selected.includes(id)
        ? selected.filter((item) => item !== id)
        : [...selected, id];
    });
  };

  const openResults = () => {
    const ingredientsToUse = (selectedIngredients ?? pantryIngredientIds)
      .filter((ingredientId) => pantryById.has(ingredientId));
    router.push({
      pathname: '/results',
      params: {
        meals: meals.join(','),
        ingredients: ingredientsToUse.join(','),
        people: String(people),
      },
    });
  };

  const findDishes = () => {
    const selectedIds = selectedIngredients ?? pantryIngredientIds;
    const ingredientsToUse = selectedIds.filter((ingredientId) => pantryById.has(ingredientId));

    if (ingredientsToUse.length === 0) {
      setPlanningWarning({
        title: 'Ingredients needed',
        message: 'Please select ingredients before finding dishes, or add ingredients to your pantry.',
        canContinue: false,
      });
      return;
    }

    const conflictingAllergies = getConflictingAllergies(selectedIds, preferences.allergies);

    if (profileError) {
      setPlanningWarning({
        title: 'Profile preferences unavailable',
        message: 'Saved allergy preferences could not be verified. Review and save your preferences before planning.',
        canContinue: false,
      });
      return;
    }

    if (conflictingAllergies.length > 0) {
      setPlanningWarning({
        title: 'Allergy warning',
        message: `Your profile lists an allergy to ${conflictingAllergies.join(', ')}. Recipes containing those ingredients will be hidden.`,
        canContinue: true,
      });
      return;
    }

    openResults();
  };

  const openQuickGuide = () => {
    setTourStep(0);
    scrollViewRef.current?.scrollTo({
      y: Math.max(0, ingredientSectionY - 16),
      animated: true,
    });
    setTimeout(() => ingredientSearchRef.current?.focus(), 350);
  };

  const moveTourToStep = (step: number) => {
    setTourStep(step);
    const targetY = step === 0
      ? ingredientSectionY
      : step === 1
        ? peopleSectionY
        : findDishesY;
    scrollViewRef.current?.scrollTo({ y: Math.max(0, targetY - 16), animated: true });
  };

  const previousTourStep = () => {
    if (tourStep === null || tourStep === 0) return;
    moveTourToStep(tourStep - 1);
  };

  const nextTourStep = () => {
    if (tourStep === null) return;
    if (tourStep === 2) {
      setTourStep(null);
      return;
    }
    moveTourToStep(tourStep + 1);
  };

  const addSearchIngredientToStock = async () => {
    if (!ingredientToAdd) return;
    const quantity = Number(stockAmount);
    if (!Number.isFinite(quantity) || quantity <= 0) {
      setStockError('Enter an amount greater than zero.');
      return;
    }

    setSavingStock(true);
    setStockError(null);
    try {
      await addStock(ingredientToAdd.id, quantity);
      setSelectedIngredients((current) =>
        current === null || current.includes(ingredientToAdd.id)
          ? current
          : [...current, ingredientToAdd.id],
      );
      setIngredientToAdd(null);
      setStockAmount('1');
    } catch (saveError) {
      setStockError(
        saveError instanceof Error ? saveError.message : 'Pantry stock could not be saved.',
      );
    } finally {
      setSavingStock(false);
    }
  };

  return (
    <>
    <ScrollView
      ref={scrollViewRef}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.hero}>
        <View style={styles.heroTopRow}>
          <Text style={styles.eyebrow}>YOUR PANTRY, YOUR PLAN</Text>
          <View style={styles.headerActions}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Open quick guide"
              onPress={openQuickGuide}
              style={styles.quickGuideButton}
            >
              <Text style={styles.quickGuideButtonText}>Quick guide</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Go to login"
              onPress={goToLogin}
              style={styles.loginButton}
            >
              <Text style={styles.loginButtonText}>Login</Text>
            </Pressable>
          </View>
        </View>
        <Text style={styles.title}>What shall we cook?</Text>
        <Text style={styles.subtitle}>
          Choose a meal and ingredients. We’ll find real recipes from our South Indian collection.
        </Text>
        {accountError ? <Text style={styles.errorText}>{accountError}</Text> : null}
      </View>
      <LanguagePicker />

      <View>
        <Text style={styles.section}>1. Choose a meal</Text>
        <View style={styles.row}>
          {MEALS.map((meal) => (
            <Chip
              key={meal.id}
              label={meal.label}
              selected={meals.includes(meal.id)}
              onPress={() => toggleMeal(meal.id)}
            />
          ))}
        </View>
      </View>

      <View
        onLayout={(event) => setIngredientSectionY(event.nativeEvent.layout.y)}
        style={tourStep === 0 ? styles.tourHighlight : undefined}
      >
      <Text style={styles.section}>2. What ingredients do you have?</Text>
      {pantryLoading ? (
        <Text style={styles.noSearchResults}>Loading your pantry…</Text>
      ) : pantryError ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{pantryError}</Text>
          <Pressable accessibilityRole="button" onPress={retryLoad}>
            <Text style={styles.managePantryText}>Try again</Text>
          </Pressable>
        </View>
      ) : pantry.length === 0 ? (
        <View style={styles.pantryPrompt}>
          <Text style={styles.noSearchResults}>Your pantry is empty. Add ingredients to get started.</Text>
          <Pressable
            accessibilityRole="button"
            style={styles.managePantryButton}
            onPress={() => router.push('/(tabs)/pantry')}
          >
            <Text style={styles.managePantryText}>Open pantry</Text>
          </Pressable>
        </View>
      ) : null}
      <View style={styles.searchBox}>
        <Text style={styles.searchIcon}>⌕</Text>
        <TextInput
          ref={ingredientSearchRef}
          accessibilityLabel="Search ingredients"
          placeholder="Search ingredients"
          placeholderTextColor="#7A6B5E"
          returnKeyType="search"
          value={ingredientSearch}
          onChangeText={(text) => {
            setIngredientSearch(text);
            setIngredientToAdd(null);
            setStockError(null);
          }}
          style={styles.searchInput}
        />
        {ingredientSearch.length > 0 ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Clear ingredient search"
            hitSlop={8}
            onPress={() => {
              setIngredientSearch('');
              setIngredientToAdd(null);
              setStockError(null);
            }}
            style={styles.clearSearch}
          >
            <Text style={styles.clearSearchText}>×</Text>
          </Pressable>
        ) : null}
      </View>
      {ingredientToAdd ? (
        <View style={styles.stockAddCard}>
          <View style={styles.stockAddHeading}>
            <Text style={styles.stockAddTitle}>
              Add {getIngredientName(ingredientToAdd.id, language)}
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Cancel adding ${getIngredientName(ingredientToAdd.id, language)}`}
              onPress={() => {
                setIngredientToAdd(null);
                setStockError(null);
              }}
              style={styles.stockAddCancel}
            >
              <Text style={styles.stockAddCancelText}>Cancel</Text>
            </Pressable>
          </View>
          <Text style={styles.stockAddLabel}>
            Amount ({getPantryUnit(ingredientToAdd.id)})
          </Text>
          <View style={styles.stockAddRow}>
            <TextInput
              accessibilityLabel={`Amount of ${getIngredientName(ingredientToAdd.id, language)} in ${getPantryUnit(ingredientToAdd.id)}`}
              keyboardType="decimal-pad"
              editable={!savingStock}
              value={stockAmount}
              onChangeText={setStockAmount}
              style={styles.stockAddInput}
            />
            <Pressable
              accessibilityRole="button"
              disabled={savingStock || pantryLoading || Boolean(pantryError)}
              onPress={addSearchIngredientToStock}
              style={[
                styles.stockAddButton,
                (savingStock || pantryLoading || Boolean(pantryError)) && styles.stockAddButtonDisabled,
              ]}
            >
              <Text style={styles.stockAddButtonText}>
                {savingStock ? 'Saving…' : 'Add stock'}
              </Text>
            </Pressable>
          </View>
          {stockError ? <Text style={styles.stockAddError}>{stockError}</Text> : null}
        </View>
      ) : null}
      {CATEGORIES.map((category) => (
        byCategory[category.id].length > 0 ? (
          <View key={category.id} style={styles.categoryBlock}>
            <Text style={styles.category}>{getCategoryName(category.id, language)}</Text>
            <View style={styles.row}>
              {byCategory[category.id].map((ingredient) => {
                const stock = pantryById.get(ingredient.id);
                return (
                  <Chip
                    key={ingredient.id}
                    label={stock
                      ? `${getIngredientName(ingredient.id, language)} - ${formatPantryAmount(
                        stock.quantity,
                        stock.unit,
                      )}`
                      : `${getIngredientName(ingredient.id, language)} · add to pantry`}
                    selected={Boolean(stock) && (
                      selectedIngredients === null ||
                      selectedIngredients.includes(ingredient.id)
                    )}
                    onPress={() => {
                      if (stock) {
                        toggleIngredient(ingredient.id);
                      } else {
                        setIngredientToAdd(ingredient);
                        setStockAmount('1');
                        setStockError(null);
                      }
                    }}
                  />
                );
              })}
            </View>
          </View>
        ) : null
      ))}
      {Object.values(byCategory).every((ingredients) => ingredients.length === 0) ? (
        <Text style={styles.noSearchResults}>
          {ingredientSearch.trim().length > 0
            ? 'No ingredients found. Try another name.'
            : pantry.length === 0
            ? 'Add ingredients in Pantry to plan with your stock.'
            : 'No pantry ingredients found. Try another name.'}
        </Text>
      ) : null}
      </View>

      <View
        onLayout={(event) => setPeopleSectionY(event.nativeEvent.layout.y)}
        style={tourStep === 1 ? styles.tourHighlight : undefined}
      >
      <Text style={styles.section}>3. How many people?</Text>
      <View style={styles.peopleRow}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Decrease number of people"
          accessibilityState={{ disabled: people <= 1 }}
          disabled={people <= 1}
          style={[styles.stepper, people <= 1 && styles.stepperDisabled]}
          onPress={() => setPeople((value) => Math.max(1, value - 1))}
        >
          <Text style={styles.stepperText}>−</Text>
        </Pressable>
        <Text accessibilityLiveRegion="polite" style={styles.peopleCount}>{people}</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Increase number of people"
          accessibilityState={{ disabled: people >= 12 }}
          disabled={people >= 12}
          style={[styles.stepper, people >= 12 && styles.stepperDisabled]}
          onPress={() => setPeople((value) => Math.min(12, value + 1))}
        >
          <Text style={styles.stepperText}>+</Text>
        </Pressable>
        <Text style={styles.peopleLabel}>{people === 1 ? 'person' : 'people'}</Text>
      </View>
      </View>

      <View
        onLayout={(event) => setFindDishesY(event.nativeEvent.layout.y)}
        style={tourStep === 2 ? styles.tourHighlight : undefined}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Find dishes"
          disabled={meals.length === 0 || pantryLoading || profileLoading || Boolean(pantryError)}
          style={[styles.button, (meals.length === 0 || pantryLoading || profileLoading || Boolean(pantryError)) && styles.buttonDisabled]}
          onPress={findDishes}
        >
          <Text style={styles.buttonText}>Find dishes</Text>
          <Text style={styles.buttonArrow}>→</Text>
        </Pressable>
      </View>
      <Text style={styles.note}>No AI-generated recipes. Just pantry matches and clear steps.</Text>
    </ScrollView>
    <Modal
      visible={planningWarning !== null}
      transparent
      animationType="fade"
      onRequestClose={() => setPlanningWarning(null)}
    >
      <View style={styles.warningBackdrop}>
        <View style={styles.warningCard}>
          <Text style={styles.warningTitle}>{planningWarning?.title}</Text>
          <Text style={styles.warningMessage}>{planningWarning?.message}</Text>
          <View style={styles.warningActions}>
            {planningWarning?.canContinue ? (
              <Pressable
                accessibilityRole="button"
                onPress={() => setPlanningWarning(null)}
                style={styles.warningCancelButton}
              >
                <Text style={styles.warningCancelText}>Go back</Text>
              </Pressable>
            ) : null}
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                const canContinue = planningWarning?.canContinue;
                setPlanningWarning(null);
                if (canContinue) openResults();
              }}
              style={styles.warningContinueButton}
            >
              <Text style={styles.warningContinueText}>
                {planningWarning?.canContinue ? 'Show safe dishes' : 'OK'}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
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
            ? 'Type your ingredients'
            : tourStep === 1
              ? 'Set the number of people'
              : 'Find your dishes'}
        </Text>
        <Text style={styles.tourTipMessage}>
          {tourStep === 0
            ? 'Type an ingredient in the search bar, then select it to add it to this plan.'
            : tourStep === 1
              ? 'Use the minus and plus buttons to choose how many people you are cooking for.'
              : 'Tap “Find dishes” to see matching South Indian recipes.'}
        </Text>
        <View style={styles.tourTipActions}>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ disabled: tourStep === 0 }}
            disabled={tourStep === 0}
            onPress={previousTourStep}
            style={[styles.tourTipPrevButton, tourStep === 0 && styles.tourTipPrevButtonDisabled]}
          >
            <Text style={styles.tourTipPrevButtonText}>Prev</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={nextTourStep}
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
    paddingTop: 16,
    paddingBottom: 8,
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  eyebrow: {
    color: '#C45C26',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.4,
  },
  loginButton: {
    minHeight: 44,
    minWidth: 76,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: '#C45C26',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loginButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  title: {
    marginTop: 8,
    fontSize: 30,
    lineHeight: 36,
    fontWeight: '800',
    color: '#7A2E0E',
  },
  subtitle: {
    marginTop: 8,
    fontSize: 16,
    lineHeight: 24,
    color: '#5C4A3A',
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
  section: {
    marginTop: 24,
    marginBottom: 12,
    fontSize: 18,
    fontWeight: '700',
    color: '#2D6A4F',
  },
  categoryBlock: {
    marginBottom: 14,
  },
  category: {
    marginBottom: 8,
    fontSize: 14,
    fontWeight: '700',
    color: '#7A2E0E',
  },
  searchBox: {
    minHeight: 50,
    marginBottom: 16,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#D8C4B1',
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
  },
  searchIcon: {
    marginRight: 10,
    color: '#7A6B5E',
    fontSize: 24,
  },
  searchInput: {
    flex: 1,
    minHeight: 48,
    paddingVertical: 8,
    color: '#3D2B1F',
    fontSize: 16,
  },
  stockAddCard: {
    marginBottom: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E8D5C4',
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
  },
  stockAddHeading: {
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  stockAddTitle: {
    color: '#7A2E0E',
    fontSize: 16,
    fontWeight: '800',
  },
  stockAddCancel: {
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  stockAddCancelText: {
    color: '#7A6B5E',
    fontSize: 14,
    fontWeight: '700',
  },
  stockAddLabel: {
    marginBottom: 5,
    color: '#5C4A3A',
    fontSize: 13,
    fontWeight: '700',
  },
  stockAddRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  stockAddInput: {
    minHeight: 48,
    flex: 1,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#D8C4B1',
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    color: '#3D2B1F',
    fontSize: 16,
  },
  stockAddButton: {
    minHeight: 48,
    paddingHorizontal: 16,
    borderRadius: 10,
    backgroundColor: '#C45C26',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stockAddButtonDisabled: {
    opacity: 0.55,
  },
  stockAddButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  stockAddError: {
    marginTop: 8,
    color: '#9A3412',
    fontSize: 14,
  },
  clearSearch: {
    width: 32,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clearSearchText: {
    color: '#7A6B5E',
    fontSize: 24,
  },
  noSearchResults: {
    marginBottom: 16,
    color: '#7A6B5E',
    fontSize: 15,
  },
  pantryPrompt: {
    marginBottom: 10,
    padding: 14,
    borderRadius: 12,
    backgroundColor: '#EAF2ED',
  },
  managePantryButton: {
    alignSelf: 'flex-start',
    paddingVertical: 8,
  },
  managePantryText: {
    color: '#2D6A4F',
    fontSize: 14,
    fontWeight: '800',
  },
  errorBox: {
    marginBottom: 12,
    padding: 12,
    borderRadius: 10,
    backgroundColor: '#FFF0EA',
  },
  errorText: {
    marginBottom: 6,
    color: '#9A3412',
    fontSize: 14,
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    minHeight: 42,
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E0CDB8',
    backgroundColor: '#FFFFFF',
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderRadius: 22,
  },
  chipSelected: {
    backgroundColor: '#C45C26',
    borderColor: '#C45C26',
  },
  chipText: {
    color: '#3D2B1F',
    fontSize: 15,
  },
  chipTextSelected: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  peopleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  stepper: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#2D6A4F',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperDisabled: {
    backgroundColor: '#9BB8A9',
  },
  stepperText: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '700',
  },
  peopleCount: {
    minWidth: 24,
    textAlign: 'center',
    color: '#7A2E0E',
    fontSize: 24,
    fontWeight: '800',
  },
  peopleLabel: {
    color: '#5C4A3A',
    fontSize: 16,
  },
  button: {
    minHeight: 56,
    marginTop: 28,
    borderRadius: 14,
    backgroundColor: '#C45C26',
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  buttonDisabled: {
    backgroundColor: '#D9B8A4',
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '800',
  },
  buttonArrow: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '700',
  },
  note: {
    marginTop: 14,
    color: '#7A6B5E',
    fontSize: 13,
    textAlign: 'center',
  },
  warningBackdrop: {
    flex: 1,
    padding: 20,
    backgroundColor: 'rgba(25, 20, 15, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  warningCard: {
    width: '100%',
    maxWidth: 440,
    padding: 20,
    borderRadius: 18,
    backgroundColor: '#FFF8F0',
  },
  warningTitle: {
    color: '#7A2E0E',
    fontSize: 22,
    fontWeight: '800',
  },
  warningMessage: {
    marginTop: 8,
    color: '#5C4A3A',
    fontSize: 15,
    lineHeight: 22,
  },
  warningActions: {
    marginTop: 18,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
    gap: 10,
  },
  warningCancelButton: {
    minHeight: 46,
    paddingHorizontal: 16,
    borderRadius: 10,
    backgroundColor: '#EDE2D7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  warningCancelText: {
    color: '#3D2B1F',
    fontSize: 14,
    fontWeight: '700',
  },
  warningContinueButton: {
    minHeight: 46,
    paddingHorizontal: 16,
    borderRadius: 10,
    backgroundColor: '#2D6A4F',
    alignItems: 'center',
    justifyContent: 'center',
  },
  warningContinueText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
});
