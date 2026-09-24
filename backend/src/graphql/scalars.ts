/**
 * Scalars personalizados. DateTime, Date, PositiveInt, NonEmptyString y
 * EmailAddress vienen de graphql-scalars; Money y SKU son propios del dominio.
 */
import { GraphQLError, GraphQLScalarType, Kind, type ValueNode } from 'graphql';
import {
  DateResolver,
  DateTimeResolver,
  EmailAddressResolver,
  NonEmptyStringResolver,
  PositiveIntResolver,
} from 'graphql-scalars';

function assertMoney(value: unknown): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
    throw new GraphQLError('Money debe ser un entero no negativo (pesos colombianos, sin decimales).');
  }
  return value;
}

export const MoneyScalar = new GraphQLScalarType<number, number>({
  name: 'Money',
  description: 'Valor monetario en pesos colombianos (COP) sin decimales.',
  serialize(value) {
    const n = typeof value === 'string' ? Number(value) : value;
    if (typeof n !== 'number' || !Number.isFinite(n)) {
      throw new GraphQLError(`Money no puede representar el valor: ${String(value)}`);
    }
    return Math.round(n);
  },
  parseValue: assertMoney,
  parseLiteral(ast: ValueNode) {
    if (ast.kind !== Kind.INT) throw new GraphQLError('Money debe ser un literal entero.');
    return assertMoney(Number(ast.value));
  },
});

const SKU_PATTERN = /^MED-\d{3}$/;

function assertSku(value: unknown): string {
  if (typeof value !== 'string' || !SKU_PATTERN.test(value)) {
    throw new GraphQLError('SKU debe tener el formato MED-000.');
  }
  return value;
}

export const SkuScalar = new GraphQLScalarType<string, string>({
  name: 'SKU',
  description: 'Código de inventario de un medicamento con formato MED-000.',
  serialize: (value) => assertSku(value),
  parseValue: assertSku,
  parseLiteral(ast: ValueNode) {
    if (ast.kind !== Kind.STRING) throw new GraphQLError('SKU debe ser un literal de texto.');
    return assertSku(ast.value);
  },
});

export const scalarResolvers = {
  DateTime: DateTimeResolver,
  Date: DateResolver,
  PositiveInt: PositiveIntResolver,
  NonEmptyString: NonEmptyStringResolver,
  EmailAddress: EmailAddressResolver,
  Money: MoneyScalar,
  SKU: SkuScalar,
};
