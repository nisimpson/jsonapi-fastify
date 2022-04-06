import type { JsonapiResourceDefinition } from '../@types';
import type { SingleResourceDocument } from 'jsonapi-spec';
import { request, response } from '../schemas';
import {
  endRoute,
  sequence,
  verifyHandler,
  FastifyAsyncCallback,
  JsonapiFastifyError,
  deserializeRequestBody,
  buildHandlerRequest,
  buildSerializerOptions
} from '../utils';
import type { RouteConfiguration, RouteSchema } from '.';
import { toFastifySchema } from '../schemas/common';

const schema: RouteSchema = (definition) => ({
  headers: request.HEADERS(),
  querystring: request.QUERYSTRING,
  body: toFastifySchema(request.CREATE(definition)),
  response: {
    200: toFastifySchema(response.RESOURCE_OK_200(definition)),
    202: toFastifySchema(response.ACCEPTED_202),
    403: toFastifySchema(response.FORBIDDEN_403),
    409: toFastifySchema(response.CONFLICT_409)
  }
});

function invokeHandler(definition: JsonapiResourceDefinition): FastifyAsyncCallback {
  return async ({ request, reply }) => {
    const context = reply.jsonapi;
    context.response = await definition.handlers.update!({
      request: context.request!,
      operation: 'update',
      data: context.resource!,
      response: {
        ok: (result) => {
          if (result === undefined) {
            reply.status(204).send();
          }
          return { result };
        },
        error: (errors) => {
          throw new JsonapiFastifyError(errors);
        },
        notFound: () => {
          reply.callNotFound();
          return {};
        },
        accepted: (meta) => {
          reply.status(202).send({ meta });
          return {};
        },
        conflict: () => {
          reply.status(409).send();
          return {};
        }
      }
    });
    return { request, reply };
  };
}

function sendResponse(type: string): FastifyAsyncCallback {
  return async ({ request, reply }) => {
    const context = reply.jsonapi;
    const result = context.response!.result!;

    if (result === undefined) {
      throw new Error('Missing response data from update request');
    }

    // If we are here, then we have a response document; serialize.
    context.serializerOptions.dataMeta = context.response?.meta;
    const serializer = context.serializer(type, context.serializerOptions);
    const document: SingleResourceDocument = serializer.serialize(result);
    context.document = document;

    reply.status(200).send(document);
    return { request, reply };
  };
}

const update: RouteConfiguration = (definition, options) => {
  return {
    schema: schema(definition, options),
    handler: async (request, reply) => {
      await sequence(request, reply, [
        verifyHandler(definition, 'update'),
        deserializeRequestBody(definition),
        buildHandlerRequest(),
        invokeHandler(definition),
        buildSerializerOptions(definition.resource),
        sendResponse(definition.resource),
        endRoute()
      ]);
      return reply;
    }
  };
};

export default update;
