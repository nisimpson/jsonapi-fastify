import type { JsonapiFastifyOptions, JsonapiResourceDefinition } from './@types';
import fastify, { FastifyInstance } from 'fastify';
import config from './config';
import fields from './schemas/fields';
export { MemoryHandler } from './handlers/MemoryHandler';
export { ResourceHandler } from './handlers/ResourceHandler';

export const server = (options: JsonapiFastifyOptions): FastifyInstance => {
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
