import { INGREDIENT_BY_ID } from '../data/ingredients';
import type { IngredientUnit, RecipeIngredient } from '../data/recipes';
import { roundRecipeQuantity } from './formatSteps';

export type PantryStock = {
  ingredientId: string;
  quantity: number;
  unit: IngredientUnit;
};

export type RecipeUsage = RecipeIngredient & {
  quantity: number;
};

export type PantryDeduction = {
  ingredientId: string;
  quantity: number;
  unit: IngredientUnit;
  remaining: number;
};

const PANTRY_UNIT_BY_ID: Record<string, IngredientUnit> = {
  chicken: 'g',
  fish: 'g',
  mutton: 'g',
  coconut: 'cup',
  spinach: 'cup',
  ginger: 'tsp',
  garlic: 'clove',
  curry_leaves: 'leaf',
  cooked_rice: 'cup',
  curd: 'cup',
  poha: 'tbsp',
  salt: 'oz',
  pepper: 'oz',
  chilli_powder: 'oz',
  turmeric: 'oz',
  mustard_seeds: 'oz',
  cumin: 'oz',
  coriander_powder: 'oz',
  garam_masala: 'oz',
  tamarind: 'oz',
  dried_red_chilli: 'oz',
  instant_coffee_powder: 'oz',
  tea_powder: 'oz',
  cocoa_powder: 'oz',
  health_drinks: 'oz',
  ketchup_or_jam: 'oz',
  organic_honey: 'oz',
  sugar: 'oz',
  jaggery: 'oz',
  paneer: 'oz',
  cheese_slices: 'piece',
  butter: 'oz',
  idli_dosa_batter: 'kg',
  fresh_cream: 'oz',
  papad: 'piece',
  noodles: 'piece',
  pasta: 'piece',
  macaroni: 'piece',
  spaghetti: 'piece',
  bread_packet: 'piece',
};

type UnitFamily = 'count' | 'clove' | 'leaf' | 'weight' | 'volume';

const UNIT_DETAILS: Record<IngredientUnit, { family: UnitFamily; factor: number }> = {
  piece: { family: 'count', factor: 1 },
  clove: { family: 'clove', factor: 1 },
  leaf: { family: 'leaf', factor: 1 },
  g: { family: 'weight', factor: 1 },
  kg: { family: 'weight', factor: 1000 },
  oz: { family: 'weight', factor: 28.349523125 },
  cup: { family: 'volume', factor: 48 },
  tsp: { family: 'volume', factor: 1 },
  tbsp: { family: 'volume', factor: 3 },
};

function isIngredientUnit(unit: string): unit is IngredientUnit {
  return Object.prototype.hasOwnProperty.call(UNIT_DETAILS, unit);
}

export function getPantryUnit(ingredientId: string): IngredientUnit {
  if (PANTRY_UNIT_BY_ID[ingredientId]) return PANTRY_UNIT_BY_ID[ingredientId];
  const category = INGREDIENT_BY_ID[ingredientId]?.category;
  if (category === 'vegetables' || category === 'grains_flours' || category === 'pulses_dals') {
    return 'kg';
  }
  if (category === 'spices' || category === 'spices_nuts') return 'oz';
  if (category === 'oils') return 'tbsp';
  return 'piece';
}

const VEGETABLE_GRAMS_PER_PIECE: Record<string, number> = {
  tomato: 120,
  onion: 110,
  potato: 150,
  carrot: 60,
  beans: 10,
  green_chilli: 15,
  brinjal: 300,
};

const SPICE_GRAMS_PER_TSP: Record<string, number> = {
  salt: 6,
  pepper: 2.3,
  chilli_powder: 2.7,
  turmeric: 3,
  mustard_seeds: 2,
  cumin: 2.1,
  coriander_powder: 1.8,
  garam_masala: 2,
  fenugreek_seeds: 3.7,
  urad_dal: 4,
  chana_dal: 4,
  cooking_soda: 4.6,
  yeast: 3,
  sugar: 4,
};

const INGREDIENT_GRAMS_PER_CUP: Record<string, number> = {
  urad_dal: 180,
  idli_rice: 185,
  dosa_rice: 185,
  raw_rice: 185,
  pongal_raw_rice: 185,
  rava: 170,
  rice_flour: 125,
  whole_green_moong: 200,
  yellow_moong_dal: 200,
  idli_dosa_batter: 250,
};

// Approximate weights let recipe measures continue to match pantry weights.
function getIngredientUnitWeight(ingredientId: string, unit: IngredientUnit): number | null {
  if (unit === 'g') return 1;
  if (unit === 'kg') return 1000;
  if (unit === 'oz') return 28.349523125;
  if (unit === 'piece' && INGREDIENT_BY_ID[ingredientId]?.category === 'vegetables') {
    return VEGETABLE_GRAMS_PER_PIECE[ingredientId] ?? 100;
  }
  if (unit === 'tsp') return SPICE_GRAMS_PER_TSP[ingredientId] ?? null;
  if (unit === 'cup') return INGREDIENT_GRAMS_PER_CUP[ingredientId] ?? null;
  return null;
}

export function convertQuantity(
  quantity: number,
  fromUnit: IngredientUnit,
  toUnit: IngredientUnit,
  ingredientId?: string,
): number | null {
  const from = UNIT_DETAILS[fromUnit];
  const to = UNIT_DETAILS[toUnit];
  if (from.family === to.family) return (quantity * from.factor) / to.factor;
  if (!ingredientId) return null;
  const fromWeight = getIngredientUnitWeight(ingredientId, fromUnit);
  const toWeight = getIngredientUnitWeight(ingredientId, toUnit);
  if (fromWeight === null || toWeight === null) return null;
  return (quantity * fromWeight) / toWeight;
}

export function formatPantryQuantity(
  quantity: number,
  unit: IngredientUnit,
  ingredientId: string,
): string {
  const name = INGREDIENT_BY_ID[ingredientId]?.name.toLowerCase() ?? ingredientId;
  const lastWord = name.split(' ').pop() ?? name;
  const irregularPlural: Record<string, string> = {
    chilli: 'chillies',
    potato: 'potatoes',
    tomato: 'tomatoes',
  };
  const pluralName = lastWord.endsWith('s')
    ? name
    : `${name.slice(0, name.length - lastWord.length)}${
      irregularPlural[lastWord] ??
      (lastWord.endsWith('y') ? `${lastWord.slice(0, -1)}ies` : `${lastWord}s`)
    }`;
  const amount = Number.isInteger(quantity)
    ? String(quantity)
    : String(Number(quantity.toFixed(2)));

  if (unit === 'piece') {
    return `${amount} ${quantity === 1 ? name : pluralName}`;
  }
  if (unit === 'clove') {
    return `${amount} ${quantity === 1 ? 'clove' : 'cloves'} of ${name}`;
  }
  if (unit === 'leaf') {
    return `${amount} ${quantity === 1 ? name : `${name} leaves`}`;
  }
  if (unit === 'g') return `${amount} g ${name}`;
  return `${amount} ${unit} ${name}`;
}

export function formatPantryAmount(quantity: number, unit: IngredientUnit): string {
  const amount = Number.isInteger(quantity)
    ? String(quantity)
    : String(Number(quantity.toFixed(2)));

  if (unit === 'piece') {
    return `${amount} ${quantity === 1 ? 'piece' : 'pieces'}`;
  }
  if (unit === 'clove') {
    return `${amount} ${quantity === 1 ? 'clove' : 'cloves'}`;
  }
  if (unit === 'leaf') {
    return `${amount} ${quantity === 1 ? 'leaf' : 'leaves'}`;
  }
  return `${amount}${unit}`;
}

export function getRecipeUsage(ingredients: RecipeIngredient[], people: number): RecipeUsage[] {
  return ingredients.map((ingredient) => ({
    ...ingredient,
    quantity: roundRecipeQuantity(ingredient.qtyPerServing * people, ingredient.unit),
  }));
}

export function getRecipeShortages(
  usage: RecipeUsage[],
  pantry: PantryStock[],
): RecipeUsage[] {
  const stockById = new Map(pantry.map((item) => [item.ingredientId, item]));
  return usage.filter((item) => {
    if (!item.required || item.pantryStaple) return false;
    const stock = stockById.get(item.id);
    if (!stock) return true;
    const required = convertQuantity(item.quantity, item.unit, stock.unit, item.id);
    return required === null || stock.quantity + 1e-8 < required;
  });
}

export function getRecipeDeduction(
  usage: RecipeUsage[],
  pantry: PantryStock[],
): { nextPantry: PantryStock[]; shortages: RecipeUsage[] } {
  const shortages = getRecipeShortages(usage, pantry);
  if (shortages.length > 0) return { nextPantry: pantry, shortages };

  const stockById = new Map(pantry.map((item) => [item.ingredientId, { ...item }]));
  for (const item of usage) {
    const stock = stockById.get(item.id);
    if (!stock) continue;

    const amount = convertQuantity(item.quantity, item.unit, stock.unit, item.id);
    if (amount === null || stock.quantity + 1e-8 < amount) continue;
    stock.quantity = Math.max(0, stock.quantity - amount);
  }

  return {
    nextPantry: [...stockById.values()].filter((item) => item.quantity > 1e-8),
    shortages: [],
  };
}

export function getRecipeDeductionPreview(
  usage: RecipeUsage[],
  pantry: PantryStock[],
): PantryDeduction[] {
  const stockById = new Map(pantry.map((item) => [item.ingredientId, item]));
  return usage.flatMap((item) => {
    const stock = stockById.get(item.id);
    if (!stock) return [];
    const quantity = convertQuantity(item.quantity, item.unit, stock.unit, item.id);
    if (quantity === null || stock.quantity + 1e-8 < quantity) return [];
    return [{
      ingredientId: item.id,
      quantity,
      unit: stock.unit,
      remaining: Math.max(0, stock.quantity - quantity),
    }];
  });
}

export function isValidPantryStock(value: unknown): value is PantryStock[] {
  if (!Array.isArray(value)) return false;
  return value.every((item) =>
    typeof item === 'object' &&
    item !== null &&
    'ingredientId' in item &&
    typeof item.ingredientId === 'string' &&
    Boolean(INGREDIENT_BY_ID[item.ingredientId]) &&
    'quantity' in item &&
    typeof item.quantity === 'number' &&
    Number.isFinite(item.quantity) &&
    item.quantity > 0 &&
    'unit' in item &&
    item.unit === getPantryUnit(item.ingredientId),
  );
}

export function normalizePantryStock(value: unknown): PantryStock[] | null {
  if (!Array.isArray(value)) return null;
  const normalized: PantryStock[] = [];

  for (const item of value) {
    if (
      typeof item !== 'object' ||
      item === null ||
      !('ingredientId' in item) ||
      typeof item.ingredientId !== 'string' ||
      !INGREDIENT_BY_ID[item.ingredientId] ||
      !('quantity' in item) ||
      typeof item.quantity !== 'number' ||
      !Number.isFinite(item.quantity) ||
      item.quantity <= 0 ||
      !('unit' in item) ||
      typeof item.unit !== 'string' ||
      !isIngredientUnit(item.unit)
    ) {
      return null;
    }

    const unit = getPantryUnit(item.ingredientId);
    const quantity = convertQuantity(item.quantity, item.unit, unit, item.ingredientId);
    if (quantity === null) return null;
    normalized.push({ ingredientId: item.ingredientId, quantity, unit });
  }

  return normalized;
}
