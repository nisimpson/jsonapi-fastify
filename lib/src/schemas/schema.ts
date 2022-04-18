import { z } from 'zod';
import { extendApi, OpenApiZodAny } from '@anatine/zod-openapi';
import { JsonapiResourceDefinition } from '../@types';
import { SchemasObject } from 'openapi3-ts';

export const MEDIA_TYPE = 'application/vnd.api+json';

export function ref<T extends OpenApiZodAny>(schema: T): T {
  return extendApi(
    schema.transform((val) => val),
    {
      $ref: `#/components/schemas/${schema.description}`
    }
  ) as any;
}

export const nonEmptyString = z.string().nonempty();

const meta = extendApi(z.record(z.unknown()), {
  description:
    'Non-standard meta-information that can not be represented as an attribute or relationship.',
  additionalProperties: true
}).describe('meta');

const uriReference = nonEmptyString;

const link = extendApi(uriReference, {
  description: "A string containing the link's URL."
})
  .or(
    extendApi(
      z.object({
        href: extendApi(uriReference, {
          description: "A string containing the link's URL."
        }),
        meta: ref(meta).optional()
      }),
      {
        description:
          "A link **MUST** be represented as either: a string containing the link's URL or a link object."
      }
    )
  )
  .or(z.undefined())
  .describe('link');

const relationshipSelfLink = extendApi(link, {
  description: [
    'A `self` member, whose value is a URL for the relationship itself (a "relationship URL").',
    'This URL allows the client to directly manipulate the relationship.',
    'For example, it would allow a client to remove an `author` from an `article`',
    'without deleting the people resource itself.'
  ].join(' ')
}).describe('relationshipSelfLink');

const relationshipLinks = extendApi(
  z.record(link).refine((val) => val.self || val.related, {
    message: 'Relationship links missing "self" or "related" link.'
  }),
  {
    properties: {
      self: { $ref: '#/components/schemas/relationshipSelfLink' },
      related: { $ref: '#/components/schemas/link' }
    },
    additionalProperties: true
  }
).describe('relationshipLinks');

const links = extendApi(z.record(ref(link))).describe('links');

const pageLink = ref(link).or(z.null());

const pagination = extendApi(
  z
    .object({
      first: extendApi(pageLink, {
        description: 'The first page of data'
      }).optional(),
      last: extendApi(pageLink, {
        description: 'The last page of data'
      }).optional(),
      prev: extendApi(pageLink, {
        description: 'The previous page of data'
      }).optional(),
      next: extendApi(pageLink, {
        description: 'The next page of data'
      }).optional()
    })
    .passthrough()
).describe('pagination');

const validKeys = z
  .string()
  .regex(/^[a-zA-Z0-9](?:[-\w]*[a-zA-Z0-9])?$/)
  .and(
    z.string().refine(
      (val) => !['relationships', 'links', 'id', 'type'].includes(val),
      (val) => ({ message: `Invalid attribute key: ${val}` })
    )
  );

const attributes = extendApi(
  z
    .record(
      extendApi(z.unknown(), {
        description: 'Attributes may contain any valid JSON value.'
      })
    )
    .superRefine((val, ctx) => {
      for (const key of Object.keys(val)) {
        const parsed = validKeys.safeParse(key);
        if (parsed.success === false) {
          ctx.addIssue({
            code: z.ZodIssueCode.invalid_arguments,
            message: `Invalid attribute key: ${key}`,
            argumentsError: parsed.error
          });
        }
      }
    }),
  {
    description:
      'Members of the attributes object ("attributes") represent information about the resource object in which it\'s defined.'
  }
).describe('attributes');

const empty = extendApi(z.null(), {
  description: 'Descripts an empty to-one relationship.'
}).describe('empty');

const dataType = (type?: string, primary?: boolean) =>
  nonEmptyString.refine(
    (val) => (type ? val === type : true),
    (val) => ({
      message: `The data type '${val}' is not among the type(s) that constitute the '${type}' resource`,
      params: {
        // if a jsonapi resource document contains an invalid type,
        // it is considered a http 409 conflict status in some cases.
        status: primary ? '409' : undefined,
        code: 'ECONFLICT'
      }
    })
  );

const linkage = (type?: string, primary?: boolean) =>
  extendApi(
    z.object({
      type: dataType(type, primary),
      id: nonEmptyString,
      meta: ref(meta).optional()
    }),
    {
      description: 'The "type" and "id" to non-empty members.'
    }
  ).describe('linkage');

const relationshipToOne = (type?: string, primary?: boolean) =>
  extendApi(ref(linkage(type, primary)).or(ref(empty)), {
    description: [
      'References to other resource objects in a to-one ("relationship").',
      "Relationships can be specified by including a member in a resource's links object."
    ].join(' ')
  }).describe('relationshipToOne');

const relationshipToMany = (type?: string, primary?: boolean) =>
  extendApi(ref(linkage(type, primary)).array(), {
    uniqueItems: true,
    description:
      'An array of objects each containing "type" and "id" members for to-many relationships.'
  }).describe('relationshipToMany');

const relationshipObject = (type?: string, primary?: boolean) =>
  z
    .object({
      links: ref(links).optional(),
      data: extendApi(
        ref(relationshipToOne(type, primary))
          .or(ref(relationshipToMany(type, primary)))
          .optional(),
        {
          description: 'Member, whose value represents "resource linkage".'
        }
      ),
      meta: ref(meta).optional()
    })
    .refine((val) => val.links || val.data || val.meta, {
      message: 'Relationship member must contain "data", "links", or "meta" keys.'
    });

const relationships = extendApi(
  z.record(relationshipObject()).superRefine((val, ctx) => {
    for (const key of Object.keys(val)) {
      const parsed = validKeys.safeParse(key);
      if (parsed.success === false) {
        ctx.addIssue({
          code: z.ZodIssueCode.invalid_arguments,
          message: `Invalid relationship key: ${key}`,
          argumentsError: parsed.error
        });
      }
    }
  })
).describe('relationships');

const jsonapi = extendApi(
  z.object({
    version: z.string().default('1.0'),
    meta: ref(meta).optional()
  }),
  {
    description: "An object describing the server's implementation",
    additionalProperties: false
  }
).describe('jsonapi');

const error = z
  .object({
    id: extendApi(nonEmptyString.optional(), {
      description: 'A unique identifier for this particular occurrence of the problem.'
    }),
    links: ref(links).optional(),
    status: extendApi(nonEmptyString.optional(), {
      description: 'The HTTP status code applicable to this problem, expressed as a string value.'
    }),
    code: extendApi(nonEmptyString.optional(), {
      description: 'An application-specific error code, expressed as a string value.'
    }),
    title: extendApi(nonEmptyString.optional(), {
      description: [
        'A short, human-readable summary of the problem.',
        'It **SHOULD NOT** change from occurrence to occurrence of the problem,',
        'except for purposes of localization.'
      ].join('')
    }),
    detail: extendApi(nonEmptyString.optional(), {
      description: 'A human-readable explanation specific to this occurrence of the problem.'
    }),
    source: z
      .object({
        pointer: extendApi(nonEmptyString.optional(), {
          description: [
            'A JSON Pointer [RFC6901] to the associated entity in the request document',
            '[e.g. "/data" for a primary data object, or "/data/attributes/title" for a specific attribute].'
          ].join('')
        }),
        parameter: extendApi(nonEmptyString.optional(), {})
      })
      .optional(),
    meta: ref(meta).optional()
  })
  .describe('error');

type ErrorSchema = z.TypeOf<typeof error>;

const resource = extendApi(
  z.object({
    id: nonEmptyString,
    type: nonEmptyString,
    attributes: ref(attributes).optional(),
    relationships: ref(relationships).optional(),
    links: ref(links).optional(),
    meta: ref(meta).optional()
  }),
  {
    description: '"Resource objects" appear in a JSON:API document to represent resources.'
  }
).describe('resource');

export type ResourceSchema = z.TypeOf<typeof resource>;

const data = extendApi(ref(resource).nullable().or(ref(resource).array()), {
  description:
    'The document\'s "primary data" is a representation of the resource or collection of resources targeted by a request.'
}).describe('data');

const info = extendApi(
  z.object({
    meta: ref(meta),
    links: ref(links).optional(),
    jsonapi: ref(jsonapi).optional().default({})
  }),
  {
    additionalProperties: false
  }
).describe('info');

const failure = extendApi(
  z.object({
    jsonapi: ref(jsonapi).optional().default({}),
    meta: ref(meta).optional(),
    links: ref(links).optional(),
    errors: ref(error).array()
  })
).describe('failure');

const success = extendApi(
  z.object({
    jsonapi: ref(jsonapi).optional().default({}),
    meta: ref(meta).optional(),
    links: extendApi(ref(links).and(ref(pagination)), {
      description: 'Link members related to the primary data.'
    }).optional(),
    data: ref(data),
    included: extendApi(ref(resource).array(), {
      description: [
        'To reduce the number of HTTP requests, servers **MAY** allow responses',
        'that include related resources along with the requested primary resources.',
        'Such responses are called "compound documents".'
      ].join('')
    }).default([])
  })
).describe('success');

const document = extendApi(ref(success).or(ref(failure).or(ref(info))), {
  title: 'JSON:API Schema',
  description: 'This is a schema for responses in the JSON:API format.',
  externalDocs: {
    url: 'http://jsonapi.org'
  }
}).describe('document');

const newResource = extendApi(
  resource.omit({ id: true }).extend({
    id: nonEmptyString.optional()
  })
).describe('newResource');

export function resourceFromDef(def: JsonapiResourceDefinition): z.AnyZodObject {
  let attributes: z.AnyZodObject = z.object({});
  let relationships: z.AnyZodObject = z.object({});
  for (const [key, value] of Object.entries(def.fields)) {
    if (value.kind === 'primitive') {
      attributes = attributes.extend({
        [key]: extendApi(value.schema, {
          description: value.schema.description
        })
      });
    } else {
      const record = relationshipObject(value.relation.type)
        .refine(
          (val) => {
            if (val.data && value.relation.association === 'many') {
              return Array.isArray(val.data);
            }
            return true;
          },
          {
            message: 'Invalid data value; must be an array'
          }
        )
        .refine(
          (val) => {
            if (val.data && value.relation.association === 'one') {
              return !Array.isArray(val.data);
            }
            return true;
          },
          {
            message: 'Invalid data value must be a resource link or null'
          }
        );
      relationships = relationships.extend({
        [key]: extendApi(record, {
          description: value.description
        })
      });
    }
  }
  return extendApi(
    z.object({
      meta: ref(meta).optional(),
      links: ref(links).optional(),
      id: nonEmptyString,
      type: dataType(def.resource, true),
      attributes: attributes.partial().optional(),
      relationships: relationships.partial().optional()
    }),
    {
      description: def.description
    }
  ).describe(`${def.resource}Resource`);
}

const request = {
  relation: (def: JsonapiResourceDefinition) => {
    let data: any = z.never();
    for (const value of Object.values(def.fields)) {
      if (value.kind === 'relation' && value.relation.association === 'one') {
        data = data.or(relationshipToOne(value.relation.type, true));
      } else if (value.kind === 'relation') {
        data = data.or(relationshipToMany(value.relation.type, true));
      }
    }
    return z.object({ data });
  },
  resource: (def: JsonapiResourceDefinition, opts?: { create: boolean }) =>
    z.object({
      data: resourceFromDef(def)
        .omit({ id: true })
        .extend({
          id: nonEmptyString.optional().refine(
            (val) => {
              if (opts?.create && def.allowsIdOnCreate) {
                return true;
              }
              return val === undefined;
            },
            {
              message: 'Client generated identifiers are not allowed on this resource',
              params: {
                status: '403',
                code: 'EFORBIDDEN'
              }
            }
          )
        })
    })
};

const response = {
  any: document,
  resource(def: JsonapiResourceDefinition) {
    const data = resourceFromDef(def);
    return success.omit({ data: true }).extend({
      data: data.nullable().or(data.array())
    });
  },
  relation(def: JsonapiResourceDefinition) {
    let data: any = z.never();
    for (const value of Object.values(def.fields)) {
      if (value.kind === 'relation' && value.relation.association === 'one') {
        data = data.or(relationshipToOne(value.relation.type));
      } else if (value.kind === 'relation') {
        data = data.or(relationshipToMany(value.relation.type));
      }
    }
    return success.omit({ data: true }).extend({ data });
  },
  failure(err: ErrorSchema) {
    return failure.omit({ errors: true }).extend({
      errors: failure.shape.errors.default([err])
    });
  }
};

const validQueryKeys = z.union(
  [
    // sparse field sets
    z.string().regex(/^fields\[\w+\]$/),
    // filters
    z.string().regex(/^filter(\[\w+\])+/),
    // pagination
    z.string().regex(/^page\[limit|cursor|offset|size\]$/),
    // include
    z.literal('include'),
    // sorting
    z.literal('sort')
  ],
  {
    invalid_type_error: 'Invalid query key'
  }
);

export const documents = {
  request,
  response,
  querystring: z.record(z.string()).superRefine((record, ctx) => {
    // a query string will be transformed into an object first,
    // with key representing the query key and the query value.
    for (const key of Object.keys(record)) {
      const validKey = validQueryKeys.safeParse(key);
      if (validKey.success === false) {
        ctx.addIssue({
          code: z.ZodIssueCode.invalid_arguments,
          message: `Invalid query key: ${key}`,
          argumentsError: validKey.error
        });
      }
    }
  }),
  headers: (opts?: { body: boolean }) => {
    return z
      .object({
        'content-type': nonEmptyString.optional().refine(
          (val) => {
            return opts?.body ? val === MEDIA_TYPE : true;
          },
          {
            message: 'Invalid request header',
            params: {
              status: '415',
              code: 'EUNSUPPORTED'
            }
          }
        ),
        accept: nonEmptyString
          .refine((val) => val && val.includes('*/*'), {
            params: {
              message: 'Invalid request header',
              code: 'EINVALID',
              status: '422'
            }
          })
          .or(
            nonEmptyString.refine(
              (val) => {
                const mediaTypes = val.split(',');
                return mediaTypes.some((media) => {
                  const [type, params] = media.split(';');
                  return type === MEDIA_TYPE && params === undefined;
                });
              },
              {
                message: 'Invalid request header',
                params: {
                  code: 'ENOTACCEPTABLE',
                  status: '406'
                }
              }
            )
          )
          .optional()
      })
      .passthrough();
  },
  error409Conflict: response
    .failure({
      status: '409',
      code: 'ECONFLICT',
      title: 'Resource already exists',
      detail: 'A resource with this id already exists on the server.'
    })
    .describe('error409Conflict'),
  error406NotAcceptable: response
    .failure({
      status: '406',
      code: 'ENOTACCEPTABLE'
    })
    .describe('error406NotAcceptable'),
  error403Forbidden: response
    .failure({
      status: '403',
      code: 'EFORBIDDEN',
      title: 'Request not allowed',
      detail: 'The client request is not allowed on this resource.'
    })
    .describe('error403Forbidden'),
  error503Unavailable: response
    .failure({
      status: '503',
      code: 'EUNAVAILABLE',
      title: 'Resource temporarily unavailable',
      detail: `The requested resource is temporarily unavailable.`
    })
    .describe('error503Unavailable'),
  error404Foreign: response
    .failure({
      status: '404',
      code: 'EFOREIGN',
      title: 'Relation is Foreign',
      detail: 'The requested relation is a foreign relation and cannot be accessed in this manner.'
    })
    .describe('error404Foreign'),
  error404NotFound: response
    .failure({
      status: '404',
      code: 'ENOTFOUND',
      title: 'Resource not found',
      detail: `The requested resource does not exist on this server.`
    })
    .describe('error404NotFound'),
  error500Unknown: response
    .failure({
      status: '500',
      code: 'EUNKNOWN',
      title: 'Unknown Error',
      detail: 'An unknown error occurred. See stack trace for details.'
    })
    .describe('error500Unknown')
};

export const schemas = {
  meta,
  link,
  relationshipSelfLink,
  relationshipLinks,
  links,
  pagination,
  attributes,
  empty,
  linkage: linkage(),
  relationshipToOne: relationshipToOne(),
  relationshipToMany: relationshipToMany(),
  relationships,
  jsonapi,
  error,
  resource,
  data,
  info,
  failure,
  success,
  document,
  newResource
};
