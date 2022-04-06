import type { JsonapiRequest, JsonapiResource, JsonapiResourceDefinition } from '../@types';
import type { SingleResourceDocument } from 'jsonapi-spec';
import { request, response } from '../schemas';
import {
  endRoute,
  sequence,
  verifyHandler,
  FastifyAsyncCallback,
  deserializeRequestBody,
  buildHandlerRequest,
  buildSerializerOptions
} from '../utils';
import type { RouteConfiguration, RouteSchema } from '.';
import { JsonapiFastifyError } from '../utils/error';
import { toFastifySchema } from '../schemas/common';

const schema: RouteSchema = (definition) => ({
  headers: request.HEADERS({ create: true }),
  querystring: request.QUERYSTRING,
  body: toFastifySchema(request.CREATE(definition)),
  response: {
    201: toFastifySchema(response.RESOURCE_OK_200(definition)),
    202: toFastifySchema(response.ACCEPTED_202),
    403: toFastifySchema(response.FORBIDDEN_403),
    409: toFastifySchema(response.CONFLICT_409),
    503: toFastifySchema(response.UNAVAILABLE_503)
  }
});

function checkForConflicts({
  resource: type,
  handlers
}: JsonapiResourceDefinition): FastifyAsyncCallback {
  return async (params) => {
    const jsonapi = params.reply.jsonapi;
    const resource = jsonapi.resource as JsonapiResource;
    if (resource?.id) {
      // check if a resource exists with the client provided id
      if (handlers.find === undefined) {
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
      const { result } = await handlers.find({
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
    resource.id = resource.id ?? definition.idGenerator();
    jsonapi.response = await definition.handlers.create!({
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

function sendResponse(def: JsonapiResourceDefinition): FastifyAsyncCallback {
  return async ({ request, reply }) => {
    const context = reply.jsonapi;
    const type = def.resource;
    const hasResult = context.response?.result !== undefined;

    // If a POST request did include a Client-Generated ID
    // and the requested resource has been created successfully,
    // the server returns 204 No Content status code if no response document.

    if (def.allowClientIdOnCreate && !hasResult) {
      reply.status(204).send();
      return { request, reply };
    }

    if (!hasResult) {
      throw new Error('Missing response data from request');
    }

    // If we are here, then we have a response document; serialize.
    const result = context.response.result;
    context.serializerOptions.dataMeta = context.response?.meta;
    const serializer = context.serializer(type, context.serializerOptions);
    const document: SingleResourceDocument = serializer.serialize(result);
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
        deserializeRequestBody(definition),
        buildHandlerRequest(),
        checkForConflicts(definition),
        invokeHandler(definition),
        buildSerializerOptions(definition.resource),
        sendResponse(definition),
        endRoute()
      ]);
      return reply;
    }
  };
};

export default create;
