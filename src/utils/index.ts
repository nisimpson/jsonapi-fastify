import { JsonapiErrorObject } from 'jsonapi-spec';
import { RouteConfiguration } from 'src/routes';
import { JsonapiRequest, JsonapiResourceDefinition } from '../@types';
import { HandlerOperation } from '../@types/handler';
import { JsonapiFastifyError } from './error';
import { FastifyAsyncCallback } from './sequence';

export * from './sequence';
export * from './pagination';
export * from './serializer';
export * from './includes';
export * from './error';

export function createRouteConfiguration(config: RouteConfiguration): RouteConfiguration {
  return (def, options) => {
    const routeConfig = config(def, options);
    // fastify has a bug that does not initialize the preHandler route and
    // crashes if not defined.
    routeConfig.preHandler = async () => {};
    return routeConfig;
  };
}

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

export function buildHandlerRequest(): FastifyAsyncCallback {
  return async (params) => {
    const query: any = params.request.query;
    const paths: any = params.request.params;
    const jsonapiRequest: JsonapiRequest = {
      query: { ...query },
      params: { ...paths },
      fastify: {
        request: params.request,
        reply: params.reply
      }
    };
    if (params.request.body) {
      jsonapiRequest.params.resource = params.request.body;
    }
    params.reply.jsonapi.request = Object.freeze(jsonapiRequest);
    return params;
  };
}

export function endRoute(): FastifyAsyncCallback {
  return async (params) => {
    if (params.reply.sent) {
      return params;
    }
    // if we got here, and haven't sent yet, something is wrong
    throw new Error('No response sent! Uh oh...');
  };
}
