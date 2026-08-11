module.exports = {
  parser: '@typescript-eslint/parser',
  parserOptions: {
    project: 'tsconfig.json',
    tsconfigRootDir: __dirname,
    sourceType: 'module',
  },
  plugins: ['@typescript-eslint/eslint-plugin', 'security'],
  extends: [
    'plugin:@typescript-eslint/recommended',
    'plugin:prettier/recommended',
    'plugin:security/recommended-legacy',
  ],
  root: true,
  env: {
    node: true,
    jest: true,
  },
  ignorePatterns: ['.eslintrc.js'],
  rules: {
    '@typescript-eslint/interface-name-prefix': 'off',
    '@typescript-eslint/explicit-function-return-type': 'off',
    '@typescript-eslint/explicit-module-boundary-types': 'off',
    '@typescript-eslint/no-explicit-any': 'off',
    // detect-object-injection dispara con cualquier acceso `obj[key]` dinámico,
    // un patrón muy usado en este codebase (DTOs, mapeos de campos editables) —
    // se deja en 'warn' para que el SAST lo reporte sin romper el build por ruido.
    'security/detect-object-injection': 'warn',
    // Deuda de código preexistente (imports/variables sin usar, requires fuera de
    // import, alias intencionales en enums) — se baja a 'warn' para no bloquear
    // el gate de CI recién agregado; queda como trabajo de limpieza aparte, no
    // parte de este pase de seguridad/estabilidad.
    '@typescript-eslint/no-unused-vars': 'warn',
    '@typescript-eslint/no-var-requires': 'warn',
    '@typescript-eslint/no-duplicate-enum-values': 'warn',
  },
};