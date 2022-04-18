import { JsonapiResourceDefinition, JsonapiFastifyOptions } from '@typings/jsonapi-fastify';
import { FastifySchema, RouteShorthandOptionsWithHandler, FastifyInstance } from 'fastify';
import deleteResource from './delete';
import findResource from './find';
import openapi from './openapi';
import relationships from './relationships';
import search from './search';
import create from './create';
import update from './update';

type RouteFunction<TOut> = (
  definition: JsonapiResourceDefinition,
  options: JsonapiFastifyOptions
) => TOut;

export type RouteSchema = RouteFunction<FastifySchema>;
export type RouteConfiguration = RouteFunction<RouteShorthandOptionsWithHandler>;

function registerResourceRoutes(
  def: JsonapiResourceDefinition,
  fastify: FastifyInstance,
  options: JsonapiFastifyOptions
) {
  const { resource: type } = def;

  // fetching
  fastify.get(`/${type}`, search(def, options));
  fastify.get(`/${type}/:id`, findResource(def, options));
  fastify.get(`/${type}/:id/relationships/:relation`, relationships.find(def, options));
  fastify.get(`/${type}/:id/:relation`, relationships.related(def, options));

  // creating
  fastify.post(`/${type}`, create(def, options));
  fastify.post(`/${type}/:id/relationships/:relation`, relationships.add(def, options));

  // updating
  fastify.patch(`/${type}/:id`, update(def, options));
  fastify.patch(`/${type}/:id/relationships/:relation`, relationships.update(def, options));

  // deleting
  fastify.delete(`/${type}/:id`, deleteResource(def, options));
  fastify.delete(`/${type}/:id/relationships/:relation`, relationships.remove(def, options));
}

export function registerRoutes(fastify: FastifyInstance, options: JsonapiFastifyOptions): void {
  // apply resource based routes
  fastify.log.debug('creating route definitions');

  // openapi doc
  fastify.get('/openapi.json', openapi());

  for (const definition of options.definitions) {
    fastify.log.trace(`creating route definition: ${definition.resource}`);
    registerResourceRoutes(definition, fastify, options);
  }
}
