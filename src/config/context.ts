import { FastifyInstance } from 'fastify';
import { JsonapiFastifyOptions, JsonapiResourceDefinition, JsonapiResource } from '../@types';
import JSONAPISerializer from 'jsonapi-serializer';
import { FastifyAsyncCallback } from '../utils';

const { Serializer } = JSONAPISerializer;

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
      errors: [],
      statusCode: 200,
      serializerOptions: {},
      log: fastify.log,
      baseUrl: options.urlPrefixAlias ?? '',
      response: {},
      serializer: (type, options) => new Serializer(type, options),
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
