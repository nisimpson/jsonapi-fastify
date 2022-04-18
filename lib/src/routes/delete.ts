import { JsonapiResourceDefinition } from 'src/@types';
import { toFastifySchema } from 'src/config/validation';
import {
  FastifyAsyncCallback,
  sequence,
  verifyHandler,
  buildHandlerRequest,
  endRoute
} from 'src/middleware';
import { documents } from 'src/schemas/schema';
import { JsonapiFastifyError } from 'src/utils';
import { RouteSchema, RouteConfiguration } from '.';

const schema: RouteSchema = () => ({
  querystring: documents.querystring,
  headers: documents.headers(),
  response: {
    200: toFastifySchema(documents.response.any),
    202: toFastifySchema(documents.response.any),
    403: toFastifySchema(documents.error403Forbidden),
    503: toFastifySchema(documents.error503Unavailable)
  }
});

const invoke = (def: JsonapiResourceDefinition): FastifyAsyncCallback => {
  return async (params) => {
    const { reply } = params;
    const context = reply.jsonapi;
    context.response = await def.handlers.delete!({
      request: context.request!,
      response: {
        ok: (meta) => {
          if (meta !== undefined) {
            reply.status(200).send({ meta });
          } else {
            reply.status(204).send();
          }
          return {};
        },
        accepted: (meta) => {
          reply.status(202).send({ meta });
          return {};
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

const deleteResource: RouteConfiguration = (def, options) => {
  return {
    schema: schema(def, options),
    handler: async (request, reply) => {
      await sequence(request, reply, [
        verifyHandler(def, 'delete'),
        buildHandlerRequest(),
        invoke(def),
        endRoute()
      ]);
      return reply;
    }
  };
};

export default deleteResource;
