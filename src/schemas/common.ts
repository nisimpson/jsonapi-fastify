/* eslint-disable @typescript-eslint/explicit-module-boundary-types */

import { JsonapiResourceDefinition } from '../@types';
import { isPrimitiveDefinition } from './fields';
import { z } from 'zod';
import { OperationObject } from 'openapi3-ts';
import { extendApi, OpenApiZodAny } from '@anatine/zod-openapi';

type CategoryKey = keyof OperationObject;

export const CONTENT_TYPE = 'application/vnd.api+json';

export type WrappedSchema<TSchema> = {
  type: 'object';
  properties: TSchema;
};

/**
 * Creates a reference id for use in OpenApi schemas.
 *
 * @param opts The function options.
 * @returns A string that identifies references in the openapi schema.
 */
export function componentRef(opts: { name: string; category: CategoryKey }) {
  return `#/components/${opts.category}/${opts.name}`;
}

export function SchemaRef<T extends OpenApiZodAny>(name: string, schema: T) {
  return extendApi(schema, {
    $ref: componentRef({ name, category: 'schemas' })
  });
}

/**
 * Wraps the specified schema, such that it conforms to what fastify
 * expects in schema declarations.
 *
 * @param schema The input schema
 * @returns A WrappedSchema instance.
 */
export function toFastifySchema<TSchema>(schema: TSchema) {
  return {
    type: 'object',
    properties: schema
  };
}

const AnyObject = z.record(z.unknown());

export const NonEmptyString = z.string().nonempty();

export const Meta = extendApi(
  z.record(z.unknown(), {
    description: 'JSON:API metadata'
  })
);

export const Jsonapi = z.object({
  version: z.string().default('1.0'),
  meta: SchemaRef('meta', Meta).optional()
});

export const Url = extendApi(
  NonEmptyString.refine((value) => {
    return value.startsWith('http://') || value.startsWith('https://') || value.startsWith('/');
  })
);

export const LinkRef = z.object({
  href: SchemaRef('url', Url),
  meta: SchemaRef('meta', Meta).optional()
});

export const Link = SchemaRef('url', Url).or(SchemaRef('linkRef', LinkRef)).or(z.undefined());

export const LinksRecord = z.record(Link);

export const RelationshipLinks = SchemaRef('linksRecord', LinksRecord).refine((links) => {
  return links.self || links.related;
});

export const Identifier = (required?: boolean) =>
  required ? NonEmptyString : NonEmptyString.optional();

const DataType = (cfg?: { type?: string; primary?: boolean }) =>
  NonEmptyString.refine(
    (value) => {
      return cfg?.type ? value === cfg.type : true;
    },
    (value) => ({
      message: `The data type '${value}' is not among the type(s) that constitute the '${cfg?.type}' resource`,
      params: {
        // if a jsonapi resource document contains an invalid type,
        // it is considered a http 409 conflict status in some cases.
        status: cfg?.primary ? '409' : undefined,
        code: 'ECONFLICT'
      }
    })
  );

export const ResourceRef = (cfg?: { type?: string; primary?: boolean }) =>
  z.object({
    id: Identifier(),
    type: DataType(cfg),
    meta: SchemaRef('meta', Meta).optional()
  });

export type RelationAssociation = 'one' | 'many';

export type RelationshipConfig = {
  type?: string;
  primary?: boolean;
  association?: RelationAssociation;
};

export const RelationshipData = (cfg?: RelationshipConfig) => {
  const ref = SchemaRef(
    'resourceRef',
    ResourceRef({
      type: cfg?.type,
      primary: cfg?.primary
    })
  );
  return ref
    .nullable()
    .or(ref.array())
    .refine(
      (value) => {
        return cfg?.association === 'many' ? Array.isArray(value) : true;
      },
      {
        message: 'Invalid data value; must be an array'
      }
    )
    .refine(
      (value) => {
        return cfg?.association === 'one' ? !Array.isArray(value) : true;
      },
      {
        message: 'Invalid data value; must be an object or null'
      }
    );
};

export const Relationship = (cfg?: RelationshipConfig) =>
  z
    .object({
      links: RelationshipLinks.optional(),
      meta: SchemaRef('meta', Meta).optional(),
      data: RelationshipData(cfg)
    })
    .refine(
      ({ links, meta, data }) => {
        const defined = links || meta || data || false;
        return defined;
      },
      {
        message: 'Invalid relationship: "links", "meta", or "data" must be defined'
      }
    );

export const RelationshipRecord = z.record(Relationship());

type RelationshipSchema = ReturnType<typeof Relationship>;
type Relationship = z.TypeOf<RelationshipSchema>;

export type ResourceObjectType = {
  id?: string;
  type: string;
  links?: z.TypeOf<typeof LinksRecord>;
  meta?: z.TypeOf<typeof Meta>;
  attributes?: Record<string, unknown>;
  relationships?: Record<string, Relationship>;
};

export type ResourceConfig = {
  requiresId?: boolean;
  definition?: JsonapiResourceDefinition;
};

export const ResourceObject = (cfg?: ResourceConfig) => {
  let schema: z.AnyZodObject = z.object({
    id: Identifier(cfg?.requiresId),
    type: DataType({
      type: cfg?.definition?.resource,
      primary: true
    }),
    links: SchemaRef('linksRecord', LinksRecord).optional(),
    meta: SchemaRef('meta', Meta).optional(),
    attributes: AnyObject.optional(),
    relationships: RelationshipRecord.optional()
  });
  if (cfg?.definition) {
    let attributes: z.AnyZodObject = z.object({});
    let relationships: z.AnyZodObject = z.object({});
    let hasAttributes = false;
    let hasRelationships = true;
    for (const [key, value] of Object.entries(cfg.definition.fields)) {
      if (isPrimitiveDefinition(value)) {
        hasAttributes = true;
        attributes = attributes.extend({
          [key]: value.schema
        });
      } else {
        hasRelationships = true;
        relationships = relationships.extend({
          [key]: Relationship({
            type: value.relation.type,
            association: value.relation.association
          })
        });
      }
    }
    if (hasAttributes) {
      schema = schema.omit({ attributes: true }).extend({
        attributes: attributes.partial().optional()
      });
    }
    if (hasRelationships) {
      schema = schema.omit({ relationships: true }).extend({
        relationships: relationships.partial().optional()
      });
    }
  }
  return schema.transform((obj: ResourceObjectType) => obj);
};

export const Included = ResourceObject().array();

export const JsonapiDocument = z.object({
  jsonapi: SchemaRef('jsonapi', Jsonapi).optional().default({}),
  meta: SchemaRef('meta', Meta).optional(),
  links: SchemaRef('linksRecord', LinksRecord).optional()
});
