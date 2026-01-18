module.exports = {
  root: true,
  env: { browser: true, es2020: true },
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:react/recommended',
    'plugin:react-hooks/recommended',
    'plugin:react/jsx-runtime',
    'prettier',
  ],
  ignorePatterns: ['dist', '.eslintrc.cjs', 'e2e', 'coverage'],
  parser: '@typescript-eslint/parser',
  plugins: ['react-refresh'],
  settings: {
    react: {
      version: 'detect',
    },
  },
  rules: {
    // Disable react-refresh warning for files exporting non-components (utility functions, constants)
    'react-refresh/only-export-components': 'off',
    // Allow underscore-prefixed unused variables (common pattern for destructuring)
    '@typescript-eslint/no-unused-vars': [
      'error',
      { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
    ],
    // Disable prop-types since we use TypeScript
    'react/prop-types': 'off',
    // Disable strict React Compiler rules that are too restrictive for this codebase
    'react-hooks/set-state-in-effect': 'off',
    'react-hooks/purity': 'off',
    'react-hooks/immutability': 'off',
    // Disable display-name for test files and inline components
    'react/display-name': 'off',
    // Allow lexical declarations in case blocks (common pattern)
    'no-case-declarations': 'off',
    // Allow components defined during render (used for derived components like NavButtons)
    'react-hooks/rules-of-hooks': 'warn',
    // Allow intentional dependency exclusions in useEffect/useCallback/useMemo
    'react-hooks/exhaustive-deps': 'off',
  },
  overrides: [
    {
      // Relax rules for test files
      files: ['**/__tests__/**/*', '**/*.test.*', '**/*.spec.*'],
      rules: {
        '@typescript-eslint/no-explicit-any': 'off',
      },
    },
  ],
}
