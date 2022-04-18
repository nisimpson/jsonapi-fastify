import {
  Link,
  Meta,
  MultiResourceDocument,
  RelatedResourceDocument,
  RelationshipObject,
  RelationshipObjectData,
  ResourceObject,
  ResourceRef,
  SingleResourceDocument
} from 'jsonapi-spec';

type Data = Record<string, unknown>;

type SerializerFunction<TOptions, TResult> = (
  data: unknown,
  parent: unknown,
  options: TOptions
) => TResult;

type LinkFunction<TOptions> = SerializerFunction<TOptions, Link>;
type LinksRecord<TOptions> = {
  [link: string]: LinkFunction<TOptions>;
};
type MetaFunction<TOptions> = SerializerFunction<TOptions, Meta | undefined>;

type RelationshipOptions<TOptions> = {
  relationshipMeta?: MetaFunction<TOptions>;
  relationshipLinks?: LinksRecord<TOptions>;
};

type RelationshipOptionsRecord<TOptions> = {
  [relation: string]: true | RelationshipOptions<TOptions>;
};

interface ResourceOptions<TOptions> {
  dataMeta?: MetaFunction<TOptions>;
  dataLinks?: LinksRecord<TOptions>;
  attributes?: string[];
  relationships?: string[] | RelationshipOptionsRecord<TOptions>;
}

export interface SerializationOptions {
  meta?: MetaSerializationOptions;
  links?: LinksSerializationOptions;
  id: (data: any) => string;
  type: (data: any) => string;
  included?: (path: string, data: unknown) => boolean;
  dataMeta?: MetaSerializationOptions;
  dataLinks?: LinksSerializationOptions;
  relationshipMeta?: MetaSerializationOptions;
  relationshipLinks?: LinksSerializationOptions;
  ref?: string;
  resources: {
    [type: string]: ResourceSerializationOptions;
  };
}

export type MetaSerializationOptions = MetaFunction<SerializationOptions>;
export type LinkSerializationFunction = LinkFunction<SerializationOptions>;
export type LinksSerializationOptions = LinksRecord<SerializationOptions>;
export type ResourceSerializationOptions = ResourceOptions<SerializationOptions>;
export type RelationshipSerializationOptions = RelationshipOptions<SerializationOptions>;

function generateLinks(
  data: unknown,
  parent: unknown,
  options: SerializationOptions,
  generator: LinksRecord<SerializationOptions>
) {
  const links: any = {};
  for (const [key, value] of Object.entries(generator)) {
    links[key] = value?.(data, parent, options);
  }
  return links;
}

function toRelationshipData(
  data: unknown,
  parent: Data,
  options: {
    relation: RelationshipOptions<SerializationOptions>;
    base: SerializationOptions;
  }
): ResourceRef {
  const obj: RelationshipObjectData = {
    id: options.base.id(data),
    type: options.base.type(data)
  };
  const resourceOptions = options.base.resources[obj.type];
  if (resourceOptions) {
    obj.meta = resourceOptions.dataMeta?.(data, parent, options.base);
  } else {
    obj.meta = options.base.dataMeta?.(data, parent, options.base);
  }
  return obj;
}

function toRelationshipObject(
  data: unknown,
  parent: Data,
  options: {
    key: string;
    relation: RelationshipOptions<SerializationOptions>;
    base: SerializationOptions;
  }
): RelationshipObject {
  const obj: RelationshipObject = {};
  const baseOptions: SerializationOptions = { ...options.base, ref: options.key };
  const relationOptions = options.relation;

  if (relationOptions.relationshipLinks) {
    obj.links = generateLinks(data, parent, baseOptions, relationOptions.relationshipLinks);
  } else if (baseOptions.relationshipLinks) {
    obj.links = generateLinks(data, parent, baseOptions, baseOptions.relationshipLinks);
  }

  if (relationOptions.relationshipMeta) {
    obj.meta = relationOptions.relationshipMeta(data, parent, baseOptions);
  } else if (baseOptions.relationshipMeta) {
    obj.meta = baseOptions.relationshipMeta(data, parent, baseOptions);
  }

  if (data === undefined) {
    return obj;
  } else if (data === null) {
    obj.data = null;
  } else if (Array.isArray(data)) {
    obj.data = data.map((item) =>
      toRelationshipData(item, parent, {
        base: baseOptions,
        relation: relationOptions
      })
    );
  } else {
    obj.data = toRelationshipData(data, parent, {
      base: baseOptions,
      relation: relationOptions
    });
  }
  return obj;
}

function toResourceObject(data: Data, options: SerializationOptions): ResourceObject {
  const obj: ResourceObject = {
    id: options.id(data),
    type: options.type(data)
  };
  const resourceOptions = options.resources[obj.type];
  if (resourceOptions === undefined) {
    console.warn(`Serializer: undefined resource type ${obj.type}`);
  }

  if (resourceOptions?.dataLinks) {
    obj.links = generateLinks(data, null, options, resourceOptions.dataLinks);
  } else if (options.dataLinks) {
    obj.links = generateLinks(data, null, options, options.dataLinks);
  }

  if (resourceOptions?.attributes) {
    const attributes: ResourceObject['attributes'] = {};
    for (const attribute of resourceOptions.attributes) {
      attributes[attribute] = data[attribute];
    }
    obj.attributes = attributes;
  }

  if (resourceOptions?.relationships) {
    const relationships: ResourceObject['relationships'] = {};

    if (Array.isArray(resourceOptions.relationships)) {
      resourceOptions.relationships = resourceOptions.relationships.reduce<
        RelationshipOptionsRecord<SerializationOptions>
      >((acc, cur) => {
        acc[cur] = true;
        return acc;
      }, {});
    }

    for (const [key, value] of Object.entries(resourceOptions.relationships)) {
      const relationData = data[key];
      const relation = toRelationshipObject(relationData, data, {
        key,
        relation: value === true ? {} : value,
        base: options
      });
      // @ts-expect-error the relationship object type is partial on keys
      relationships[key] = relation;
    }
    obj.relationships = relationships;
  }
  obj.meta = resourceOptions?.dataMeta?.(data, null, options);
  return obj;
}

function toIncludedResources(
  data: Data,
  options: SerializationOptions,
  visited: Set<string>
): ResourceObject[] {
  const results: ResourceObject[] = [];
  const hash = (target: Data) => `${options.type(target)}#${options.id(target)}`;

  function recurse(target: Data, path?: string): void {
    const type = options.type(target);
    const { relationships = {} } = options.resources[type] || {};
    for (const key of Object.keys(relationships)) {
      const relation = target[key] as Data;

      const currentPath = path ? `${path}.${key}` : key;
      if (options.included?.(currentPath, relation)) {
        if (Array.isArray(relation)) {
          relation.forEach((item) => {
            const hashed = hash(item);
            if (!visited.has(hashed)) {
              visited.add(hashed);
              results.push(toResourceObject(item, options));
            }
            recurse(item, currentPath);
          });
        } else {
          const hashed = hash(relation);
          if (!visited.has(hashed)) {
            visited.add(hashed);
            results.push(toResourceObject(relation, options));
          }
          recurse(relation, currentPath);
        }
      }
    }
  }

  recurse(data);
  return results;
}

type Serializable = Data | Data[] | null | undefined;

function serialize(data: Serializable, options: SerializationOptions): unknown {
  if (Array.isArray(data)) {
    const document: Partial<MultiResourceDocument> = {};
    document.meta = options.meta?.(data, null, options);
    if (options.links) {
      document.links = generateLinks(data, null, options, options.links);
    }
    document.data = data.map((item) => toResourceObject(item, options));
    const visited = new Set<string>();
    document.included = data.map((item) => toIncludedResources(item, options, visited)).flat();
    return document;
  }
  const document: Partial<RelatedResourceDocument> | Partial<SingleResourceDocument> = {};
  document.meta = options.meta?.(data, null, options);
  if (options.links) {
    document.links = generateLinks(data, null, options, options.links);
  }
  if (data === null) {
    document.data = null;
  }
  else if (data) {
    document.data = toResourceObject(data, options);
    document.included = toIncludedResources(data, options, new Set<string>());
  }
  return document;
}

function isMultiResource(document: any): document is MultiResourceDocument {
  return Array.isArray(document.data);
}

function fromRelationshipData(obj: RelationshipObjectData): Data | Data[] | null {
  if (obj === null) {
    return null;
  }
  if (Array.isArray(obj)) {
    return obj.map(({ id, type }) => ({ id, type }));
  }
  return { id: obj.id, type: obj.type };
}

function fromResourceObject(obj: ResourceObject): Data {
  const result: Data = {};
  result.id = obj.id;
  result.type = obj.type;
  for (const [key, value] of Object.entries(obj.attributes || {})) {
    result[key] = value;
  }
  for (const [key, value] of Object.entries(obj.relationships || {})) {
    result[key] = fromRelationshipData(value.data ?? null);
  }
  return result;
}

function deserialize(body: unknown) {
  if (isMultiResource(body)) {
    const result = body.data?.map((item) => fromResourceObject(item));
    return result ?? [];
  }
  const document = body as SingleResourceDocument;
  if (document.data === null) {
    return null;
  }
  return document.data ? fromResourceObject(document.data) : {};
}

export default {
  serialize,
  deserialize
};
