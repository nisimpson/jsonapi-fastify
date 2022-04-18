import { JsonapiRequest } from '../@types';
import { FastifyAsyncCallback } from './sequence';

export * from './sequence';
export * from './pagination';
export * from './serialization';
export * from './includes';
export * from './verification';

export function buildHandlerRequest(): FastifyAsyncCallback {
  return async (params) => {
    const query: any = params.request.query;
    const paths: any = params.request.params;
    const jsonapiRequest: JsonapiRequest = {
      query: { ...query },
      params: { ...paths },
      fastify: {
        request: params.request,
        reply: params.reply
      }
    };
    if (params.request.body) {
      jsonapiRequest.params.resource = params.request.body;
    }
    params.reply.jsonapi.request = Object.freeze(jsonapiRequest);
    return params;
  };
}

export function endRoute(): FastifyAsyncCallback {
  return async (params) => {
    if (params.reply.sent) {
      return params;
    }
    // if we got here, and haven't sent yet, something is wrong
    throw new Error('No response sent! Uh oh...');
  };
}
