import { INGREDIENT_BY_ID } from '../data/ingredients';
import { RECIPES, type MealType, type Recipe } from '../data/recipes';
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
): MatchedRecipe {
  const pantryById = new Map(pantry.map((item) => [item.ingredientId, item]));
  const usage = getRecipeUsage(recipe.ingredients, people);
  const result = scoreRecipe(recipe, selectedIds, pantryById, usage);
  const ingredients = recipe.ingredients.map((ingredient): ScaledIngredient => {
    const info = INGREDIENT_BY_ID[ingredient.id];
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
      name: info.name,
      quantity,
      label: formatQuantity(quantity, ingredient.unit, info.name),
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
    ...result,
    ingredients,
    usage,
    steps: formatSteps(recipe, people, selectedIds),
    accompaniments: recipe.accompaniments,
  };
}

export function findDishes({
  meals,
  ingredientIds,
  people,
  pantry,
  recipeIds,
}: {
  meals: MealType[];
  ingredientIds: string[];
  people: number;
  pantry: PantryStock[];
  recipeIds?: string[];
}): MatchedRecipe[] {
  const selectedIds = new Set(ingredientIds);
  const mealSet = new Set(meals);
  const ranked = RECIPES
    .filter((recipe) =>
      recipe.mealTypes.some((meal) => mealSet.has(meal)) &&
      (!recipeIds || recipeIds.includes(recipe.id)))
    .map((recipe) => buildResult(recipe, people, selectedIds, pantry))
    .sort((a, b) => b.score - a.score || b.matchRatio - a.matchRatio);

  if (ranked.length === 0) return [];

  const first = ranked[0];
  if (mealSet.has('breakfast') && first.kind === 'chutney') {
    const coconutChutney = ranked.find((recipe) => recipe.id === 'coconut-chutney');
    const second = selectedIds.has('coconut') && coconutChutney?.id !== first.id
      ? coconutChutney
      : ranked.find((recipe) => recipe.kind === 'chutney' && recipe.id !== first.id);
    if (second) return [first, second];
  }

  const second = ranked.find((recipe) => recipe.id !== first.id);
  return second ? [first, second] : [first];
}

export function hasWeakMatch(recipes: MatchedRecipe[]): boolean {
  return recipes.length > 0 && recipes[0].matchRatio < 0.5;
}

export function isMealType(value: string): value is MealType {
  return value === 'breakfast' || value === 'lunch' || value === 'dinner';
}

export function getIngredientName(id: string): string {
  return INGREDIENT_BY_ID[id]?.name ?? id;
}
