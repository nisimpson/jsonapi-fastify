import { FastifyAsyncCallback } from '../utils';
import { JsonapiQuery, JsonapiResourceDefinition } from '../@types';
import {
  getRelationAttributes,
  isRelationDefinition,
  RelationalField
} from '../schemas/fields';
import jsonapiSerializer, {
  SerializerOptions,
  LinkFunction,
  DeserializerOptions,
  RelationshipOptions
} from 'jsonapi-serializer';
import { IncludeGraph, includesAsObjectGraph } from './includes';
import { Meta } from 'jsonapi-spec';

type PopulateOpts = {
  definition: JsonapiResourceDefinition;
  isRef?: boolean;
};

function relationshipLink(opts: {
  prefix: string;
  relation: string;
  def: RelationalField;
  related?: boolean;
}): LinkFunction {
  return (record, current, parent) => {
    if (current === null) {
      return null;
    }

    const relation = opts.def.relation;
    if (relation.foreign) {
      return opts.related
        ? // http://example.com/photos?filter[photographer]=some-id
          `${opts.prefix}/${relation.type}?filter[${relation.as!}]=${parent.id}`
        : undefined;
    }

    return opts.related
      ? // http://example.com/people/9c0cba2f-7489-49a9-9192-27404c8f97b4/photos
        `${opts.prefix}/${record.type}/${parent.id}/${opts.relation}`
      : // http://example.com/people/9c0cba2f-7489-49a9-9192-27404c8f97b4/relationships/photos
        `${opts.prefix}/${record.type}/${parent.id}/relationships/${opts.relation}`;
  };
}

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

function selfLink(opts: { prefix: string }): LinkFunction {
  return (_record, current) => {
    // http://example.com/people/9c0cba2f-7489-49a9-9192-27404c8f97b4
    return `${opts.prefix}/${current.type}/${current.id}`;
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

export function deserializeRequestBody(
  def: JsonapiResourceDefinition,
  opts?: {
    relation: string;
  }
): FastifyAsyncCallback {
  return async (params) => {
    // if we've reached this point, then the fastify validator will have
    // ensured that a valid request body exists.
    const document: any = params.request.body;

    // if the primary data is relational, deserialize and attach the data type
    if (opts?.relation) {
      const deserializer = new jsonapiSerializer.Deserializer({
        keyForAttribute: (attribute) => attribute
      });
      if (document.data == null) {
        params.reply.jsonapi.resource = null;
        return params;
      }
      const deserialized = await deserializer.deserialize(document);
      const relationData = def.fields[opts.relation] as RelationalField;
      if (Array.isArray(deserialized)) {
        deserialized.forEach((item) => (item.type = relationData.relation.type));
      } else {
        deserialized.type = relationData.relation.type;
      }
      params.reply.jsonapi.resource = deserialized;
      return params;
    }

    // create relationship deserializers
    const relationshipOptions: RelationshipOptions = {
      // just extract the data, leave it to the handlers to resolve
      valueForRelationship: async (data) => data
    };

    const relationships = getRelationAttributes(def);

    const options = relationships.reduce<DeserializerOptions>(
      (acc, schema) => {
        acc[schema.relation.type] = relationshipOptions;
        return acc;
      },
      {
        keyForAttribute: (attribute) => attribute
      }
    );

    const deserializer = new jsonapiSerializer.Deserializer(options);

    const deserialized = await deserializer.deserialize(document);
    if (Array.isArray(deserialized)) {
      deserialized.forEach((item) => (item.type = def.resource));
    } else {
      deserialized.type = def.resource;
    }
    params.request.jsonapi.resource = deserialized;
    return params;
  };
}

export function buildSerializerOptions(type: string): FastifyAsyncCallback {
  return async (params) => {
    const context = params.reply.jsonapi;
    const prefix = context.baseUrl;
    const query = context.query(params.request);

    // memoize options for a given type to avoid cyclical resolutions
    // of relationships
    const memo: Record<string, SerializerOptions> = {};

    /**
     * Configures the specified serializer options based on the provided
     * resource definition data.
     *
     * @param parent The serializer options
     * @param opts Additional options.
     */
    function configure(parent: SerializerOptions, opts: PopulateOpts): void {
      parent.attributes = [];
      parent.id = 'id';
      parent.pluralizeType = false;

      if (opts.isRef) {
        parent.ref = 'id';
      }

      parent.keyForAttribute = (attribute) => attribute;

      parent.typeForAttribute = (attribute, record) => {
        return record && record.type ? record.type : attribute;
      };

      parent.topLevelLinks = { self: `${prefix}${params.request.url}` };
      parent.includedLinks = { self: selfLink({ prefix }) };
      parent.dataLinks = { self: selfLink({ prefix }) };

      const definition = opts.definition ?? {};
      const { fields = {}, resource } = definition;

      for (const [key, value] of Object.entries(fields)) {
        if (allowFieldIfSparse(key, { query, resource })) {
          parent.attributes?.push(key);
        }

        if (isRelationDefinition(value)) {
          const relationType = value.relation.type;
          if (memo[relationType] === undefined) {
            memo[relationType] = {};
            const relationDefinition = context.definitions[value.relation.type];
            configure(memo[relationType], {
              definition: relationDefinition,
              isRef: true
            });
          }

          // perform a spread here, since there may be relationships that share
          // a common type.
          parent[key] = {
            ...memo[relationType],
            included: false,
            relationshipLinks: {
              self: relationshipLink({ prefix, def: value, relation: key }),
              related: relationshipLink({
                prefix,
                relation: key,
                def: value,
                related: true
              })
            },
            relationshipMeta: relationshipMeta(value)
          };
        }
      }

      // sort the attributes
      parent.attributes = parent.attributes.sort();
    }

    const definition = context.definitions[type];
    configure(context.serializerOptions, { definition });

    /**
     * Marks relationship options to be included based on client specifications.
     *
     * @param graph The inclusion graph generated from the include query.
     * @param options The serializer options.
     */
    function markIncludes(graph: IncludeGraph, options: SerializerOptions) {
      for (const key of Object.keys(graph)) {
        const ref = options[key];
        ref.included = true;
        markIncludes(graph[key] as IncludeGraph, ref);
      }
    }

    const includeGraph = includesAsObjectGraph(query.include);
    markIncludes(includeGraph, context.serializerOptions);
    return params;
  };
}
