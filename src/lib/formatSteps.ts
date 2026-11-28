import { INGREDIENT_BY_ID } from '../data/ingredients';
import { getIngredientName } from '../data/ingredientTranslations';
import type { AppLanguage } from '../data/ingredientTranslations';
import type { Recipe, RecipeIngredient } from '../data/recipes';

export type ScaledIngredient = RecipeIngredient & {
  name: string;
  quantity: number;
  selected: boolean;
  missing: boolean;
  availableLabel: string;
};

function formatNumber(quantity: number): string {
  return String(quantity);
}

export function formatQuantityAmount(
  quantity: number,
  unit: Recipe['ingredients'][number]['unit'],
): string {
  const amount = roundRecipeQuantity(quantity, unit);

  if (unit === 'piece') {
    return `${formatNumber(amount)} ${amount === 1 ? 'piece' : 'pieces'}`;
  }
  if (unit === 'clove') {
    return `${formatNumber(amount)} ${amount === 1 ? 'clove' : 'cloves'}`;
  }
  if (unit === 'leaf') {
    return `${formatNumber(amount)} ${amount === 1 ? 'leaf' : 'leaves'}`;
  }
  return `${formatNumber(amount)} ${unit}`;
}

function pluralize(name: string): string {
  const lowerName = name.toLowerCase();
  const lastWord = lowerName.split(' ').pop() ?? lowerName;
  if (lastWord.endsWith('s')) return lowerName;
  const irregular: Record<string, string> = {
    tomato: 'tomatoes',
    potato: 'potatoes',
    chilli: 'chillies',
    leaf: 'leaves',
  };
  const pluralLastWord = irregular[lastWord] ??
    (lastWord.endsWith('y') ? `${lastWord.slice(0, -1)}ies` : `${lastWord}s`);
  return lowerName.slice(0, lowerName.length - lastWord.length) + pluralLastWord;
}

export function formatQuantity(
  quantity: number,
  unit: Recipe['ingredients'][number]['unit'],
  name: string,
  language: AppLanguage = 'en',
): string {
  const amount = roundRecipeQuantity(quantity, unit);

  if (unit === 'piece') {
    const pieceName = language === 'en' && amount !== 1 ? pluralize(name) : name.toLowerCase();
    return `${formatNumber(amount)} ${pieceName}`;
  }
  if (unit === 'clove') {
    return `${formatNumber(amount)} ${amount === 1 ? 'clove' : 'cloves'} of ${name.toLowerCase()}`;
  }
  if (unit === 'leaf') {
    const leafName = language === 'en' && amount !== 1 ? pluralize(name) : name.toLowerCase();
    return `${formatNumber(amount)} ${leafName}`;
  }
  if (unit === 'g') {
    return `${formatNumber(amount)} g ${name.toLowerCase()}`;
  }
  return `${formatNumber(amount)} ${unit} ${name.toLowerCase()}`;
}

export function roundRecipeQuantity(
  quantity: number,
  unit: Recipe['ingredients'][number]['unit'],
): number {
  if (unit === 'piece' || unit === 'clove' || unit === 'leaf') {
    return Math.max(1, Math.round(quantity));
  }
  if (unit === 'g') return Math.max(10, Math.round(quantity / 10) * 10);
  return Math.max(0.25, Math.round(quantity * 4) / 4);
}

export function formatSteps(
  recipe: Recipe,
  people: number,
  selectedIds: ReadonlySet<string>,
  language: AppLanguage = 'en',
): string[] {
  const amounts = Object.fromEntries(
    recipe.ingredients.map((ingredient) => {
      const name = getIngredientName(ingredient.id, language);
      return [
        ingredient.id,
        formatQuantity(
          ingredient.qtyPerServing * recipe.baseServings * (people / recipe.baseServings),
          ingredient.unit,
          name,
          language,
        ),
      ];
    }),
  );

  return recipe.steps.map((step) =>
    step.replace(/\{([a-z_]+)\}/g, (token, ingredientId: string) => {
      if (!amounts[ingredientId]) {
        return INGREDIENT_BY_ID[ingredientId]
          ? getIngredientName(ingredientId, language)
          : token;
      }
      if (!selectedIds.has(ingredientId)) {
        const recipeIngredient = recipe.ingredients.find(({ id }) => id === ingredientId);
        if (recipeIngredient && !recipeIngredient.required && !recipeIngredient.pantryStaple) {
          return getIngredientName(ingredientId, language).toLowerCase();
        }
      }
      return amounts[ingredientId];
    }),
  );
}
