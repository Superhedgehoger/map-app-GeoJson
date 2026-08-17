import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist/**', 'release/**', 'public/vendor/**', 'node_modules/**'] },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['src/**/*.ts', 'tests/**/*.ts'],
    rules: {
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-explicit-any': 'off'
    }
  },
  {
    files: ['scripts/**/*.mjs', 'server/**/*.mjs'],
    languageOptions: {
      globals: {
        Buffer: 'readonly',
        console: 'readonly',
        document: 'readonly',
        process: 'readonly',
        structuredClone: 'readonly',
        URL: 'readonly',
        window: 'readonly'
      }
    },
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { destructuredArrayIgnorePattern: '^_', ignoreRestSiblings: true, varsIgnorePattern: '^_' }
      ]
    }
  }
);
