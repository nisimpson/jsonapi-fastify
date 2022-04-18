import {
  FastifyInstance,
  FastifyReply,
  FastifyServerOptions,
  FastifyPluginCallback
} from 'fastify';
import { JsonapiFastifyOptions } from 'src/@types';
import { sequence } from 'src/middleware';
import { registerRoutes } from 'src/routes';
import { MEDIA_TYPE } from 'src/schemas/schema';
import { setErrorHandling } from 'src/utils';
import createJsonapiContext from './context';
import { buildQueryParser, setContentParser } from './querystring';
import { defaultValidationCompiler, ValidationSchema } from './validation';

function setDecorators(fastify: FastifyInstance): void {
  fastify.log.debug('adding decorators');
  fastify.decorateReply('jsonapi', null);
}

function setContentType(reply: FastifyReply) {
  reply.header('content-type', MEDIA_TYPE);
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

export function setValidation(fastify: FastifyInstance): void {
  fastify.log.debug('adding validator');

  fastify.setValidatorCompiler((params) => {
    const { httpPart } = params;
    return (data: unknown) => {
      fastify.log.trace(`validating http part: ${httpPart}`);
      return defaultValidationCompiler(params)(data);
    };
  });
}

export function setSerializer(fastify: FastifyInstance): void {
  fastify.log.debug('adding serializer');
  fastify.setSerializerCompiler((params) => {
    return (data) => {
      const schema = params.schema as ValidationSchema;
      fastify.log.trace('serializing payload');
      if (schema) {
        data = schema.properties.parse(data);
      }
      return JSON.stringify(data);
    };
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
  setValidation(fastify);
  setSerializer(fastify);
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
