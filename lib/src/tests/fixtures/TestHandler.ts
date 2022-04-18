import { MemoryHandler } from "@handlers/MemoryHandler";
import { JsonapiHandler } from "@typings/jsonapi-fastify";


type PartialHandler<TItem> = Partial<JsonapiHandler<TItem>>;
type HandlerOverride<TItem> = Pick<
  PartialHandler<TItem>,
  'search' | 'create' | 'find' | 'update' | 'delete' | 'allowFilter' | 'allowSort'
>;

export interface Handler<TItem> extends JsonapiHandler<TItem> {
  base(): JsonapiHandler<TItem>;
  config(): HandlerOverride<TItem>;
  setConfig(config: HandlerOverride<TItem>): void;
  reset(): void;
}

function TestHandler<TItem = any>(config: HandlerOverride<TItem>): Handler<TItem> {
  const base = MemoryHandler();
  const store: any = { config };
  return {
    base: () => base,
    reset: () => (store.config = {}),
    config: () => store.config,
    setConfig: (cfg) => (store.config = cfg),
    pagination: 'offset',
    allowSort: config.allowSort ?? true,
    allowFilter: config.allowFilter ?? true,
    initialize(config, context) {
      base.initialize(config, context);
    },
    ready(operation) {
      return base.ready(operation);
    },
    close() {
      base.close();
    },
    search(params) {
      return store.config.search ? store.config.search(params) : base.search!(params);
    },
    find(params) {
      return store.config.find ? store.config.find(params) : base.find!(params);
    },
    create(params) {
      return store.config.create ? store.config.create(params) : base.create!(params);
    },
    update(params) {
      return store.config.update ? store.config.update(params) : base.update!(params);
    },
    delete(params) {
      return store.config.delete ? store.config.delete(params) : base.delete!(params);
    }
  };
}

export default TestHandler;
