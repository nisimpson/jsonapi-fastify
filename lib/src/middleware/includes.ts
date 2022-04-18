import { JsonapiResource, JsonapiContext, JsonapiRelation } from "src/@types";
import { isRelationDefinition } from "src/schemas/fields";
import { JsonapiFastifyError } from "src/utils";
import { FastifyAsyncCallback } from "./sequence";

export type IncludeGraph = Record<string, unknown>;

export function includesAsObjectGraph(includes: string[] = []): IncludeGraph {
  const result: IncludeGraph = {};
  for (const inclusion of includes) {
    const [target, ...nested] = inclusion.split('.');
    result[target] = includesAsObjectGraph(nested);
  }
  return result;
}

export async function foreignKeySearch(
  data: JsonapiResource,
  opts: {
    relation: string;
    context: JsonapiContext;
  }
): Promise<JsonapiRelation> {
  const type = data.type;
  const definition = opts.context.definitions[type];
  const relationSchema = definition.fields[opts.relation];

  if (!isRelationDefinition(relationSchema)) {
    throw new Error(`${opts.relation} is not a relationship on ${type}`);
  }

  const relationDef = opts.context.definitions[relationSchema.relation.type];

  if (relationDef === undefined) {
    throw new Error(`No definition for type ${relationSchema.relation.type}`);
  }

  const relationData = data[opts.relation] as JsonapiRelation;
  let foreignKeys: string[] = [];
  if (Array.isArray(relationData)) {
    foreignKeys = relationData.map((item) => item.id);
  } else {
    foreignKeys = relationData === null ? [] : [relationData.id];
  }

  const response = await relationDef.handlers.search?.({
    request: {
      ...opts.context.request!,
      params: {
        parent: {
          id: data.id,
          type: data.type,
          relation: opts.relation
        },
        filter: {
          id: foreignKeys
        }
      }
    },
    response: {
      ok: (result, count) => ({ result, count }),
      error: (errors: any) => {
        throw new JsonapiFastifyError(errors);
      },
      notFound: () => ({ result: [], count: 0 })
    }
  });

  const result = response?.result || [];
  if (relationSchema.relation.association === 'one') {
    return result[0];
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
