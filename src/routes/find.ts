import { request, response } from '../schemas';
import {
  buildHandlerRequest,
  buildSerializerOptions,
  endRoute,
  findIncludes,
  sequence,
  verifyHandler,
  FastifyAsyncCallback,
  verifySparseFieldsets
} from '../utils';
import { RouteConfiguration, RouteSchema } from '.';
import { JsonapiResourceDefinition } from '../@types';
import { JsonapiFastifyError } from '../utils/error';
import { SingleResourceDocument } from 'jsonapi-spec';
import { toFastifySchema } from '../schemas/common';

const schema: RouteSchema = (def) => ({
  querystring: request.QUERYSTRING,
  headers: request.HEADERS(),
  response: {
    200: toFastifySchema(response.RESOURCE_OK_200(def)),
    403: toFastifySchema(response.FORBIDDEN_403),
    503: toFastifySchema(response.UNAVAILABLE_503)
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
    const options = context.serializerOptions;
    const serializer = context.serializer(type, options);
    const document: SingleResourceDocument = serializer.serialize(result);
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
        buildSerializerOptions(def.resource),
        sendResponse(def),
        endRoute()
      ]);
      return reply;
    }
  };
};

export default findResource;
