import { FastifyRequest } from 'fastify';
import { Meta } from 'src/@types/jsonapi-spec';
import { JsonapiQuery, JsonapiRelation, JsonapiResource } from 'src/@types';
import { RelationalField } from 'src/schemas/fields';
import { SerializationOptions, ResourceSerializationOptions } from 'src/utils';
import serializer from 'src/utils/serializer';
import { FastifyAsyncCallback } from './sequence';

export function relationshipMeta(def: RelationalField): Meta {
  if (def.relation.foreign) {
    return {
      relation: 'foreign',
      belongsTo: def.relation.type,
      as: def.relation.as,
      many: def.relation.association === 'many',
      readOnly: true
    };
  }
  return {
    relation: 'primary',
    readOnly: false
  };
}

function allowFieldIfSparse(
  field: string,
  opts: {
    query: JsonapiQuery;
    resource: string;
  }
): boolean {
  if (opts.query.fields === undefined) {
    return true;
  }
  if (opts.query.fields[opts.resource] === undefined) {
    return true;
  }
  return opts.query.fields[opts.resource].includes(field);
}

export function deserializeBody(): FastifyAsyncCallback {
  return async (params) => {
    // if we've reached this point, then the fastify validator will have
    // ensured that a valid request body exists.
    const document: any = params.request.body;
    params.request.jsonapi.resource = serializer.deserialize(document) as JsonapiRelation;
    return params;
  };
}

export function buildSerializerFromRequest(request: FastifyRequest) {
  const context = request.jsonapi;
  const prefix = context.baseUrl;
  const query = context.query(request);
  const options: SerializationOptions = {
    id: (data: JsonapiResource) => data.id,
    type: (data: JsonapiResource) => data.type,
    included(path: string): boolean {
      if (query.include) {
        return query.include.reduce<boolean>((acc, cur) => {
          return acc || cur.startsWith(path);
        }, false);
      }
      return false;
    },
    links: {
      self: () => `${prefix}${request.url}`
    },
    meta: (data) => {
      if (Array.isArray(data)) {
        return {
          ...context.response?.meta,
          count: data.length
        };
      }
      return context.response?.meta;
    },
    dataLinks: {
      self: (current, _, { id, type }) => {
        // http://example.com/people/9c0cba2f-7489-49a9-9192-27404c8f97b4
        return `${prefix}/${type(current)}/${id(current)}`;
      }
    },
    dataMeta: (data: JsonapiResource) => data.$meta as Meta,
    relationshipLinks: {
      self: (_, parent, { id, type, ref }) => {
        return `${prefix}/${type(parent)}/${id(parent)}/relationships/${ref}`;
      },
      related: (_, parent, { id, type, ref }) => {
        return `${prefix}/${type(parent)}/${id(parent)}/${ref}`;
      }
    },
    relationshipMeta: (current, parent, { type, ref }) => {
      const parentType = context.definitions[type(parent)];
      const schema = parentType.fields[ref!] as RelationalField;
      if (schema.relation.foreign) {
        return {
          relation: 'foreign',
          belongsTo: schema.relation.type,
          as: schema.relation.as,
          many: schema.relation.association === 'many',
          readOnly: true
        };
      }
      if (Array.isArray(current)) {
        return {
          relation: 'primary',
          readOnly: false,
          many: true,
          count: current.length
        };
      }
      if (current) {
        return {
          relation: 'primay',
          readOnly: false,
          many: schema.relation.association === 'many'
        };
      }
    },
    resources: context.options.definitions.reduce(
      (acc: Record<string, ResourceSerializationOptions>, def) => {
        const resource = def.resource;
        const attributes: string[] = [];
        const relationships: string[] = [];
        for (const [key, value] of Object.entries(def.fields)) {
          const allowed = allowFieldIfSparse(key, { query, resource });
          if (allowed && value.kind === 'primitive') {
            attributes.push(key);
          } else if (allowed) {
            relationships.push(key);
          }
        }
        acc[def.resource] = {
          attributes,
          relationships
        };
        return acc;
      },
      {}
    )
  };
  return options;
}
