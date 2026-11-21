# Food Planner

A mobile-first Expo app for planning South Indian meals from a local recipe catalog. Use guest mode with a device-only pantry, or create an account to keep a private cloud pantry. Choose meals and servings to get the closest recipes with scaled quantities, cooking steps, and serving suggestions. Confirming **Cooked this** deducts the used ingredients from pantry stock. Recipes remain in the local catalog.

## Run

```sh
npm install
npm run web
```

Use `npm start` to open the app on a device or simulator.

## Supabase accounts and pantry

The app uses Supabase email/password authentication. Usernames and a synchronized copy of the account email are stored in `public.profiles`. Supabase Auth stores the email and securely hashes the password in its protected `auth.users` system table; the app never stores plaintext passwords. Users sign in with their unique username or phone number and password. Pantry rows are protected by database row-level security and can only be read or changed by their owner.

1. Create a Supabase project and enable the Email auth provider.
2. Apply both SQL migrations, in timestamp order, from `supabase/migrations/` in the Supabase SQL Editor (or link the project and run `supabase db push`).
3. Copy `.env.example` to `.env` and set your project URL and publishable key from Supabase **Project Settings → API**.
4. Install and sign in to the [Supabase CLI](https://supabase.com/docs/guides/local-development/cli/getting-started), link this repository to the project, and deploy the username-login function:

   ```sh
   supabase login
   supabase link --project-ref YOUR_PROJECT_REF
   supabase functions deploy login-with-username
   ```

   The function uses Supabase's server-side `SUPABASE_SERVICE_ROLE_KEY`; never put that key in the app or `.env`.
5. In Supabase Auth, require email confirmation, configure a working email delivery provider, and set the minimum password length to 8. Users must confirm their email before signing in.
6. Restart Expo after setting `.env`.

The `.env` file only connects the app to Supabase; it does not create database tables or deploy the login function. If sign-up fails while saving a new user, apply the migrations and check that the profile-creation trigger exists. If sign-in fails, deploy `login-with-username` and confirm its `verify_jwt = false` setting is applied.

On sign-up, existing device pantry stock is imported into that account once. New pantry changes are saved in Supabase and remain isolated between accounts.

## Guest mode

Choose **Continue as guest** on the login screen to use the planner without Supabase or an account. Guest pantry stock is saved locally on that device only and is not synced or shared. From the Pantry tab, choose **Create account to sync** to sign up and import the guest pantry, or **Exit guest mode** to return to the login screen. Guest data remains on the device unless it is imported into a new account.

## Recipe matching

Recipes in `src/data/recipes.ts` specify meals, required and optional ingredients, per-serving quantities, instructions, and accompaniments. `src/lib/matchRecipes.ts` scores each eligible recipe, returns up to two matches, and flags weak pantry matches. `src/lib/formatSteps.ts` scales ingredient amounts to the selected party size and fills instruction placeholders.

The recipe catalog is intentionally local and finite. Missing required ingredients are shown on the result cards rather than preventing the closest recipes from appearing.

## Pantry

The Pantry tab stores each signed-in user's ingredient quantities in Supabase. Ingredients use a consistent default unit (for example, produce in kilograms, spices in ounces, eggs as pieces, and meat in grams); recipe units are converted when checking stock and deducting amounts. Stock is never consumed while browsing or planning. On a recipe card, choose **Cooked this** and confirm the preview to deduct quantities. A recipe cannot be marked cooked when required ingredients are missing or understocked.
