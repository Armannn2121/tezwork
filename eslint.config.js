// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    // supabase/functions — Deno коды, Expo ережелері оған келмейді
    ignores: ['dist/*', '.expo/**', 'supabase/functions/**'],
  },
]);
