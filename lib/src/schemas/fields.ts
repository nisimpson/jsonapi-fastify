import { JsonapiResourceDefinition } from '@typings/jsonapi-fastify';
import { z } from 'zod';

type Zod = typeof z;

interface ZodInstance extends Zod {}
type PrimitiveTypeCallback = (z: ZodInstance) => z.ZodTypeAny;

export type PrimitiveField = {
  kind: 'primitive';
  schema: z.ZodTypeAny;
  readonly?: boolean;
};

export type RelationalField = {
  kind: 'relation';
  relation: {
    type: string;
    foreign?: boolean;
    as?: string;
    association: 'one' | 'many';
  };
  readonly?: boolean;
  description: string;
};

export type FieldDefinition = PrimitiveField | RelationalField;

type AttributeOptions = {
  description?: string;
  type?: PrimitiveTypeCallback;
  readonly?: boolean;
};

function attribute(opts?: AttributeOptions): FieldDefinition {
  const schema: PrimitiveField = {
    kind: 'primitive',
    readonly: opts?.readonly,
    schema: opts?.type
      ? opts.type(z).describe(opts.description ?? '')
      : z.unknown().describe(opts?.description ?? '')
  };
  return schema;
}

type RelationOptions = {
  description?: string;
  readonly?: boolean;
};

type ForeignRelationOptions = Omit<RelationOptions, 'readonly'> & {
  as?: string;
};

function toOneRelation(resourceType: string, opts?: RelationOptions): FieldDefinition {
  const schema: FieldDefinition = {
    kind: 'relation',
    readonly: opts?.readonly,
    description: opts?.description ?? '',
    relation: {
      type: resourceType,
      association: 'one'
    }
  };
  return schema;
}

function toManyRelation(resourceType: string, opts?: RelationOptions): FieldDefinition {
  return {
    kind: 'relation',
    readonly: opts?.readonly,
    description: opts?.description ?? '',
    relation: {
      type: resourceType,
      association: 'many'
    }
  };
}

function belongsToManyRelation(resource: string, opts: ForeignRelationOptions): FieldDefinition {
  return {
    kind: 'relation',
    description: opts.description ?? '',
    readonly: true,
    relation: {
      foreign: true,
      type: resource,
      as: opts.as,
      association: 'many'
    }
  };
}

function belongsToOneRelation(resource: string, opts: ForeignRelationOptions): FieldDefinition {
  return {
    kind: 'relation',
    description: opts.description ?? '',
    readonly: true,
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
