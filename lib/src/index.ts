import { MemoryHandler } from '@handlers/MemoryHandler';
import { ResourceHandler } from '@handlers/ResourceHandler';
import fields from '@schemas/fields';
import { JsonapiFastifyOptions, JsonapiResourceDefinition } from '@typings/jsonapi-fastify';
import fastify, { FastifyInstance } from 'fastify';
import config from './config';
import { generateOpenapiDocument } from '@routes/openapi';
import { OpenAPIObject } from 'openapi3-ts';

export interface JsonapiFastifyInstance extends FastifyInstance {
  init(): void;
  openapiDoc(): OpenAPIObject;
}

export const jsonapiFastify = (options: JsonapiFastifyOptions): JsonapiFastifyInstance => {
  const { serverOptions, plugin } = config(options);
  const server = fastify(serverOptions);
  const store = { initialized: false };
  return Object.assign(server, {
    init() {
      if (!store.initialized) {
        store.initialized = true;
        server.register(plugin, options).ready((err) => {
          if (err) {
            console.error('The server initialization failed', err);
          } else {
            server.log.info('JSONAPI server is ready!');
          }
        });
      }
    },
    openapiDoc: () => generateOpenapiDocument(options)
  });
};

type DefineCallbackArgs = typeof fields;
type DefineCallback<TItem> = (args: DefineCallbackArgs) => JsonapiResourceDefinition<TItem>;

export function define<TItem>(callback: DefineCallback<TItem>): JsonapiResourceDefinition<TItem> {
  const definition = callback(fields);
  return definition;
}

export { MemoryHandler, ResourceHandler };
export default jsonapiFastify;
