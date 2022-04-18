import { RelatedResourceDocument } from 'src/@types/jsonapi-spec';
import { JsonapiResourceDefinition } from 'src/@types';
import { toFastifySchema, validateRelationship } from 'src/config/validation';
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
import { RouteSchema, RouteConfiguration } from '..';

const schema: RouteSchema = (def) => ({
  querystring: documents.querystring,
  headers: documents.headers(),
  response: {
    200: toFastifySchema(documents.response.relation(def)),
    403: toFastifySchema(documents.error403Forbidden),
    503: toFastifySchema(documents.error503Unavailable)
  }
});

const invoke = (def: JsonapiResourceDefinition, relation: string): FastifyAsyncCallback => {
  return async (params) => {
    const { reply } = params;
    const context = reply.jsonapi;
    context.response = await def.handlers.find!({
      request: context.request!,
      response: {
        ok: (result) => {
          return { result: result[relation] };
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

const findRelationship: RouteConfiguration = (def, options) => {
  return {
    schema: schema(def, options),
    handler: async (request, reply) => {
      const context = request.jsonapi;
      const relation = context.params(request).relation!;
      await sequence(request, reply, [
        validateRelationship(def, relation),
        verifySparseFieldsets(),
        verifyHandler(def, 'find'),
        buildHandlerRequest(),
        invoke(def, relation),
        findIncludes(),
        sendResponse(),
        endRoute()
      ]);
      return reply;
    }
  };
};

export default findRelationship;
