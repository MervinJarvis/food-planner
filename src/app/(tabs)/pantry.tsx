import { useMemo, useRef, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type ScrollViewInstance,
} from 'react-native';
import { CATEGORIES, INGREDIENTS } from '../../data/ingredients';
import {
  getCategoryName,
  getIngredientName,
  getIngredientSearchNames,
} from '../../data/ingredientTranslations';
import type { Ingredient } from '../../data/ingredients';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { usePantry } from '../../context/PantryContext';
import { formatPantryQuantity, getPantryUnit } from '../../lib/pantry';
import { LanguagePicker } from '../../components/LanguagePicker';

function QuantityButton({
  label,
  accessibilityLabel,
  onPress,
  disabled = false,
}: {
  label: string;
  accessibilityLabel: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={[styles.quantityButton, disabled && styles.quantityButtonDisabled]}
    >
      <Text style={styles.quantityButtonText}>{label}</Text>
    </Pressable>
  );
}

export default function PantryScreen() {
  const { language } = useLanguage();
  const {
    guest,
    signOut,
    prepareGuestAccountSignup,
  } = useAuth();
  const {
    pantry,
    loading,
    error,
    addStock,
    setStock,
    removeStock,
    retryLoad,
  } = usePantry();
  const [search, setSearch] = useState('');
  const [selectedIngredient, setSelectedIngredient] = useState<Ingredient | null>(null);
  const [amount, setAmount] = useState('1');
  const [actionError, setActionError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [tourStep, setTourStep] = useState<number | null>(null);
  const [addSectionY, setAddSectionY] = useState(0);
  const [stockSectionY, setStockSectionY] = useState(0);
  const scrollViewRef = useRef<ScrollViewInstance>(null);

  const openQuickGuide = () => {
    setTourStep(0);
    scrollViewRef.current?.scrollTo({ y: Math.max(0, addSectionY - 16), animated: true });
  };

  const advanceTour = () => {
    if (tourStep === null) return;
    if (tourStep < 2) {
      const nextStep = tourStep + 1;
      setTourStep(nextStep);
      const nextY = nextStep === 2 ? stockSectionY : addSectionY;
      scrollViewRef.current?.scrollTo({ y: Math.max(0, nextY - 16), animated: true });
    } else {
      setTourStep(null);
    }
  };

  const previousTour = () => {
    if (tourStep === null || tourStep === 0) return;
    const previousStep = tourStep - 1;
    setTourStep(previousStep);
    const previousY = previousStep === 2 ? stockSectionY : addSectionY;
    scrollViewRef.current?.scrollTo({ y: Math.max(0, previousY - 16), animated: true });
  };

  const handleAccountAction = async (action: () => Promise<void>) => {
    setActionError(null);
    try {
      await action();
    } catch (actionFailure) {
      setActionError(
        actionFailure instanceof Error ? actionFailure.message : 'Account action could not be completed.',
      );
    }
  };

  const matches = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    return INGREDIENTS.filter((ingredient) =>
      getIngredientSearchNames(ingredient.id, language).some((name) =>
        name.toLocaleLowerCase().includes(query),
      ),
    ).slice(0, 8);
  }, [language, search]);

  const pantryByCategory = useMemo(() => {
    const stockById = new Map(pantry.map((item) => [item.ingredientId, item]));
    return CATEGORIES.map((category) => ({
      category,
      items: INGREDIENTS.flatMap((ingredient) => {
        if (ingredient.category !== category.id) return [];
        const stock = stockById.get(ingredient.id);
        return stock ? [{ ingredient, stock }] : [];
      }),
    })).filter((group) => group.items.length > 0);
  }, [pantry]);

  const addIngredient = async () => {
    if (!selectedIngredient) {
      setActionError('Choose an ingredient to add.');
      return;
    }
    const quantity = Number(amount);
    if (!Number.isFinite(quantity) || quantity <= 0) {
      setActionError('Enter an amount greater than zero.');
      return;
    }

    setSaving(true);
    setActionError(null);
    try {
      await addStock(selectedIngredient.id, quantity);
      setSelectedIngredient(null);
      setSearch('');
      setAmount('1');
    } catch (saveError) {
      setActionError(saveError instanceof Error ? saveError.message : 'Pantry stock could not be saved.');
    } finally {
      setSaving(false);
    }
  };

  const adjustStock = async (ingredientId: string, quantity: number) => {
    setActionError(null);
    try {
      await setStock(ingredientId, quantity);
    } catch (saveError) {
      setActionError(saveError instanceof Error ? saveError.message : 'Pantry stock could not be saved.');
    }
  };

  const deleteStock = async (ingredientId: string) => {
    setActionError(null);
    try {
      await removeStock(ingredientId);
    } catch (saveError) {
      setActionError(saveError instanceof Error ? saveError.message : 'Pantry item could not be removed.');
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
          <Text style={styles.eyebrow}>YOUR KITCHEN STOCK</Text>
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
              onPress={() => handleAccountAction(
                guest ? prepareGuestAccountSignup : signOut,
              )}
              style={styles.loginButton}
            >
              <Text style={styles.loginButtonText}>Login</Text>
            </Pressable>
          </View>
        </View>
        <Text style={styles.title}>Pantry</Text>
        <Text style={styles.subtitle}>
          Keep track of what you have. Cooking a recipe will subtract its ingredients from here.
        </Text>
        {guest ? (
          <Text style={styles.guestNotice}>Guest mode · saved only on this device</Text>
        ) : null}
      </View>
      <LanguagePicker />

      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
          <Pressable accessibilityRole="button" onPress={retryLoad}>
            <Text style={styles.retryText}>Try loading again</Text>
          </Pressable>
        </View>
      ) : null}
      {actionError ? <Text style={styles.actionError}>{actionError}</Text> : null}

      <View
        onLayout={(event) => setAddSectionY(event.nativeEvent.layout.y)}
        style={tourStep === 0 || tourStep === 1 ? styles.tourHighlight : undefined}
      >
      <Text style={styles.section}>Add ingredients</Text>
      <TextInput
        accessibilityLabel="Search pantry ingredients"
        placeholder="Search ingredients"
        placeholderTextColor="#7A6B5E"
        value={search}
        onChangeText={(text) => {
          setSearch(text);
          setSelectedIngredient(null);
        }}
        style={styles.input}
      />
      {search.trim().length > 0 && !selectedIngredient ? (
        <View style={styles.suggestions}>
          {matches.length > 0 ? matches.map((ingredient) => (
            <Pressable
              key={ingredient.id}
              accessibilityRole="button"
              onPress={() => {
                setSelectedIngredient(ingredient);
              setSearch(getIngredientName(ingredient.id, language));
              }}
              style={styles.suggestion}
            >
              <Text style={styles.suggestionText}>{getIngredientName(ingredient.id, language)}</Text>
              <Text style={styles.suggestionUnit}>{getPantryUnit(ingredient.id)}</Text>
            </Pressable>
          )) : (
            <Text style={styles.noMatches}>No ingredients found.</Text>
          )}
        </View>
      ) : null}

      {selectedIngredient ? (
        <View style={styles.addRow}>
          <View style={styles.amountField}>
            <Text style={styles.fieldLabel}>Amount ({getPantryUnit(selectedIngredient.id)})</Text>
            <TextInput
              accessibilityLabel={`Amount in ${getPantryUnit(selectedIngredient.id)}`}
              keyboardType="decimal-pad"
              value={amount}
              onChangeText={setAmount}
              style={styles.amountInput}
            />
          </View>
          <Pressable
            accessibilityRole="button"
            disabled={saving || loading || Boolean(error)}
            onPress={addIngredient}
            style={[styles.addButton, (saving || loading || Boolean(error)) && styles.buttonDisabled]}
          >
            <Text style={styles.addButtonText}>{saving ? 'Saving…' : 'Add stock'}</Text>
          </Pressable>
        </View>
      ) : null}
      </View>

      <View
        onLayout={(event) => setStockSectionY(event.nativeEvent.layout.y)}
        style={[styles.inventoryHeading, tourStep === 2 && styles.tourHighlight]}
      >
        <Text style={styles.section}>Your stock</Text>
        <Text style={styles.itemCount}>{pantry.length} {pantry.length === 1 ? 'item' : 'items'}</Text>
      </View>
      {loading ? (
        <Text style={styles.empty}>Loading your saved pantry…</Text>
      ) : pantry.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>Nothing in your pantry yet</Text>
          <Text style={styles.empty}>Search above to add your first ingredient.</Text>
        </View>
      ) : pantryByCategory.map(({ category, items }) => (
        <View key={category.id} style={styles.categoryBlock}>
          <Text style={styles.category}>{getCategoryName(category.id, language)}</Text>
          {items.map(({ ingredient, stock }) => {
            const step = stock.unit === 'piece' || stock.unit === 'clove' || stock.unit === 'leaf'
              ? 1
              : stock.unit === 'g'
                ? 100
                : stock.unit === 'kg'
                  ? 0.1
                  : stock.unit === 'oz'
                    ? 0.25
                    : 0.5;

            return (
              <View key={stock.ingredientId} style={styles.stockCard}>
                <View style={styles.stockInfo}>
                  <Text style={styles.stockName}>{getIngredientName(ingredient.id, language)}</Text>
                  <Text style={styles.stockAmount}>
                    {formatPantryQuantity(stock.quantity, stock.unit, stock.ingredientId)}
                  </Text>
                </View>
                <View style={styles.stockActions}>
                  <QuantityButton
                    label="−"
                    accessibilityLabel={`Remove ${step} ${stock.unit} of ${getIngredientName(ingredient.id, language)}`}
                    disabled={stock.quantity < step}
                    onPress={() => adjustStock(
                      stock.ingredientId,
                      Math.max(0, stock.quantity - step),
                    )}
                  />
                  <QuantityButton
                    label="+"
                    accessibilityLabel={`Add ${step} ${stock.unit} of ${getIngredientName(ingredient.id, language)}`}
                    onPress={() => adjustStock(stock.ingredientId, stock.quantity + step)}
                  />
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Remove ${getIngredientName(ingredient.id, language)} from pantry`}
                    onPress={() => deleteStock(stock.ingredientId)}
                    style={styles.removeButton}
                  >
                    <Text style={styles.removeText}>Remove</Text>
                  </Pressable>
                </View>
              </View>
            );
          })}
        </View>
      ))}
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
            ? 'Find an ingredient'
            : tourStep === 1
              ? 'Add an amount'
              : 'Manage your stock'}
        </Text>
        <Text style={styles.tourTipMessage}>
          {tourStep === 0
            ? 'Search for an ingredient, then tap a suggestion to select it.'
            : tourStep === 1
              ? 'Enter the amount in the ingredient’s unit and tap Add stock.'
              : 'Use plus or minus to adjust quantities, or Remove to delete an item. Cooking a recipe updates this stock.'}
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
    paddingBottom: 36,
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
    marginTop: 8,
    color: '#7A2E0E',
    fontSize: 30,
    fontWeight: '800',
  },
  subtitle: {
    marginTop: 8,
    color: '#5C4A3A',
    fontSize: 16,
    lineHeight: 24,
  },
  section: {
    marginTop: 24,
    marginBottom: 12,
    color: '#2D6A4F',
    fontSize: 18,
    fontWeight: '800',
  },
  input: {
    minHeight: 50,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: '#D8C4B1',
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    color: '#3D2B1F',
    fontSize: 16,
  },
  suggestions: {
    marginTop: 4,
    borderWidth: 1,
    borderColor: '#E8D5C4',
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
  },
  suggestion: {
    minHeight: 46,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F1E7DD',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  suggestionText: {
    color: '#3D2B1F',
    fontSize: 15,
    fontWeight: '600',
  },
  suggestionUnit: {
    color: '#7A6B5E',
    fontSize: 13,
  },
  noMatches: {
    padding: 14,
    color: '#7A6B5E',
  },
  addRow: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
  },
  amountField: {
    flex: 1,
  },
  fieldLabel: {
    marginBottom: 5,
    color: '#5C4A3A',
    fontSize: 13,
    fontWeight: '700',
  },
  amountInput: {
    minHeight: 48,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#D8C4B1',
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    color: '#3D2B1F',
    fontSize: 16,
  },
  addButton: {
    minHeight: 48,
    paddingHorizontal: 16,
    borderRadius: 10,
    backgroundColor: '#C45C26',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  buttonDisabled: {
    opacity: 0.55,
  },
  inventoryHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  categoryBlock: {
    marginBottom: 8,
  },
  category: {
    marginBottom: 8,
    color: '#2D6A4F',
    fontSize: 14,
    fontWeight: '700',
  },
  itemCount: {
    marginTop: 12,
    color: '#7A6B5E',
    fontSize: 14,
  },
  stockCard: {
    minHeight: 76,
    marginBottom: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E8D5C4',
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  stockInfo: {
    flex: 1,
  },
  stockName: {
    color: '#7A2E0E',
    fontSize: 16,
    fontWeight: '800',
  },
  stockAmount: {
    marginTop: 3,
    color: '#5C4A3A',
    fontSize: 14,
  },
  stockActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  quantityButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#EAF2ED',
    alignItems: 'center',
    justifyContent: 'center',
  },
  quantityButtonDisabled: {
    opacity: 0.4,
  },
  quantityButtonText: {
    color: '#2D6A4F',
    fontSize: 20,
    fontWeight: '800',
  },
  removeButton: {
    minHeight: 36,
    paddingHorizontal: 6,
    justifyContent: 'center',
  },
  removeText: {
    color: '#9A3412',
    fontSize: 12,
    fontWeight: '700',
  },
  emptyCard: {
    padding: 14,
    borderRadius: 12,
    backgroundColor: '#EAF2ED',
  },
  emptyTitle: {
    color: '#2D6A4F',
    fontSize: 16,
    fontWeight: '800',
  },
  empty: {
    marginTop: 4,
    color: '#7A6B5E',
    fontSize: 14,
  },
  errorBox: {
    marginTop: 12,
    padding: 12,
    borderRadius: 10,
    backgroundColor: '#FFF0EA',
  },
  errorText: {
    color: '#9A3412',
    fontSize: 14,
  },
  retryText: {
    marginTop: 8,
    color: '#2D6A4F',
    fontWeight: '800',
  },
  guestNotice: {
    marginTop: 10,
    color: '#7A6B5E',
    fontSize: 14,
    fontWeight: '700',
  },
  actionError: {
    marginTop: 10,
    color: '#9A3412',
    fontSize: 14,
  },
});
