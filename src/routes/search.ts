import { RouteConfiguration, RouteSchema } from './index';
import type { JsonapiResourceDefinition } from '../@types';
import { request, response } from '../schemas';
import {
  buildHandlerRequest,
  buildSerializerOptions,
  createPaginationLinks,
  endRoute,
  findIncludes,
  sequence,
  verifyHandler,
  FastifyAsyncCallback,
  JsonapiFastifyError,
  verifySparseFieldsets
} from '../utils';
import { MultiResourceDocument } from 'jsonapi-spec';
import { toFastifySchema } from '../schemas/common';

const schema: RouteSchema = (def) => ({
  headers: request.HEADERS(),
  querystring: request.QUERYSTRING,
  response: {
    200: toFastifySchema(response.RESOURCE_OK_200(def, { multi: true })),
    503: toFastifySchema(response.UNAVAILABLE_503)
  }
});

function invoke(def: JsonapiResourceDefinition): FastifyAsyncCallback {
  return async (params) => {
    const context = params.reply.jsonapi;
    const request = context.request!;

    if (request.query.page) {
      request.query.page = request.query.page ?? def.defaultPageSize;
    }

    context.response = await def.handlers.search!({
      request,
      response: {
        ok(result, page) {
          params.reply.status(200);
          return { result, page };
        },
        notFound: () => {
          params.reply.callNotFound();
          return {};
        },
        error: (errors) => {
          throw new JsonapiFastifyError(errors);
        }
      }
    });

    return params;
  };
}

function sendResponse(def: JsonapiResourceDefinition): FastifyAsyncCallback {
  return async (params) => {
    const context = params.reply.jsonapi;

    if (context.response?.result === undefined) {
      throw new Error('Must provide result data on response');
    }

    const page = context.response.page;
    const result = context.response.result;
    const type = def.resource;
    const options = context.serializerOptions;
    options.meta = {
      count: context.response.result.length
    };

    const { prev, next } = createPaginationLinks(page, {
      type,
      style: def.handlers.pagination,
      prefix: context.baseUrl,
      limit: context.request!.query.page!.limit!
    });

    options.topLevelLinks = {
      ...options.topLevelLinks,
      prev,
      next
    };

    const serializer = context.serializer(type, options);
    const document: MultiResourceDocument = serializer.serialize(result);
    context.document = document;
    params.reply.status(200).send(document);
    return params;
  };
}

const search: RouteConfiguration = (def, options) => {
  return {
    schema: schema(def, options),
    handler: async (request, reply) => {
      reply.jsonapi.log.debug(`invoke search route: ${def.resource}`);
      await sequence(request, reply, [
        verifySparseFieldsets(),
        verifyHandler(def, 'search'),
        buildHandlerRequest(),
        invoke(def),
        findIncludes(),
        buildSerializerOptions(def.resource),
        sendResponse(def),
        endRoute()
      ]);
      return reply;
    }
  };
};

export default search;
