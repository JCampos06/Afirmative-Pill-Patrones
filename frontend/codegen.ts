/**
 * GraphQL Code Generator: genera tipos TypeScript para cada operación a
 * partir del contrato del backend (../backend/schema.graphql).
 * Ejecutar tras modificar el schema o las operaciones: `npm run codegen`.
 */
import type { CodegenConfig } from '@graphql-codegen/cli';

const scalars = {
  DateTime: 'string',
  Date: 'string',
  Money: 'number',
  SKU: 'string',
  PositiveInt: 'number',
  NonEmptyString: 'string',
  EmailAddress: 'string',
};

const config: CodegenConfig = {
  schema: '../backend/schema.graphql',
  documents: ['src/**/*.{ts,tsx}', '!src/gql/**/*'],
  ignoreNoDocuments: true,
  generates: {
    './src/gql/': {
      preset: 'client',
      presetConfig: { fragmentMasking: false },
      config: { scalars, enumsAsTypes: true, useTypeImports: true },
    },
    './src/gql/possibleTypes.ts': {
      plugins: ['fragment-matcher'],
      config: { module: 'es2015', useExplicitTyping: true },
    },
  },
};

export default config;
