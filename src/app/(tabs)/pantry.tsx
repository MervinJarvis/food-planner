import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { INGREDIENTS } from '../../data/ingredients';
import type { Ingredient } from '../../data/ingredients';
import { useAuth } from '../../context/AuthContext';
import { usePantry } from '../../context/PantryContext';
import { formatPantryQuantity, getPantryUnit } from '../../lib/pantry';

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
      ingredient.name.toLocaleLowerCase().includes(query),
    ).slice(0, 8);
  }, [search]);

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
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <View style={styles.hero}>
        <View style={styles.heroTopRow}>
          <Text style={styles.eyebrow}>YOUR KITCHEN STOCK</Text>
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
        <Text style={styles.title}>Pantry</Text>
        <Text style={styles.subtitle}>
          Keep track of what you have. Cooking a recipe will subtract its ingredients from here.
        </Text>
        {guest ? (
          <Text style={styles.guestNotice}>Guest mode · saved only on this device</Text>
        ) : null}
      </View>

      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
          <Pressable accessibilityRole="button" onPress={retryLoad}>
            <Text style={styles.retryText}>Try loading again</Text>
          </Pressable>
        </View>
      ) : null}
      {actionError ? <Text style={styles.actionError}>{actionError}</Text> : null}

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
                setSearch(ingredient.name);
              }}
              style={styles.suggestion}
            >
              <Text style={styles.suggestionText}>{ingredient.name}</Text>
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

      <View style={styles.inventoryHeading}>
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
      ) : pantry.map((item) => {
        const ingredient = INGREDIENTS.find(({ id }) => id === item.ingredientId);
        if (!ingredient) return null;
        const step = item.unit === 'piece' || item.unit === 'clove' || item.unit === 'leaf'
          ? 1
          : item.unit === 'g'
            ? 100
            : item.unit === 'kg'
              ? 0.1
              : item.unit === 'oz'
                ? 0.25
                : 0.5;

        return (
          <View key={item.ingredientId} style={styles.stockCard}>
            <View style={styles.stockInfo}>
              <Text style={styles.stockName}>{ingredient.name}</Text>
              <Text style={styles.stockAmount}>
                {formatPantryQuantity(item.quantity, item.unit, item.ingredientId)}
              </Text>
            </View>
            <View style={styles.stockActions}>
              <QuantityButton
                label="−"
                accessibilityLabel={`Remove ${step} ${item.unit} of ${ingredient.name}`}
                disabled={item.quantity < step}
                onPress={() => adjustStock(item.ingredientId, Math.max(0, item.quantity - step))}
              />
              <QuantityButton
                label="+"
                accessibilityLabel={`Add ${step} ${item.unit} of ${ingredient.name}`}
                onPress={() => adjustStock(item.ingredientId, item.quantity + step)}
              />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Remove ${ingredient.name} from pantry`}
                onPress={() => deleteStock(item.ingredientId)}
                style={styles.removeButton}
              >
                <Text style={styles.removeText}>Remove</Text>
              </Pressable>
            </View>
          </View>
        );
      })}
    </ScrollView>
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
