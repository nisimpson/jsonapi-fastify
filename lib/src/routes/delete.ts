import { toFastifySchema } from '@config/validation';
import {
  FastifyAsyncCallback,
  sequence,
  verifyHandler,
  buildHandlerRequest,
  endRoute
} from '@middleware/middleware';
import { documents } from '@schemas/schema';
import { JsonapiResourceDefinition } from '@typings/jsonapi-fastify';
import { JsonapiFastifyError } from '@utils/error';
import { RouteSchema, RouteConfiguration } from '.';

const schema: RouteSchema = () => ({
  querystring: documents.querystring,
  headers: documents.headers(),
  response: {
    200: toFastifySchema(documents.response.any),
    202: toFastifySchema(documents.response.any),
    401: toFastifySchema(documents.errors.error401Unauthorized),
    403: toFastifySchema(documents.errors.error403Forbidden),
    503: toFastifySchema(documents.errors.error503Unavailable)
  }
});

const invoke = (def: JsonapiResourceDefinition): FastifyAsyncCallback => {
  return async (params) => {
    const { reply } = params;
    const context = reply.jsonapi;
    context.response = await def.handler.delete!({
      request: context.request!,
      response: {
        ok: (meta) => {
          if (meta !== undefined) {
            reply.status(200).send({
              meta: {
                ...context.options.meta,
                ...meta
              }
            });
          } else {
            reply.status(204).send();
          }
          return {};
        },
        accepted: (meta) => {
          reply.status(202).send({
            meta: {
              ...context.options.meta,
              ...meta
            }
          });
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
