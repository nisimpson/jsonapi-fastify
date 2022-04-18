import { JsonapiContext, JsonapiHandler, JsonapiResourceDefinition } from '../@types';

type State = {
  context?: JsonapiContext;
  config?: JsonapiResourceDefinition;
};

interface Instance extends JsonapiHandler {
  state: State;
}

export function MemoryHandler(): JsonapiHandler {
  const instance: Instance = {
    allowSort: true,
    allowFilter: true,
    state: {},
    pagination: 'offset',
    ready(operation) {
      const { log } = instance.state.context!;
      log.info('memory handler: ready');
      log.info(`memory handler: ${operation}`);
      return true;
    },
    initialize(config, context) {
      const { log } = context;
      instance.state.context = context;
      instance.state.config = config;
      log.info('memory handler: initialize');
    },
    close: () => {
      instance.state.context!.log.info('memory handler: close');
    },
    async search({ response }) {
      const { config, context } = instance.state;
      context!.log.info(`memory handler: search '${config?.resource}'`);
      const examples = [...config!.examples];
      return response.ok(examples);
    },
    async find({ request, response }) {
      const { config, context } = instance.state;
      context!.log.info(`memory handler: find '${config?.resource}'`);
      const examples = config!.examples;
      const result = examples.find((item) => item.id === request.params.id);
      if (result) {
        return response.ok(result);
      }
      return response.notFound();
    },
    async update({ request, operation, data, response }) {
      const { config, context } = instance.state;
      context!.log.info(`memory handler: update '${config?.resource}'`);
      const examples = config!.examples;
      const target = examples.find((item) => item.id === request.params.id);
      if (target === undefined) {
        return response.notFound();
      }
      if (operation === 'relationship:add') {
        context!.log.info(`memory handler: operation ${operation} '${config?.resource}'`);
        const relation = request.params.relation!;
        target[relation] = [...target.relation, ...data[relation]];
        return response.ok(target);
      }
      if (operation === 'relationship:remove') {
        context!.log.info(`memory handler: operation ${operation} '${config?.resource}'`);
        const relation = request.params.relation!;
        const toRemove = data[relation].map((item: any) => item.id);
        const relationStore = [];
        for (const item of target[relation]) {
          if (!toRemove.includes(item.id)) {
            relationStore.push(item);
          }
        }
        target[relation] = relationStore;
        return response.ok(target);
      }
      if (operation === 'relationship:update') {
        context!.log.info(`memory handler: operation ${operation} '${config?.resource}'`);
        const relation = request.params.relation!;
        target[relation] = data[relation];
        return response.ok(target);
      }
      Object.assign(target, { ...data });
      return response.ok(target);
    },
    async delete({ request, response }) {
      const { config, context } = instance.state;
      context!.log.info(`memory handler: delete '${config?.resource}'`);
      const examples = config!.examples;
      const index = examples.findIndex((item) => item.id === request.params.id);
      if (index === -1) {
        return response.notFound();
      }
      examples.splice(index, 1);
      return response.ok();
    },
    async create({ data, response }) {
      const { config, context } = instance.state;
      context!.log.info(`memory handler: create '${config?.resource}'`);
      const examples = config!.examples;
      if (data.id) {
        const index = examples.findIndex((item) => item.id === data.id);
        if (index !== -1) {
          return response.conflict();
        }
      }
      data.type = config?.resource;
      examples.push(data);
      return response.ok(data);
    }
  };
  return instance;
}
