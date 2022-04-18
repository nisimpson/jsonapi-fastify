import { SingleResourceDocument } from 'src/@types/jsonapi-spec';
import { JsonapiResourceDefinition } from 'src/@types';
import { toFastifySchema } from 'src/config/validation';
import {
  FastifyAsyncCallback,
  buildSerializerFromRequest,
  sequence,
  verifySparseFieldsets,
  verifyHandler,
  buildHandlerRequest,
  findIncludes,
  endRoute
} from 'src/middleware';
import { documents } from 'src/schemas/schema';
import { JsonapiFastifyError } from 'src/utils';
import serializer from 'src/utils/serializer';
import { RouteSchema, RouteConfiguration } from '.';

const schema: RouteSchema = (def) => ({
  querystring: documents.querystring,
  headers: documents.headers(),
  response: {
    200: toFastifySchema(documents.response.resource(def)),
    403: toFastifySchema(documents.error403Forbidden),
    503: toFastifySchema(documents.error503Unavailable)
  }
});

const invoke = (def: JsonapiResourceDefinition): FastifyAsyncCallback => {
  return async (params) => {
    const { reply } = params;
    const context = reply.jsonapi;
    context.response = await def.handlers.find!({
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
    const type = def.resource;
    //const options = context.serializerOptions;
    //const serializer = context.serializer(type, options);
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
