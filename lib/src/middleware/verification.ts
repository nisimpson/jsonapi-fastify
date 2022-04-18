import { HandlerOperation } from '@typings/handler';
import { JsonapiResourceDefinition } from '@typings/jsonapi-fastify';
import { JsonapiErrorObject } from '@typings/jsonapi-spec';
import { JsonapiFastifyError } from '@utils/error';
import { FastifyAsyncCallback } from './sequence';

export function verifyHandler(
  definition: JsonapiResourceDefinition,
  operation: HandlerOperation
): FastifyAsyncCallback {
  return async (params) => {
    if (definition.handlers.authorize) {
      const authorized = await definition.handlers.authorize(operation, params.request);
      if (!authorized) {
        params.reply.status(401).send({});
        return params;
      }
    }
    if (!definition.handlers.ready(operation)) {
      params.reply.status(503).send();
      return params;
    }
    if (!definition.handlers[operation]) {
      params.reply.status(403).send({});
      return params;
    }
    return params;
  };
}

export function verifySparseFieldsets(): FastifyAsyncCallback {
  return async (params) => {
    const jsonapi = params.request.jsonapi;
    const query = jsonapi.query(params.request);
    const errors: JsonapiErrorObject[] = [];
    for (const [key, value] of Object.entries(query.fields!)) {
      const definition = jsonapi.definitions[key];
      if (definition) {
        const fields = Object.keys(definition.fields);
        for (const field of value) {
          if (!fields.includes(field)) {
            errors.push({
              code: 'EINVALID',
              status: '422',
              title: 'Invalid Query',
              detail: `Unknown field '${field}' on resource '${definition.resource}.'`
            });
          }
        }
      }
    }
    if (errors.length > 0) {
      throw new JsonapiFastifyError(errors);
    }
    return params;
  };
}
