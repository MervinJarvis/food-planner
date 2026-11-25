import { INGREDIENTS } from '../data/ingredients';

const ALLERGEN_INGREDIENT_IDS: Record<string, readonly string[]> = {
  dairy: ['butter', 'cheese_slices', 'curd', 'fresh_cream', 'ghee', 'milk', 'paneer'],
  egg: ['egg'],
  eggs: ['egg'],
  eggproducts: ['egg'],
  fish: ['fish'],
  peanuts: ['peanuts'],
  sesame: ['gingelly_oil', 'sesame_seeds'],
  shellfish: ['crab', 'lobster', 'prawn', 'shrimp', 'shellfish'],
  soy: ['soy', 'soybean', 'soy_sauce', 'tofu'],
  treenuts: ['almonds_other_nuts', 'cashew_nuts'],
  wheatgluten: ['bread_packet', 'maida', 'macaroni', 'noodles', 'pasta', 'spaghetti', 'vermicelli', 'wheat_flour', 'wheat_rava'],
};

function normalize(value: string): string {
  return value.toLocaleLowerCase().replace(/[^a-z0-9]/g, '');
}

export function getAllergyIngredientIds(allergies: readonly string[]): Set<string> {
  const ingredientIds = new Set<string>();

  for (const allergy of allergies) {
    const normalized = normalize(allergy);
    const mappedIds = ALLERGEN_INGREDIENT_IDS[normalized];
    if (mappedIds) {
      mappedIds.forEach((id) => ingredientIds.add(id));
      continue;
    }

    const matchingIngredient = INGREDIENTS.find(
      (ingredient) => normalize(ingredient.id) === normalized ||
        normalize(ingredient.name) === normalized,
    );
    if (matchingIngredient) ingredientIds.add(matchingIngredient.id);
  }

  return ingredientIds;
}

export function getConflictingAllergies(
  ingredientIds: readonly string[],
  allergies: readonly string[],
): string[] {
  const allergenIds = getAllergyIngredientIds(allergies);
  if (!ingredientIds.some((id) => allergenIds.has(id))) return [];

  return [...new Set(allergies.filter((allergy) => {
    const allergyIds = getAllergyIngredientIds([allergy]);
    return ingredientIds.some((id) => allergyIds.has(id));
  }))];
}
