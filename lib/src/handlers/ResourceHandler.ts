import { JsonapiHandler } from '@typings/jsonapi-fastify';

type UpdateRelationship<TResource> = JsonapiHandler<TResource>['update'];
type BaseHandler<TResource> = Partial<JsonapiHandler<TResource>>;

interface Options<TResource> extends BaseHandler<TResource> {
  relationships?: {
    [key: string]: {
      /**
       * Invoked when the client wishes to replace the target resource relationship
       * with the specified payload.
       */
      set: UpdateRelationship<TResource>;
      /**
       * Invoked when the client wishes to add specified resources to
       * the target resource 'to-many' relationship.
       */
      add: UpdateRelationship<TResource>;
      /**
       * Invoked when the client wishes to remove specified resources from
       * the target resource 'to-many' relationship.
       */
      remove: UpdateRelationship<TResource>;
    };
  };
}

/**
 * Creates a new Resource handler instance.
 * @param options Configuration options.
 * @returns A new ResourceHandler instance.
 */
export function ResourceHandler<TResource = any>(
  options: Options<TResource>
): JsonapiHandler<TResource> {
  return {
    allowSort: options.allowSort ?? true,
    allowFilter: options.allowFilter ?? true,
    pagination: options.pagination ?? 'offset',
    initialize(config, context) {
      return options.initialize?.(config, context);
    },
    ready(operation) {
      return options.ready ? options.ready(operation) : true;
    },
    close() {
      return options.close?.();
    },
    find: options.find,
    create: options.create,
    delete: options.delete,
    async update(params) {
      const operation = params.operation;
      if (options.update && operation === 'update') {
        return options.update(params);
      }
      if (operation.includes('relationship')) {
        const relation = params.request.params.relation!;
        const relationships = options.relationships ?? {};
        const handler = relationships[relation];
        if (handler?.add && operation === 'relationship:add') {
          return handler.add(params);
        }
        if (handler?.remove && operation === 'relationship:remove') {
          return handler.remove(params);
        }
        if (handler?.set && operation === 'relationship:update') {
          return handler.set(params);
        }
      }
      // send a 403 forbidden, as the associated handler is not implemented
      // and therefore not supported.
      params.request.fastify.reply.status(403).send({});
      return {};
    }
  };
}
