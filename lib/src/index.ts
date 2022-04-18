import { MemoryHandler } from '@handlers/MemoryHandler';
import { ResourceHandler } from '@handlers/ResourceHandler';
import fields from '@schemas/fields';
import { JsonapiFastifyOptions, JsonapiResourceDefinition } from '@typings/jsonapi-fastify';
import fastify, { FastifyInstance } from 'fastify';
import config from './config';

const jsonapiFastify = (options: JsonapiFastifyOptions): FastifyInstance => {
  const { serverOptions, plugin } = config(options);
  const server = fastify(serverOptions);
  server.register(plugin, options);
  server.ready(() => {
    server.log.info('JSONAPI server is ready!');
  });
  return server;
};

type DefineCallbackArgs = typeof fields;
type DefineCallback<TItem> = (args: DefineCallbackArgs) => JsonapiResourceDefinition<TItem>;

export function define<TItem>(callback: DefineCallback<TItem>): JsonapiResourceDefinition<TItem> {
  const definition = callback(fields);
  return definition;
}

export { MemoryHandler, ResourceHandler };
export default jsonapiFastify;
