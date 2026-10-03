# Recipes

`/mitatanaansyotaisiin`: a random recipe from the S-cloud API (`RecipesClient`), as text
(ingredients, steps) and its photo.

## Entry points

| Entry point | Called by |
| --- | --- |
| `formatRecipe` | `/mitatanaansyotaisiin` (`telegram/commands/recipes/`), which fetches the recipes and picks one |

## Data

None.

## Files

| File | Does |
| --- | --- |
| `messages.ts` | A recipe as the chat message and its photo URL. There is no other logic, so no main entry. |
