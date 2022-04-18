import { toFastifySchema, validateRelationship, validateRelationBody } from '@config/validation';
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
import { UpdateRelationshipOperation } from '@typings/handler';
import { JsonapiResourceDefinition, JsonapiResource } from '@typings/jsonapi-fastify';
import { RelatedResourceDocument } from '@typings/jsonapi-spec';
import { JsonapiFastifyError } from '@utils/error';
import serializer from '@utils/serializer';
import { RouteConfiguration } from '..';

const schema = (def: JsonapiResourceDefinition) => ({
  querystring: documents.querystring,
  headers: documents.headers({ body: true }),
  body: toFastifySchema(documents.request.relation(def)),
  response: {
    200: toFastifySchema(documents.response.relation(def)),
    202: toFastifySchema(documents.response.any),
    401: toFastifySchema(documents.errors.error401Unauthorized),
    403: toFastifySchema(documents.errors.error403Forbidden),
    409: toFastifySchema(documents.errors.error409Conflict),
    503: toFastifySchema(documents.errors.error503Unavailable)
  }
});

const invoke = (
  def: JsonapiResourceDefinition,
  opts: {
    relation: string;
    operation: UpdateRelationshipOperation;
  }
): FastifyAsyncCallback => {
  return async (params) => {
    const { request, reply } = params;
    const context = reply.jsonapi;
    const data: JsonapiResource = { id: context.params(request).id!, type: def.resource };
    data[opts.relation] = context.resource;

    const response = await def.handlers.update!({
      request: context.request!,
      operation: opts.operation,
      data,
      response: {
        ok: (result) => {
          if (result === undefined) {
            reply.status(204).send();
            return {};
          }
          return { result: result[opts.relation] };
        },
        notFound: () => {
          reply.callNotFound();
          return {};
        },
        error: (errors) => {
          throw new JsonapiFastifyError(errors);
        },
        conflict: () => {
          reply.status(409).send();
          return {};
        },
        accepted: (meta) => {
          reply.status(202).send({ meta });
          return {};
        }
      }
    });
    context.response = response;
    return params;
  };
};

const sendResponse = (): FastifyAsyncCallback => {
  return async (params) => {
    const context = params.reply.jsonapi;

    if (context.response?.result === undefined) {
      throw new Error('Must provide result data on response');
    }

    const result = context.response.result;
    const options = buildSerializerFromRequest(params.request);
    const document = serializer.serialize(result, options) as RelatedResourceDocument;
    context.document = document;
    params.reply.status(200).send(document);
    return params;
  };
};

type ConfigParams = Parameters<RouteConfiguration>;

type UpdateRelationshipConfiguration = (
  definition: ConfigParams[0],
  options: ConfigParams[1],
  operation: UpdateRelationshipOperation
) => ReturnType<RouteConfiguration>;

const updateRelationship: UpdateRelationshipConfiguration = (def, _, operation) => {
  return {
    schema: schema(def),
    handler: async function __removeRelationship(request, reply) {
      const context = request.jsonapi;
      const relation = context.params(request).relation!;

      await sequence(request, reply, [
        validateRelationship(def, relation),
        verifyHandler(def, 'update'),
        validateRelationBody(def),
        deserializeBody(),
        buildHandlerRequest(),
        invoke(def, { relation, operation }),
        sendResponse(),
        endRoute()
      ]);
      return reply;
    }
  };
};

export const decorate = (operation: UpdateRelationshipOperation): RouteConfiguration => {
  return (def, options) => updateRelationship(def, options, operation);
};
