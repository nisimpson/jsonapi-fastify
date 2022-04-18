import { FastifyInstance } from 'fastify';
import { JsonapiResourceDefinition } from '@typings/jsonapi-fastify';
import { FastifyAsyncCallback } from '@middleware/sequence';
import { relationshipMeta } from '@middleware/serialization';
import { isRelationDefinition } from '@schemas/fields';
import { documents } from '@schemas/schema';
import { z } from 'zod';
import { ParsedQuery } from './querystring';


export type ValidationSchema = WrappedSchema<z.ZodSchema<unknown>>;

export type WrappedSchema<TSchema> = {
  type: 'object';
  properties: TSchema;
};

/**
 * Wraps the specified schema, such that it conforms to what fastify
 * expects in schema declarations.
 *
 * @param schema The input schema
 * @returns A WrappedSchema instance.
 */
export function toFastifySchema<TSchema>(schema: TSchema): WrappedSchema<TSchema> {
  return {
    type: 'object',
    properties: schema
  };
}

export function validateRelationBody(def: JsonapiResourceDefinition): FastifyAsyncCallback {
  return async (params) => {
    const schema = documents.request.relation(def);
    const parsed = schema.parse(params.request.body);
    params.request.body = parsed;
    return params;
  };
}

export function validateRelationship(
  def: JsonapiResourceDefinition,
  relation: string
): FastifyAsyncCallback {
  return async (params) => {
    const field = def.fields[relation];

    // the attribute does not describe a relationship
    if (!isRelationDefinition(field)) {
      params.reply.callNotFound();
      return params;
    }

    // do not allow modifications on the foreign relationship
    if (field.relation.foreign) {
      const document = documents.error404Foreign.parse({});
      document.meta = relationshipMeta(field);
      params.reply.status(404).send(document);
    }

    // do not allow to-one references to have add/remove semantics
    const method = params.request.method.toLowerCase();
    const isToManyOperation = method === 'delete' || method === 'post';
    if (field.relation.association === 'one' && isToManyOperation) {
      const meta = relationshipMeta(field);
      const document = documents.error403Forbidden.parse({});
      document.meta = meta;
      params.reply.status(403).send(document);
    }
    return params;
  };
}

type Compiler = Parameters<FastifyInstance['setValidatorCompiler']>[0];

function createValidationCompiler(opts: {
  onQuerystring: Compiler;
  onParams: Compiler;
  onBody: Compiler;
  onHeaders: Compiler;
}): Compiler {
  return (params) => {
    const { httpPart } = params;
    if (httpPart === 'querystring' || httpPart === 'query') {
      return opts.onQuerystring(params);
    } else if (httpPart === 'body') {
      return opts.onBody(params);
    } else if (httpPart === 'params') {
      return opts.onParams(params);
    } else if (httpPart === 'headers') {
      return opts.onHeaders(params);
    }
    throw new Error('Missing or unknown httpPart: ' + httpPart);
  };
}

export const defaultValidationCompiler = createValidationCompiler({
  onQuerystring:
    ({ schema }) =>
    (data) => {
      const validator = schema as z.ZodSchema<unknown>;
      const query = data as ParsedQuery;
      const result = validator.safeParse(query.parsed);
      if (result.success) {
        return { value: query.refine() };
      }
      throw result.error;
    },
  onParams:
    ({ schema }) =>
    (data) => {
      const validator = schema as z.ZodSchema<unknown>;
      const result = validator.safeParse(data);
      if (result.success) {
        return { value: result.data };
      }
      throw result.error;
    },
  onBody:
    ({ schema }) =>
    (data) => {
      const validator = schema as ValidationSchema;
      const result = validator.properties.safeParse(data);
      if (result.success) {
        return { value: result.data };
      }
      throw result.error;
    },
  onHeaders:
    ({ schema }) =>
    (data) => {
      const validator = schema as z.ZodSchema<unknown>;
      const result = validator.safeParse(data);
      if (result.success) {
        return { value: result.data };
      }
      throw result.error;
    }
});
