import type {
  FastifyInstance,
  FastifyPluginCallback,
  FastifyReply,
  FastifyServerOptions
} from 'fastify';
import { JsonapiFastifyOptions } from '../@types';
import { sequence, setErrorHandling } from '../utils';
import createJsonapiContext from './context';
import { setValidationAndSerialization } from '../schemas';
import { registerRoutes } from '../routes';
import { setContentParser, buildQueryParser } from './parsing';
import { CONTENT_TYPE } from '../schemas/common';

function setDecorators(fastify: FastifyInstance): void {
  fastify.log.debug('adding decorators');
  fastify.decorateReply('jsonapi', null);
}

function setContentType(reply: FastifyReply) {
  reply.header('content-type', CONTENT_TYPE);
}

function initializeHandlers(reply: FastifyReply) {
  const jsonapi = reply.jsonapi;
  for (const definition of Object.values(jsonapi.definitions)) {
    definition.handlers.initialize(definition, jsonapi);
  }
}

export function setHooks(fastify: FastifyInstance, options: JsonapiFastifyOptions): void {
  fastify.log.debug('adding request hooks');

  // on each request...
  fastify.addHook('onRequest', async (request, reply) => {
    reply.log.trace('request hook triggered');
    request.log = request.log.child({ plugin: 'jsonapi-fastify' });
    reply.log = reply.log.child({ plugin: 'jsonapi-fastify' });

    await sequence(request, reply, [
      // create the context store
      createJsonapiContext(fastify, options)
    ]);
  });

  // before we handle...
  fastify.addHook('preHandler', async (_, reply) => {
    reply.log.trace('pre handler hook triggered');
    initializeHandlers(reply);
  });

  // before we serialize...
  fastify.addHook('preSerialization', async (_, reply) => {
    reply.log.trace('pre serialize hook triggered');
    setContentType(reply);
  });

  // before we send...
  fastify.addHook('onSend', async (_, reply) => {
    reply.log.trace('send hook triggered');
    setContentType(reply);
  });

  fastify.addHook('onResponse', async (_, reply) => {
    reply.log.trace('response hook triggered');
  });
}

export function JsonapiServerOptions(options: JsonapiFastifyOptions): FastifyServerOptions {
  const { querystringParser } = buildQueryParser();
  return {
    logger: {
      level: options?.loggerLevel ?? 'info',
      prettyPrint: options?.test ? true : false
    },
    // schema validation is done via zod instead of json schemas
    jsonShorthand: false,
    querystringParser
  };
}

type PluginCallback = FastifyPluginCallback<JsonapiFastifyOptions>;

const jsonapi: PluginCallback = (fastify, options, done) => {
  fastify.log = fastify.log.child({ plugin: 'jsonapi-fastify' });
  fastify.log.info('register jsonapi-fastify plugin');
  setDecorators(fastify);
  setHooks(fastify, options);
  setErrorHandling(fastify);
  setValidationAndSerialization(fastify);
  setContentParser(fastify);
  registerRoutes(fastify, options);
  fastify.log.info('register jsonapi-fastify plugin completed');
  done();
};

type JsonapiServerConfig = {
  serverOptions: FastifyServerOptions;
  plugin: PluginCallback;
};

export default function config(options: JsonapiFastifyOptions): JsonapiServerConfig {
  return {
    serverOptions: JsonapiServerOptions(options),
    plugin: jsonapi
  };
}
