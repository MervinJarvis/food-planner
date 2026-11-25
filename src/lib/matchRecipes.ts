import { getIngredientName as getLocalizedIngredientName } from '../data/ingredientTranslations';
import type { AppLanguage } from '../data/ingredientTranslations';
import { RECIPES, type MealType, type Recipe, type RecipeNutrition } from '../data/recipes';
import { getAllergyIngredientIds } from './allergies';
import { formatQuantity, formatSteps, type ScaledIngredient } from './formatSteps';
import {
  convertQuantity,
  formatPantryQuantity,
  getRecipeUsage,
  type PantryStock,
  type RecipeUsage,
} from './pantry';

export type MatchedRecipe = {
  id: string;
  name: string;
  kind: Recipe['kind'];
  tags: string[];
  nutritionPerServing: RecipeNutrition;
  score: number;
  matchedRequired: number;
  requiredCount: number;
  matchRatio: number;
  missing: string[];
  ingredients: ScaledIngredient[];
  usage: RecipeUsage[];
  steps: string[];
  accompaniments: string[];
};

const proteinIngredientIds = new Set(['beef', 'chicken', 'egg', 'fish', 'mutton']);

function hasSelectedProtein(
  recipe: Pick<Recipe, 'ingredients'>,
  selectedIds: ReadonlySet<string>,
): boolean {
  return recipe.ingredients.some(
    (ingredient) => ingredient.required &&
      proteinIngredientIds.has(ingredient.id) &&
      selectedIds.has(ingredient.id),
  );
}

function scoreRecipe(
  recipe: Recipe,
  selectedIds: ReadonlySet<string>,
  pantryById: ReadonlyMap<string, PantryStock>,
  usage: RecipeUsage[],
) {
  let score = 0;
  let matchedRequired = 0;
  let requiredCount = 0;
  const missing: string[] = [];

  for (const ingredient of usage) {
    if (ingredient.pantryStaple) continue;
    const stock = pantryById.get(ingredient.id);
    const availableQuantity = stock
      ? convertQuantity(stock.quantity, stock.unit, ingredient.unit, ingredient.id)
      : null;
    const isAvailable = selectedIds.has(ingredient.id) &&
      availableQuantity !== null &&
      availableQuantity + 1e-8 >= ingredient.quantity;

    if (ingredient.required) {
      requiredCount += 1;
      if (isAvailable) {
        matchedRequired += 1;
        score += 4;
      } else {
        score -= 5;
        missing.push(ingredient.id);
      }
    } else if (isAvailable) {
      score += 1;
    }
  }

  return {
    score,
    matchedRequired,
    requiredCount,
    missing,
    matchRatio: requiredCount === 0 ? 1 : matchedRequired / requiredCount,
  };
}

function buildResult(
  recipe: Recipe,
  people: number,
  selectedIds: ReadonlySet<string>,
  pantry: PantryStock[],
  language: AppLanguage,
): MatchedRecipe {
  const pantryById = new Map(pantry.map((item) => [item.ingredientId, item]));
  const usage = getRecipeUsage(recipe.ingredients, people);
  const result = scoreRecipe(recipe, selectedIds, pantryById, usage);
  const ingredients = recipe.ingredients.map((ingredient): ScaledIngredient => {
    const name = getLocalizedIngredientName(ingredient.id, language);
    const usedIngredient = usage.find((item) => item.id === ingredient.id);
    const quantity = usedIngredient?.quantity ?? ingredient.qtyPerServing * people;
    const stock = pantryById.get(ingredient.id);
    const availableQuantity = stock
      ? convertQuantity(stock.quantity, stock.unit, ingredient.unit, ingredient.id)
      : null;
    const enoughStock = selectedIds.has(ingredient.id) &&
      availableQuantity !== null &&
      availableQuantity + 1e-8 >= quantity;
    return {
      ...ingredient,
      name,
      quantity,
      label: formatQuantity(quantity, ingredient.unit, name, language),
      selected: enoughStock,
      missing: ingredient.required && !ingredient.pantryStaple && !enoughStock,
      availableLabel: !selectedIds.has(ingredient.id)
        ? 'not selected'
        : stock
          ? formatPantryQuantity(stock.quantity, stock.unit, ingredient.id)
          : 'not in pantry',
    };
  });

  return {
    id: recipe.id,
    name: recipe.name,
    kind: recipe.kind,
    tags: recipe.tags ?? [],
    nutritionPerServing: recipe.nutritionPerServing,
    ...result,
    ingredients,
    usage,
    steps: formatSteps(recipe, people, selectedIds, language),
    accompaniments: recipe.accompaniments,
  };
}

export function findDishes({
  meals,
  ingredientIds,
  people,
  pantry,
  recipeIds,
  allergies = [],
  language = 'en',
}: {
  meals: MealType[];
  ingredientIds: string[];
  people: number;
  pantry: PantryStock[];
  recipeIds?: string[];
  allergies?: string[];
  language?: AppLanguage;
}): MatchedRecipe[] {
  const selectedIds = new Set(ingredientIds);
  const allergenIds = getAllergyIngredientIds(allergies);
  const mealSet = new Set(meals);
  const ranked = RECIPES
    .filter((recipe) =>
      (recipe.mealTypes.some((meal) => mealSet.has(meal)) ||
        hasSelectedProtein(recipe, selectedIds)) &&
      !recipe.ingredients.some((ingredient) => allergenIds.has(ingredient.id)) &&
      (!recipeIds || recipeIds.includes(recipe.id)))
    .map((recipe) => buildResult(recipe, people, selectedIds, pantry, language))
    .sort((a, b) => {
      const priority = (recipe: MatchedRecipe) => {
        if (recipe.kind === 'chutney') return 3;
        if (hasSelectedProtein(recipe, selectedIds)) return 0;
        if (mealSet.has('lunch') && recipe.id === 'tomato-rice') return 1;
        return 2;
      };
      return priority(a) - priority(b) || b.score - a.score || b.matchRatio - a.matchRatio;
    });

  if (ranked.length === 0) return [];

  return ranked.slice(0, 4);
}

export function hasWeakMatch(recipes: MatchedRecipe[]): boolean {
  return recipes.length > 0 && recipes[0].matchRatio < 0.5;
}

export function isMealType(value: string): value is MealType {
  return value === 'breakfast' || value === 'lunch' || value === 'dinner';
}

export function getIngredientName(id: string, language: AppLanguage = 'en'): string {
  return getLocalizedIngredientName(id, language);
}
