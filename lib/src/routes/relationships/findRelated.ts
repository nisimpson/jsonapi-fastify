import { toFastifySchema } from '@config/validation';
import {
  buildHandlerRequest,
  buildSerializerFromRequest,
  endRoute,
  FastifyAsyncCallback,
  findIncludes,
  sequence,
  verifyHandler,
  verifySparseFieldsets
} from '@middleware/middleware';

import { isRelationDefinition } from '@schemas/fields';
import { documents } from '@schemas/schema';
import { JsonapiResourceDefinition } from '@typings/jsonapi-fastify';
import { SingleResourceDocument } from '@typings/jsonapi-spec';
import { JsonapiFastifyError } from '@utils/error';
import { foreignKeySearch } from '@utils/foreignKey';
import serializer from '@utils/serializer';
import { RouteSchema, RouteConfiguration } from '..';

const schema: RouteSchema = () => ({
  querystring: documents.querystring,
  headers: documents.headers(),
  response: {
    200: toFastifySchema(documents.response.any),
    401: toFastifySchema(documents.errors.error401Unauthorized),
    403: toFastifySchema(documents.errors.error403Forbidden),
    503: toFastifySchema(documents.errors.error503Unavailable)
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
        sendResponse(relationTypeDef),
        endRoute()
      ]);
      return reply;
    }
  };
};

export default findResource;
