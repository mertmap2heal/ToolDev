module.exports = {
  root: true,
  env: { browser: true, es2020: true },
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:react-hooks/recommended',
  ],
  ignorePatterns: ['dist', '.eslintrc.cjs', 'e2e'],
  parser: '@typescript-eslint/parser',
  plugins: ['react-refresh'],
  rules: {
    'react-refresh/only-export-components': [
      'warn',
      { allowConstantExport: true },
    ],
    '@typescript-eslint/no-explicit-any': 'warn',
    '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    'no-restricted-syntax': [
      'warn',
      {
        selector: "Literal[value=/(?:blue|indigo|purple)-[0-9]/]",
        message: 'Banned brand colour: blue-*/indigo-*/purple-* Tailwind palette classes are not allowed. Use a design-system token (accent-*, ink-*, surface-*, border-*, status-*) - see improvements/design-system.md section 3.1.',
      },
      {
        selector: "TemplateElement[value.cooked=/(?:blue|indigo|purple)-[0-9]/]",
        message: 'Banned brand colour: blue-*/indigo-*/purple-* Tailwind palette classes are not allowed. Use a design-system token (accent-*, ink-*, surface-*, border-*, status-*) - see improvements/design-system.md section 3.1.',
      },
    ],
  },
}
