import { FastifyInstance } from 'fastify';
import * as request from './request';
import type { z } from 'zod';
import { ParsedQuery } from '../config/parsing';
import { FastifyAsyncCallback, relationshipMeta } from '../utils';
import { JsonapiResourceDefinition } from '../@types';
import { isRelationDefinition } from './fields';
import { FORBIDDEN_403, RESOURCE_FOREIGN_404 } from './response';
import { WrappedSchema } from './common';

export type ValidationSchema = WrappedSchema<z.ZodSchema<unknown>>;

export function validateRelationBody(
  def: JsonapiResourceDefinition,
  relation: string
): FastifyAsyncCallback {
  return async (params) => {
    const schema = request.UPDATE(def, { relation });
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
      const document = RESOURCE_FOREIGN_404.parse({});
      document.meta = relationshipMeta(field);
      params.reply.status(404).send(document);
    }

    // do not allow to-one references to have add/remove semantics
    const method = params.request.method.toLowerCase();
    const isToManyOperation = method === 'delete' || method === 'post';
    if (field.relation.association === 'one' && isToManyOperation) {
      const meta = relationshipMeta(field);
      const document = FORBIDDEN_403.parse({});
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
