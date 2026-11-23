export type MealType = 'breakfast' | 'lunch' | 'dinner';
export type IngredientUnit = 'piece' | 'clove' | 'leaf' | 'g' | 'kg' | 'oz' | 'cup' | 'tsp' | 'tbsp';

export type RecipeIngredient = {
  id: string;
  qtyPerServing: number;
  unit: IngredientUnit;
  required: boolean;
  pantryStaple?: boolean;
};

export type RecipeNutrition = {
  carbs: number;
  protein: number;
  fat: number;
};

export type Recipe = {
  id: string;
  name: string;
  kind: 'chutney' | 'side' | 'main';
  mealTypes: MealType[];
  baseServings: number;
  ingredients: RecipeIngredient[];
  nutritionPerServing: RecipeNutrition;
  steps: string[];
  accompaniments: string[];
};

const baseServings = 2;

export const RECIPES: Recipe[] = [
  {
    id: 'tomato-chutney',
    name: 'Tomato Chutney',
    kind: 'chutney',
    mealTypes: ['breakfast', 'lunch'],
    baseServings,
    nutritionPerServing: { carbs: 12, protein: 2, fat: 7 },
    ingredients: [
      { id: 'tomato', qtyPerServing: 1, unit: 'piece', required: true },
      { id: 'onion', qtyPerServing: 0.5, unit: 'piece', required: true },
      { id: 'salt', qtyPerServing: 0.5, unit: 'tsp', required: true },
      { id: 'chilli_powder', qtyPerServing: 0.5, unit: 'tsp', required: true },
      { id: 'oil', qtyPerServing: 0.5, unit: 'tbsp', required: false, pantryStaple: true },
      { id: 'garlic', qtyPerServing: 1, unit: 'clove', required: false },
    ],
    steps: [
      'Wash and chop {tomato} and {onion}.',
      'Heat {oil} in a pan. Add {onion} and cook until soft.',
      'Add {tomato}, {chilli_powder}, and {salt}. Cook until softened and pulpy.',
      'Cool slightly, then mash or grind to a chutney. Taste and adjust the salt.',
    ],
    accompaniments: ['Dosa', 'Chapati'],
  },
  {
    id: 'coconut-chutney',
    name: 'Coconut Chutney',
    kind: 'chutney',
    mealTypes: ['breakfast'],
    baseServings,
    nutritionPerServing: { carbs: 8, protein: 2, fat: 12 },
    ingredients: [
      { id: 'coconut', qtyPerServing: 0.25, unit: 'cup', required: true },
      { id: 'salt', qtyPerServing: 0.25, unit: 'tsp', required: true },
      { id: 'green_chilli', qtyPerServing: 0.5, unit: 'piece', required: false },
      { id: 'ginger', qtyPerServing: 0.25, unit: 'tsp', required: false },
      { id: 'mustard_seeds', qtyPerServing: 0.25, unit: 'tsp', required: false },
      { id: 'curry_leaves', qtyPerServing: 2, unit: 'leaf', required: false },
      { id: 'oil', qtyPerServing: 0.25, unit: 'tsp', required: false, pantryStaple: true },
    ],
    steps: [
      'Grate or chop {coconut}.',
      'Grind the coconut with {salt}, water, {green_chilli}, or {ginger} if using.',
      'Heat {oil} in a small pan. Add {mustard_seeds} and {curry_leaves} if using; cook until they splutter.',
      'Pour the tempering over the chutney and mix well.',
    ],
    accompaniments: ['Dosa', 'Idli', 'Chapati'],
  },
  {
    id: 'onion-chutney',
    name: 'Onion Chutney',
    kind: 'chutney',
    mealTypes: ['breakfast', 'lunch'],
    baseServings,
    nutritionPerServing: { carbs: 14, protein: 2, fat: 8 },
    ingredients: [
      { id: 'onion', qtyPerServing: 1, unit: 'piece', required: true },
      { id: 'chilli_powder', qtyPerServing: 0.5, unit: 'tsp', required: true },
      { id: 'salt', qtyPerServing: 0.5, unit: 'tsp', required: true },
      { id: 'oil', qtyPerServing: 0.5, unit: 'tbsp', required: false, pantryStaple: true },
      { id: 'garlic', qtyPerServing: 0.5, unit: 'clove', required: false },
    ],
    steps: [
      'Peel and slice {onion}.',
      'Heat {oil} in a pan and cook {onion} until golden and soft.',
      'Add {chilli_powder} and {salt}. Cook for one more minute.',
      'Cool slightly, then grind to a chutney with a spoonful of water.',
    ],
    accompaniments: ['Dosa', 'Chapati', 'Idli'],
  },
  {
    id: 'potato-masala',
    name: 'Potato Masala',
    kind: 'side',
    mealTypes: ['breakfast', 'lunch'],
    baseServings,
    nutritionPerServing: { carbs: 25, protein: 3, fat: 7 },
    ingredients: [
      { id: 'potato', qtyPerServing: 1, unit: 'piece', required: true },
      { id: 'onion', qtyPerServing: 0.5, unit: 'piece', required: true },
      { id: 'salt', qtyPerServing: 0.5, unit: 'tsp', required: true },
      { id: 'turmeric', qtyPerServing: 0.25, unit: 'tsp', required: false },
      { id: 'chilli_powder', qtyPerServing: 0.25, unit: 'tsp', required: false },
      { id: 'mustard_seeds', qtyPerServing: 0.25, unit: 'tsp', required: false },
      { id: 'oil', qtyPerServing: 0.5, unit: 'tbsp', required: false, pantryStaple: true },
    ],
    steps: [
      'Boil {potato} until tender, then peel and cube.',
      'Heat {oil} in a pan. Add {mustard_seeds}, then cook {onion} until soft.',
      'Stir in {turmeric}, {chilli_powder}, and {salt}.',
      'Add {potato}, mash lightly, and cook for a few minutes.',
    ],
    accompaniments: ['Dosa', 'Chapati', 'Idli'],
  },
  {
    id: 'mixed-vegetable-curry',
    name: 'Mixed Vegetable Curry',
    kind: 'main',
    mealTypes: ['lunch', 'dinner'],
    baseServings,
    nutritionPerServing: { carbs: 18, protein: 3, fat: 7 },
    ingredients: [
      { id: 'carrot', qtyPerServing: 0.5, unit: 'piece', required: true },
      { id: 'beans', qtyPerServing: 3, unit: 'piece', required: true },
      { id: 'onion', qtyPerServing: 0.5, unit: 'piece', required: true },
      { id: 'tomato', qtyPerServing: 0.5, unit: 'piece', required: false },
      { id: 'coconut', qtyPerServing: 0.125, unit: 'cup', required: false },
      { id: 'salt', qtyPerServing: 0.5, unit: 'tsp', required: true },
      { id: 'chilli_powder', qtyPerServing: 0.25, unit: 'tsp', required: true },
      { id: 'turmeric', qtyPerServing: 0.125, unit: 'tsp', required: false },
      { id: 'oil', qtyPerServing: 0.5, unit: 'tbsp', required: false, pantryStaple: true },
    ],
    steps: [
      'Wash and chop {carrot}, {beans}, {onion}, and {tomato}.',
      'Heat {oil} in a pan and cook {onion} until soft.',
      'Add the other vegetables, {turmeric}, {chilli_powder}, and {salt}.',
      'Add a splash of water, cover, and simmer until the vegetables are tender.',
      'Stir in {coconut} if using, then serve.',
    ],
    accompaniments: ['Rice', 'Chapati'],
  },
  {
    id: 'vegetable-poriyal',
    name: 'Vegetable Poriyal',
    kind: 'side',
    mealTypes: ['lunch', 'dinner'],
    baseServings,
    nutritionPerServing: { carbs: 10, protein: 3, fat: 6 },
    ingredients: [
      { id: 'spinach', qtyPerServing: 1, unit: 'cup', required: true },
      { id: 'onion', qtyPerServing: 0.5, unit: 'piece', required: false },
      { id: 'coconut', qtyPerServing: 0.125, unit: 'cup', required: false },
      { id: 'salt', qtyPerServing: 0.5, unit: 'tsp', required: true },
      { id: 'chilli_powder', qtyPerServing: 0.25, unit: 'tsp', required: false },
      { id: 'mustard_seeds', qtyPerServing: 0.25, unit: 'tsp', required: false },
      { id: 'oil', qtyPerServing: 0.5, unit: 'tsp', required: false, pantryStaple: true },
    ],
    steps: [
      'Wash and roughly chop {spinach}.',
      'Heat {oil}, add {mustard_seeds}, and cook {onion} until soft.',
      'Add the spinach, {chilli_powder}, and {salt}. Cook until wilted and tender.',
      'Mix in {coconut} if using and serve.',
    ],
    accompaniments: ['Rice', 'Chapati'],
  },
  {
    id: 'chicken-curry',
    name: 'Simple Chicken Curry',
    kind: 'main',
    mealTypes: ['lunch', 'dinner'],
    baseServings,
    nutritionPerServing: { carbs: 10, protein: 32, fat: 18 },
    ingredients: [
      { id: 'chicken', qtyPerServing: 150, unit: 'g', required: true },
      { id: 'onion', qtyPerServing: 0.5, unit: 'piece', required: true },
      { id: 'tomato', qtyPerServing: 0.5, unit: 'piece', required: true },
      { id: 'salt', qtyPerServing: 0.5, unit: 'tsp', required: true },
      { id: 'chilli_powder', qtyPerServing: 0.5, unit: 'tsp', required: true },
      { id: 'turmeric', qtyPerServing: 0.25, unit: 'tsp', required: false },
      { id: 'garam_masala', qtyPerServing: 0.25, unit: 'tsp', required: false },
      { id: 'ginger', qtyPerServing: 0.25, unit: 'tsp', required: false },
      { id: 'garlic', qtyPerServing: 1, unit: 'clove', required: false },
      { id: 'oil', qtyPerServing: 1, unit: 'tbsp', required: false, pantryStaple: true },
    ],
    steps: [
      'Cut the {chicken} into pieces and keep it ready.',
      'Heat {oil} in a pan. Cook {onion} until golden, then add {ginger} and {garlic} if using.',
      'Add {tomato}, {chilli_powder}, {turmeric}, and {salt}. Cook until softened.',
      'Add {chicken} and a splash of water. Cover and simmer until cooked through.',
      'Stir in {garam_masala} and serve.',
    ],
    accompaniments: ['Rice', 'Chapati'],
  },
  {
    id: 'mutton-curry',
    name: 'South Indian Mutton Curry',
    kind: 'main',
    mealTypes: ['lunch', 'dinner'],
    baseServings,
    nutritionPerServing: { carbs: 10, protein: 35, fat: 22 },
    ingredients: [
      { id: 'mutton', qtyPerServing: 175, unit: 'g', required: true },
      { id: 'onion', qtyPerServing: 0.5, unit: 'piece', required: true },
      { id: 'tomato', qtyPerServing: 0.5, unit: 'piece', required: true },
      { id: 'salt', qtyPerServing: 0.5, unit: 'tsp', required: true },
      { id: 'chilli_powder', qtyPerServing: 0.5, unit: 'tsp', required: true },
      { id: 'turmeric', qtyPerServing: 0.25, unit: 'tsp', required: false },
      { id: 'coriander_powder', qtyPerServing: 0.5, unit: 'tsp', required: false },
      { id: 'ginger', qtyPerServing: 0.25, unit: 'tsp', required: false },
      { id: 'garlic', qtyPerServing: 1, unit: 'clove', required: false },
      { id: 'garam_masala', qtyPerServing: 0.25, unit: 'tsp', required: false },
      { id: 'oil', qtyPerServing: 1, unit: 'tbsp', required: false, pantryStaple: true },
    ],
    steps: [
      'Cut the {mutton} into pieces. Finely chop {onion} and {tomato}.',
      'Heat {oil} in a heavy pan. Cook {onion} until golden, then add {ginger} and {garlic} if using.',
      'Add {tomato}, {turmeric}, {chilli_powder}, {coriander_powder}, and {salt}. Cook until the tomato softens.',
      'Add the mutton and enough water to cover. Bring to a boil, then cover and simmer gently until the meat is tender and thoroughly cooked, adding water if needed.',
      'Stir in {garam_masala} if using. Taste, adjust the salt, and serve hot.',
    ],
    accompaniments: ['Rice', 'Chapati'],
  },
  {
    id: 'fish-curry',
    name: 'South Indian Fish Curry',
    kind: 'main',
    mealTypes: ['lunch', 'dinner'],
    baseServings,
    nutritionPerServing: { carbs: 9, protein: 30, fat: 16 },
    ingredients: [
      { id: 'fish', qtyPerServing: 150, unit: 'g', required: true },
      { id: 'onion', qtyPerServing: 0.5, unit: 'piece', required: true },
      { id: 'tomato', qtyPerServing: 0.5, unit: 'piece', required: true },
      { id: 'salt', qtyPerServing: 0.5, unit: 'tsp', required: true },
      { id: 'chilli_powder', qtyPerServing: 0.5, unit: 'tsp', required: true },
      { id: 'turmeric', qtyPerServing: 0.25, unit: 'tsp', required: false },
      { id: 'coriander_powder', qtyPerServing: 0.5, unit: 'tsp', required: false },
      { id: 'oil', qtyPerServing: 1, unit: 'tbsp', required: false, pantryStaple: true },
    ],
    steps: [
      'Rinse the {fish} and cut it into serving pieces.',
      'Heat {oil} in a pan. Cook {onion} until soft, then add {tomato}.',
      'Stir in {chilli_powder}, {turmeric}, {coriander_powder}, and {salt}.',
      'Add a little water and simmer the sauce. Slide in {fish} and cook gently until flaky.',
    ],
    accompaniments: ['Rice', 'Chapati'],
  },
  {
    id: 'egg-pepper-fry',
    name: 'Egg Pepper Fry',
    kind: 'main',
    mealTypes: ['breakfast', 'lunch', 'dinner'],
    baseServings,
    nutritionPerServing: { carbs: 8, protein: 12, fat: 10 },
    ingredients: [
      { id: 'egg', qtyPerServing: 1, unit: 'piece', required: true },
      { id: 'onion', qtyPerServing: 0.5, unit: 'piece', required: true },
      { id: 'chilli_powder', qtyPerServing: 0.25, unit: 'tsp', required: true },
      { id: 'salt', qtyPerServing: 0.25, unit: 'tsp', required: true },
      { id: 'oil', qtyPerServing: 0.5, unit: 'tbsp', required: false, pantryStaple: true },
      { id: 'tomato', qtyPerServing: 0.25, unit: 'piece', required: false },
    ],
    steps: [
      'Boil {egg}, peel, and cut each egg in half.',
      'Heat {oil} in a pan and cook {onion} until golden. Add {tomato} if using.',
      'Add {chilli_powder} and {salt}, then add {egg} and toss gently.',
    ],
    accompaniments: ['Dosa', 'Chapati', 'Rice'],
  },
  {
    id: 'brinjal-curry',
    name: 'Brinjal Curry',
    kind: 'main',
    mealTypes: ['lunch', 'dinner'],
    baseServings,
    nutritionPerServing: { carbs: 16, protein: 4, fat: 8 },
    ingredients: [
      { id: 'brinjal', qtyPerServing: 1, unit: 'piece', required: true },
      { id: 'onion', qtyPerServing: 0.5, unit: 'piece', required: true },
      { id: 'tomato', qtyPerServing: 0.5, unit: 'piece', required: false },
      { id: 'salt', qtyPerServing: 0.5, unit: 'tsp', required: true },
      { id: 'chilli_powder', qtyPerServing: 0.25, unit: 'tsp', required: true },
      { id: 'cumin', qtyPerServing: 0.25, unit: 'tsp', required: false },
      { id: 'oil', qtyPerServing: 0.5, unit: 'tbsp', required: false, pantryStaple: true },
    ],
    steps: [
      'Wash and cube {brinjal}. Chop {onion} and {tomato}.',
      'Heat {oil} in a pan and add {cumin}. Cook {onion} until soft.',
      'Add the brinjal, tomato, {chilli_powder}, and {salt}.',
      'Cover and cook over low heat until the brinjal is tender, stirring occasionally.',
    ],
    accompaniments: ['Rice', 'Chapati'],
  },
];
