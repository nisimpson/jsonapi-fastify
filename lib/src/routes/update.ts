import { SingleResourceDocument } from 'src/@types/jsonapi-spec';
import { JsonapiResourceDefinition, JsonapiResource } from 'src/@types';
import { toFastifySchema } from 'src/config/validation';
import {
  FastifyAsyncCallback,
  buildSerializerFromRequest,
  sequence,
  verifyHandler,
  deserializeBody,
  buildHandlerRequest,
  endRoute
} from 'src/middleware';
import { documents } from 'src/schemas/schema';
import { JsonapiFastifyError } from 'src/utils';
import serializer from 'src/utils/serializer';
import { RouteSchema, RouteConfiguration } from '.';

const schema: RouteSchema = (definition) => ({
  headers: documents.headers({ body: true }),
  querystring: documents.querystring,
  body: toFastifySchema(documents.request.resource(definition)),
  response: {
    200: toFastifySchema(documents.response.resource(definition)),
    202: toFastifySchema(documents.response.any),
    403: toFastifySchema(documents.error403Forbidden),
    409: toFastifySchema(documents.error409Conflict)
  }
});

function invokeHandler(definition: JsonapiResourceDefinition): FastifyAsyncCallback {
  return async ({ request, reply }) => {
    const context = reply.jsonapi;
    const data = context.resource as JsonapiResource;
    data.id = context.params(request).id!;
    context.response = await definition.handlers.update!({
      request: context.request!,
      operation: 'update',
      data,
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

function sendResponse(): FastifyAsyncCallback {
  return async ({ request, reply }) => {
    const context = reply.jsonapi;
    const result = context.response!.result!;

    if (result === undefined) {
      throw new Error('Missing response data from update request');
    }

    // If we are here, then we have a response document; serialize.
    const options = buildSerializerFromRequest(request);
    const document = serializer.serialize(result, options) as SingleResourceDocument;
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
        deserializeBody(),
        buildHandlerRequest(),
        invokeHandler(definition),
        sendResponse(),
        endRoute()
      ]);
      return reply;
    }
  };
};

export default update;
