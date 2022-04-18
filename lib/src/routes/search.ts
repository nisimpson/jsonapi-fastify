import { toFastifySchema } from '@config/validation';
import {
  FastifyAsyncCallback,
  buildSerializerFromRequest,
  serializePaginationLinks,
  sequence,
  verifySparseFieldsets,
  verifyHandler,
  buildHandlerRequest,
  findIncludes,
  endRoute
} from '@middleware/middleware';
import { documents } from '@schemas/schema';
import { JsonapiResourceDefinition } from '@typings/jsonapi-fastify';
import { MultiResourceDocument } from '@typings/jsonapi-spec';
import { JsonapiFastifyError } from '@utils/error';
import serializer from '@utils/serializer';
import { RouteSchema, RouteConfiguration } from '.';

const schema: RouteSchema = (def) => ({
  headers: documents.headers(),
  querystring: documents.querystring,
  response: {
    200: toFastifySchema(documents.response.resource(def)),
    401: toFastifySchema(documents.errors.error401Unauthorized),
    503: toFastifySchema(documents.errors.error503Unavailable)
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
    const options = buildSerializerFromRequest(params.request);

    const { prev, next } = serializePaginationLinks(page, {
      type,
      style: def.handlers.pagination,
      prefix: context.baseUrl,
      limit: context.request!.query.page!.limit!
    });

    if (options.links) {
      options.links.prev = prev;
      options.links.next = next;
    } else {
      options.links = { prev, next };
    }

    const document = serializer.serialize(result, options) as MultiResourceDocument;
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
        sendResponse(def),
        endRoute()
      ]);
      return reply;
    }
  };
};

export default search;
