import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { CATEGORIES, INGREDIENTS } from '../../data/ingredients';
import type { Ingredient, IngredientCategory } from '../../data/ingredients';
import type { MealType } from '../../data/recipes';
import { useAuth } from '../../context/AuthContext';
import { usePantry } from '../../context/PantryContext';
import { formatPantryQuantity, getPantryUnit } from '../../lib/pantry';

const MEALS: { id: MealType; label: string }[] = [
  { id: 'breakfast', label: 'Breakfast' },
  { id: 'lunch', label: 'Lunch' },
  { id: 'dinner', label: 'Dinner' },
];

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
          (!query || ingredient.name.toLocaleLowerCase().includes(query))) {
        groups[ingredient.category].push(ingredient);
      }
    }
    return groups;
  }, [ingredientSearch, pantryById]);

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

  const findDishes = () => {
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
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <View style={styles.hero}>
        <View style={styles.heroTopRow}>
          <Text style={styles.eyebrow}>YOUR PANTRY, YOUR PLAN</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Go to login"
            onPress={goToLogin}
            style={styles.loginButton}
          >
            <Text style={styles.loginButtonText}>Login</Text>
          </Pressable>
        </View>
        <Text style={styles.title}>What shall we cook?</Text>
        <Text style={styles.subtitle}>
          Choose a meal and ingredients. We’ll find real recipes from our South Indian collection.
        </Text>
        {accountError ? <Text style={styles.errorText}>{accountError}</Text> : null}
      </View>

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
            <Text style={styles.stockAddTitle}>Add {ingredientToAdd.name}</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Cancel adding ${ingredientToAdd.name}`}
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
              accessibilityLabel={`Amount of ${ingredientToAdd.name} in ${getPantryUnit(ingredientToAdd.id)}`}
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
            <Text style={styles.category}>{category.label}</Text>
            <View style={styles.row}>
              {byCategory[category.id].map((ingredient) => {
                const stock = pantryById.get(ingredient.id);
                return (
                  <Chip
                    key={ingredient.id}
                    label={stock
                      ? `${ingredient.name} · ${formatPantryQuantity(
                        stock.quantity,
                        stock.unit,
                        ingredient.id,
                      )}`
                      : `${ingredient.name} · add to pantry`}
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

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Find dishes"
        disabled={meals.length === 0 || pantryLoading || Boolean(pantryError)}
        style={[styles.button, (meals.length === 0 || pantryLoading || Boolean(pantryError)) && styles.buttonDisabled]}
        onPress={findDishes}
      >
        <Text style={styles.buttonText}>Find dishes</Text>
        <Text style={styles.buttonArrow}>→</Text>
      </Pressable>
      <Text style={styles.note}>No AI-generated recipes. Just pantry matches and clear steps.</Text>
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
    paddingTop: 16,
    paddingBottom: 8,
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
});
