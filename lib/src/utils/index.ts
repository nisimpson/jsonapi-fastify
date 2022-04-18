import { RouteConfiguration } from '@routes/index';

export * from './error';
export * from './serializer';

export function createRouteConfiguration(config: RouteConfiguration): RouteConfiguration {
  return (def, options) => {
    const routeConfig = config(def, options);
    // fastify has a bug that does not initialize the preHandler route and
    // crashes if not defined.
    routeConfig.preHandler = async () => {};
    return routeConfig;
  };
}
