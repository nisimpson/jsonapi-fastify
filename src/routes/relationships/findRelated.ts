import { request, response } from '../../schemas';
import {
  buildHandlerRequest,
  buildSerializerOptions,
  endRoute,
  findIncludes,
  foreignKeySearch,
  sequence,
  verifyHandler,
  JsonapiFastifyError,
  verifySparseFieldsets
} from '../../utils';
import { RouteConfiguration, RouteSchema } from '..';
import { JsonapiResourceDefinition } from '../../@types';
import { FastifyAsyncCallback } from '../../utils';
import { SingleResourceDocument } from 'jsonapi-spec';
import { isRelationDefinition } from '../../schemas/fields';
import { toFastifySchema } from '../../schemas/common';

const schema: RouteSchema = () => ({
  querystring: request.QUERYSTRING,
  headers: request.HEADERS(),
  response: {
    200: toFastifySchema(response.RESOURCE_OK_200()),
    403: toFastifySchema(response.FORBIDDEN_403),
    503: toFastifySchema(response.UNAVAILABLE_503)
  }
});

const findPrimary = (def: JsonapiResourceDefinition): FastifyAsyncCallback => {
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

const findRelated = (relation: string): FastifyAsyncCallback => {
  return async (args) => {
    const context = args.reply.jsonapi;
    const result = context.response.result;

    if (context.isSingleResource(result)) {
      // retrieve related resources
      const related = await foreignKeySearch(result, {
        relation,
        context
      });
      context.response!.result = related ?? undefined;
      return args;
    }

    throw new Error('Find related should only operate on a single resource');
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
      const relation = request.jsonapi.params(request).relation!;
      const field = def.fields[relation];

      if (!isRelationDefinition(field)) {
        reply.callNotFound();
        return reply;
      }

      const relationType = field.relation.type;
      const relationTypeDef = request.jsonapi.definitions[relationType];

      await sequence(request, reply, [
        verifySparseFieldsets(),
        // we need to verify the handlers for both the primary data
        // and the related data.
        verifyHandler(def, 'find'),
        verifyHandler(relationTypeDef, 'search'),
        buildHandlerRequest(),
        findPrimary(def),
        findRelated(relation),
        findIncludes(),
        buildSerializerOptions(relationType),
        sendResponse(relationTypeDef),
        endRoute()
      ]);
      return reply;
    }
  };
};

export default findResource;
