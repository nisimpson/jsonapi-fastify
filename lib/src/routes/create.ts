import { toFastifySchema } from '@config/validation';
import {
  FastifyAsyncCallback,
  buildSerializerFromRequest,
  sequence,
  verifyHandler,
  deserializeBody,
  buildHandlerRequest,
  endRoute
} from '@middleware/middleware';
import { documents } from '@schemas/schema';
import {
  JsonapiResourceDefinition,
  JsonapiResource,
  JsonapiRequest
} from '@typings/jsonapi-fastify';
import { SingleResourceDocument } from '@typings/jsonapi-spec';
import { JsonapiFastifyError } from '@utils/error';
import serializer from '@utils/serializer';
import { RouteSchema, RouteConfiguration } from '.';

const schema: RouteSchema = (definition) => ({
  headers: documents.headers({ body: true }),
  querystring: documents.querystring,
  body: toFastifySchema(documents.request.resource(definition, { create: true })),
  response: {
    201: toFastifySchema(documents.response.resource(definition)),
    202: toFastifySchema(documents.response.any),
    401: toFastifySchema(documents.errors.error401Unauthorized),
    403: toFastifySchema(documents.errors.error403Forbidden),
    409: toFastifySchema(documents.errors.error409Conflict),
    503: toFastifySchema(documents.errors.error503Unavailable)
  }
});

function checkForConflicts({
  resource: type,
  handler
}: JsonapiResourceDefinition): FastifyAsyncCallback {
  return async (params) => {
    const jsonapi = params.reply.jsonapi;
    const resource = jsonapi.resource as JsonapiResource;
    if (resource?.id) {
      // check if a resource exists with the client provided id
      if (handler.find === undefined) {
        params.reply.log.warn('cannot check for conflicts without a find handler', {
          resource: type
        });
        params.reply.status(403).send({});
        return params;
      }
      const originalRequest = jsonapi.request!;
      const request: JsonapiRequest = {
        ...originalRequest,
        params: {
          ...originalRequest.params,
          id: resource.id
        }
      };
      const { result } = await handler.find({
        request,
        response: {
          ok: (result) => ({ result }),
          notFound: () => ({}),
          error: (errors) => {
            throw new JsonapiFastifyError(errors);
          }
        }
      });

      // if an item was found, then there is a conflict
      if (result) {
        params.reply.status(409).send({});
      }
    }
    return params;
  };
}

function invokeHandler(definition: JsonapiResourceDefinition): FastifyAsyncCallback {
  return async ({ request, reply }) => {
    const jsonapi = reply.jsonapi;
    const resource = jsonapi.resource as JsonapiResource;
    resource.id = resource.id ?? definition.idGenerator?.() ?? '';
    jsonapi.response = await definition.handler.create!({
      request: jsonapi.request!,
      data: resource,
      response: {
        ok: (result) => {
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
          // If a request to create a resource has been accepted for processing,
          // but the processing has not been completed by the time the server responds,
          // the server MUST return a 202 Accepted status code.
          reply.status(202).send({
            meta: {
              ...jsonapi.options.meta,
              ...meta
            }
          });
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

function sendResponse(def: JsonapiResourceDefinition): FastifyAsyncCallback {
  return async ({ request, reply }) => {
    const context = reply.jsonapi;
    const hasResult = context.response?.result !== undefined;

    // If a POST request did include a Client-Generated ID
    // and the requested resource has been created successfully,
    // the server returns 204 No Content status code if no response document.

    if (def.allowsIdOnCreate && !hasResult) {
      reply.status(204).send();
      return { request, reply };
    }

    if (!hasResult) {
      throw new Error('Missing response data from request');
    }

    // If we are here, then we have a response document; serialize.
    const result = context.response.result;
    const options = buildSerializerFromRequest(request);
    const document = serializer.serialize(result, options) as SingleResourceDocument;
    document.meta = context.options.meta
      ? {
          ...context.options.meta,
          ...document.meta
        }
      : document.meta;
    context.document = document;

    // If the requested resource has been created successfully,
    // the server MUST return a 201 Created status code.
    // The response SHOULD include a Location header identifying the location of the newly created resource.
    // The response MUST also include a document that contains the primary resource created.
    // If the resource object returned by the response contains a self key in its links member
    // and a Location header is provided, the value of the self member MUST match the value of the Location header.

    reply.header('location', document.data!.links!.self);
    reply.status(201).send(document);
    return { request, reply };
  };
}

const create: RouteConfiguration = (definition, options) => {
  return {
    schema: schema(definition, options),
    handler: async (request, reply) => {
      await sequence(request, reply, [
        verifyHandler(definition, 'create'),
        deserializeBody(),
        buildHandlerRequest(),
        checkForConflicts(definition),
        invokeHandler(definition),
        sendResponse(definition),
        endRoute()
      ]);
      return reply;
    }
  };
};

export default create;
