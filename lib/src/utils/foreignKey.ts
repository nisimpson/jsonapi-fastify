import { isRelationDefinition } from '@schemas/fields';
import { JsonapiResource, JsonapiContext, JsonapiRelation } from '@typings/jsonapi-fastify';
import { JsonapiFastifyError } from './error';

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

  const response = await relationDef.handler.search?.({
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
