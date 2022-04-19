import { toFastifySchema } from '@config/validation';
import {
  FastifyAsyncCallback,
  buildSerializerFromRequest,
  sequence,
  verifySparseFieldsets,
  verifyHandler,
  buildHandlerRequest,
  findIncludes,
  endRoute
} from '@middleware/middleware';
import { documents } from '@schemas/schema';
import { JsonapiResourceDefinition } from '@typings/jsonapi-fastify';
import { SingleResourceDocument } from '@typings/jsonapi-spec';
import { JsonapiFastifyError } from '@utils/error';
import serializer from '@utils/serializer';
import { RouteSchema, RouteConfiguration } from '.';

const schema: RouteSchema = (def) => ({
  querystring: documents.querystring,
  headers: documents.headers(),
  response: {
    200: toFastifySchema(documents.response.resource(def)),
    401: toFastifySchema(documents.errors.error401Unauthorized),
    403: toFastifySchema(documents.errors.error403Forbidden),
    503: toFastifySchema(documents.errors.error503Unavailable)
  }
});

const invoke = (def: JsonapiResourceDefinition): FastifyAsyncCallback => {
  return async (params) => {
    const { reply } = params;
    const context = reply.jsonapi;
    context.response = await def.handler.find!({
      request: context.request!,
      response: {
        ok: (result) => {
          return { result };
        },
        notFound: () => {
          reply.callNotFound();
          return {};
        },
        error: (errors) => {
          throw new JsonapiFastifyError(errors);
        }
      }
    });
    return params;
  };
};

const sendResponse = (def: JsonapiResourceDefinition): FastifyAsyncCallback => {
  return async (params) => {
    const context = params.reply.jsonapi;

    if (context.response?.result === undefined) {
      throw new Error('Must provide result data on response');
    }

    const result = context.response.result;
    const options = buildSerializerFromRequest(params.request);
    const document = serializer.serialize(result, options) as SingleResourceDocument;
    context.document = document;
    params.reply.status(200).send(document);
    return params;
  };
};

const findResource: RouteConfiguration = (def, options) => {
  return {
    schema: schema(def, options),
    handler: async (request, reply) => {
      await sequence(request, reply, [
        verifySparseFieldsets(),
        verifyHandler(def, 'find'),
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

export default findResource;
