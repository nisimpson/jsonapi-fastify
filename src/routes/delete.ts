import { response } from '../schemas';
import {
  buildHandlerRequest,
  endRoute,
  sequence,
  verifyHandler,
  JsonapiFastifyError,
  FastifyAsyncCallback
} from '../utils';
import { RouteConfiguration, RouteSchema } from '.';
import { JsonapiResourceDefinition } from '../@types';
import { toFastifySchema } from '../schemas/common';

const schema: RouteSchema = () => ({
  response: {
    200: toFastifySchema(response.DOCUMENT),
    202: toFastifySchema(response.ACCEPTED_202),
    403: toFastifySchema(response.FORBIDDEN_403),
    503: toFastifySchema(response.UNAVAILABLE_503)
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
