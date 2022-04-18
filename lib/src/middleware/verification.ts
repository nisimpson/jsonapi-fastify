import { JsonapiErrorObject } from 'src/@types/jsonapi-spec';
import { JsonapiResourceDefinition } from 'src/@types';
import { HandlerOperation } from 'src/@types/handler';
import { JsonapiFastifyError } from 'src/utils';
import { FastifyAsyncCallback } from './sequence';

export function verifyHandler(
  definition: JsonapiResourceDefinition,
  operation: HandlerOperation
): FastifyAsyncCallback {
  return async (params) => {
    if (!definition.handlers.ready(operation)) {
      params.reply.status(503).send();
    }
    if (!definition.handlers[operation]) {
      params.reply.status(403).send({});
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
