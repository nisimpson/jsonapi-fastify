import { JsonapiResourceDefinition } from '@typings/jsonapi-fastify';
import { z } from 'zod';

type Zod = typeof z;

interface ZodValidator extends Zod {}
type FieldValidator = (z: ZodValidator) => z.ZodTypeAny;

export type PrimitiveField = {
  kind: 'primitive';
  schema: z.ZodTypeAny;
};

export type RelationalField = {
  kind: 'relation';
  relation: {
    type: string;
    foreign?: boolean;
    as?: string;
    association: 'one' | 'many';
  };
  description: string;
};

export type FieldDefinition = PrimitiveField | RelationalField;

function attribute(opts?: { description?: string; validator?: FieldValidator }): FieldDefinition {
  const schema: PrimitiveField = {
    kind: 'primitive',
    schema: opts?.validator
      ? opts.validator(z).describe(opts.description ?? '')
      : z.unknown().describe(opts?.description ?? '')
  };
  return schema;
}

function toOneRelation(resourceType: string, opts?: { description: string }): FieldDefinition {
  const schema: FieldDefinition = {
    kind: 'relation',
    description: opts?.description || '',
    relation: {
      type: resourceType,
      association: 'one'
    }
  };
  return schema;
}

function toManyRelation(resourceType: string, opts?: { description: string }): FieldDefinition {
  return {
    kind: 'relation',
    description: opts?.description || '',
    relation: {
      type: resourceType,
      association: 'many'
    }
  };
}

function belongsToManyRelation(
  resource: string,
  opts: {
    as: string;
    description?: string;
  }
): FieldDefinition {
  return {
    kind: 'relation',
    description: opts.description || '',
    relation: {
      foreign: true,
      type: resource,
      as: opts.as,
      association: 'many'
    }
  };
}

function belongsToOneRelation(
  resource: string,
  opts: {
    as: string;
    description?: string;
  }
): FieldDefinition {
  return {
    kind: 'relation',
    description: opts.description || '',
    relation: {
      foreign: true,
      type: resource,
      as: opts.as,
      association: 'one'
    }
  };
}

const schema = {
  attribute,
  toOne: toOneRelation,
  toMany: toManyRelation,
  belongsToOne: belongsToOneRelation,
  belongsToMany: belongsToManyRelation
};

export function isRelationDefinition(value: FieldDefinition): value is RelationalField {
  return value && value.kind === 'relation';
}

export function isPrimitiveDefinition(value: FieldDefinition): value is PrimitiveField {
  return value && value.kind === 'primitive';
}

export function getRelationAttributes(config: JsonapiResourceDefinition): RelationalField[] {
  return Object.values(config.fields).filter((value) => {
    return isRelationDefinition(value);
  }) as RelationalField[];
}

export function getPrimitiveAttributes(config: JsonapiResourceDefinition): PrimitiveField[] {
  return Object.values(config.fields).filter((value) => {
    return isPrimitiveDefinition(value);
  }) as PrimitiveField[];
}

export function forEachFieldInDefinition(
  def: JsonapiResourceDefinition,
  callbacks: {
    onPrimitive(field: PrimitiveField, key: string): void;
    onRelation(field: RelationalField, key: string): void;
  }
): void {
  for (const [key, value] of Object.entries(def.fields)) {
    if (value.kind === 'primitive') {
      callbacks.onPrimitive(value, key);
    } else {
      callbacks.onRelation(value, key);
    }
  }
}

export default schema;
