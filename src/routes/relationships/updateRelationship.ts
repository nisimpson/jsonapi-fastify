import { SerializerOptions } from 'jsonapi-serializer';
import { JsonapiResourceDefinition } from '../../@types';
import { UpdateRelationshipOperation } from '../../@types/handler';
import { RouteConfiguration } from '..';
import { request, response, validation } from '../../schemas';
import {
  buildHandlerRequest,
  buildSerializerOptions,
  deserializeRequestBody,
  endRoute,
  FastifyAsyncCallback,
  JsonapiFastifyError,
  sequence,
  verifyHandler
} from '../../utils';
import { UpdateRelationDocument } from 'jsonapi-spec';
import { toFastifySchema } from '../../schemas/common';
import { RelationalField } from 'src/schemas/fields';

const schema = (def: JsonapiResourceDefinition) => ({
  querystring: request.QUERYSTRING,
  headers: request.HEADERS(),
  response: {
    200: toFastifySchema(response.RELATION_OK_200(def)),
    202: toFastifySchema(response.ACCEPTED_202),
    403: toFastifySchema(response.FORBIDDEN_403),
    503: toFastifySchema(response.UNAVAILABLE_503)
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
    const { reply } = params;
    const context = reply.jsonapi;
    context.response = await def.handlers.update!({
      request: context.request!,
      operation: opts.operation,
      data: context.resource!,
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
    return params;
  };
};

const sendResponse = (def: JsonapiResourceDefinition, relation: string): FastifyAsyncCallback => {
  return async (params) => {
    const context = params.reply.jsonapi;

    if (context.response?.result === undefined) {
      throw new Error('Must provide result data on response');
    }

    const result = context.response.result;
    const type = def.resource;
    const options = context.serializerOptions;

    // extract the relation serialization options
    const relationOptions: SerializerOptions = options[relation];

    const schema = def.fields[relation] as RelationalField;
    if (schema.relation.association === 'many') {
      relationOptions.meta = {
        count: result.length
      };
    }

    const serializer = context.serializer(type, relationOptions);
    const document: UpdateRelationDocument = serializer.serialize(result);
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

const { validateRelationship, validateRelationBody } = validation;

const updateRelationship: UpdateRelationshipConfiguration = (def, _, operation) => {
  return {
    schema: schema(def),
    handler: async function __removeRelationship(request, reply) {
      const context = request.jsonapi;
      const relation = context.params(request).relation!;

      await sequence(request, reply, [
        validateRelationship(def, relation),
        verifyHandler(def, 'update'),
        validateRelationBody(def, relation),
        deserializeRequestBody(def, { relation }),
        buildHandlerRequest(),
        invoke(def, { relation, operation }),
        buildSerializerOptions(def.resource),
        sendResponse(def, relation),
        endRoute()
      ]);
      return reply;
    }
  };
};

export const decorate = (operation: UpdateRelationshipOperation): RouteConfiguration => {
  return (def, options) => updateRelationship(def, options, operation);
};
