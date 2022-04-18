import type { FastifyInstance } from 'fastify';
import type {
  JsonapiFastifyOptions,
  JsonapiResourceDefinition,
  JsonapiResource
} from 'src/@types/index';
import type { FastifyAsyncCallback } from 'src/middleware';

export default function createJsonapiContext(
  fastify: FastifyInstance,
  options: JsonapiFastifyOptions
): FastifyAsyncCallback {
  type Resources = Record<string, JsonapiResourceDefinition>;
  const resources = options.definitions.reduce<Resources>((acc, item) => {
    acc[item.resource] = item;
    return acc;
  }, {});

  return async (params) => {
    fastify.log.debug('creating jsonapi context');
    params.reply.jsonapi = {
      options,
      definitions: resources,
      log: fastify.log,
      baseUrl: options.urlPrefixAlias ?? '',
      response: {},
      query(request) {
        const query: any = request.query;
        return query;
      },
      params(request) {
        const params: any = request.params;
        return params;
      },
      isMultiResource(value): value is JsonapiResource[] {
        return Array.isArray(value);
      },
      isSingleResource(value): value is JsonapiResource {
        return !Array.isArray(value);
      }
    };
    params.request.jsonapi = params.reply.jsonapi;
    return params;
  };
}
