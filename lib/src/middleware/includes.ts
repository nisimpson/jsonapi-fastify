import { JsonapiResource } from '@typings/jsonapi-fastify';
import { foreignKeySearch } from '@utils/foreignKey';
import { FastifyAsyncCallback } from './sequence';

export type IncludeGraph = Record<string, unknown>;

export function includesAsObjectGraph(includes: string[] = []): IncludeGraph {
  const result: IncludeGraph = {};
  for (const inclusion of includes) {
    const [target, ...nested] = inclusion.split('.');
    result[target] = includesAsObjectGraph(nested);
  }
  return result;
}

export function findIncludes(): FastifyAsyncCallback {
  return async (params) => {
    const context = params.reply.jsonapi;
    const result = context.response.result!;

    // a null or empty result has no inclusions.
    if (result === null || undefined) {
      return params;
    }

    async function process(inclusion: string, opts: { data: JsonapiResource }): Promise<boolean> {
      const [target, ...nested] = inclusion.split('.');
      if (target === '') {
        return false;
      }
      const relationData: any = await foreignKeySearch(opts.data, {
        relation: target,
        context
      });
      opts.data[target] = relationData;
      if (relationData && Array.isArray(relationData)) {
        for (const item of relationData) {
          await process(nested.join(','), { data: item });
        }
      } else if (relationData) {
        await process(nested.join('.'), { data: relationData });
      }
      return true;
    }

    type QueryWithIncludes = { include: string[] };
    const query = params.request.query as QueryWithIncludes;
    const { include = [] } = query;
    const items = Array.isArray(result) ? result : [result];

    for (const data of items) {
      for (const inclusion of include) {
        await process(inclusion, { data: data });
      }
    }

    return params;
  };
}
