/* eslint-disable @typescript-eslint/explicit-module-boundary-types */

import { JsonapiError, JsonapiResourceDefinition } from 'src/@types';
import { z } from 'zod';
import { isRelationDefinition } from './fields';
import {
  CONTENT_TYPE,
  Identifier,
  Included,
  JsonapiDocument,
  LinksRecord,
  Meta,
  NonEmptyString,
  RelationshipData,
  ResourceObject,
  SchemaRef
} from './common';
import { extendApi } from '@anatine/zod-openapi';

export const DOCUMENT = JsonapiDocument;

export const ACCEPTED_202 = extendApi(JsonapiDocument, {
  description: 'JSON:API accepted response'
});

const IncludedRef = SchemaRef('included', Included);

export function RESOURCE_OK_200(
  definition?: JsonapiResourceDefinition,
  opts?: {
    multi: boolean;
  }
) {
  const data = ResourceObject({
    requiresId: true,
    definition
  });
  if (definition) {
    return JsonapiDocument.extend({
      data: opts?.multi ? data.array() : data,
      included: IncludedRef.optional().default([])
    });
  }
  return JsonapiDocument.extend({
    data: data.nullable().or(data.array()),
    included: IncludedRef.optional().default([])
  });
}

export function RELATION_OK_200(definition: JsonapiResourceDefinition) {
  const refs: any[] = [];
  for (const attribute of Object.values(definition.fields)) {
    if (isRelationDefinition(attribute)) {
      refs.push(
        RelationshipData({
          type: attribute.relation.type,
          association: attribute.relation.association
        })
      );
    }
  }

  let document = JsonapiDocument.extend({
    included: IncludedRef.optional().default([])
  });
  if (refs.length > 0) {
    const data = refs.reduce((prev, cur) => (prev ? prev.or(cur) : cur));
    document = document.extend({ data: data.optional() });
  }
  return document;
}

export function HEADERS(opts?: { created?: boolean }) {
  return z.object({
    'content-type': z.literal(CONTENT_TYPE),
    location: opts?.created ? z.string().url() : z.undefined()
  });
}

export const ErrorObject = z.object({
  id: Identifier(),
  meta: SchemaRef('meta', Meta).optional(),
  links: SchemaRef('linksRecord', LinksRecord).optional(),
  status: NonEmptyString.optional(),
  source: z
    .object({
      pointer: NonEmptyString.optional(),
      parameter: NonEmptyString.optional()
    })
    .optional(),
  code: NonEmptyString.optional(),
  title: NonEmptyString.optional(),
  detail: NonEmptyString.optional()
});

export const ErrorDocument = (error: JsonapiError) => {
  return JsonapiDocument.extend({
    errors: SchemaRef('error', ErrorObject)
      .array()
      .default([error as any])
  });
};

export const CONFLICT_409 = ErrorDocument({
  status: '409',
  code: 'ECONFLICT',
  title: 'Resource already exists',
  detail: 'A resource with this id already exists on the server.'
});

export const NOT_ACCEPTABLE_406 = ErrorDocument({
  status: '406',
  code: 'ENOTACCEPTABLE'
});

export const FORBIDDEN_403 = ErrorDocument({
  status: '403',
  code: 'EFORBIDDEN',
  title: 'Request not allowed',
  detail: 'The client request is not allowed on this resource.'
});

export const UNAVAILABLE_503 = ErrorDocument({
  status: '503',
  code: 'EUNAVAILABLE',
  title: 'Resource temporarily unavailable',
  detail: `The requested resource is temporarily unavailable.`
});

export const RESOURCE_FOREIGN_404 = ErrorDocument({
  status: '404',
  code: 'EFOREIGN',
  title: 'Relation is Foreign',
  detail: 'The requested relation is a foreign relation and cannot be accessed in this manner.'
});

export const RESOURCE_NOT_FOUND_404 = ErrorDocument({
  status: '404',
  code: 'ENOTFOUND',
  title: 'Resource not found',
  detail: `The requested resource does not exist on this server.`
});

export const RELATION_NOT_FOUND_404 = ErrorDocument({
  status: '404',
  code: 'ENOTFOUND',
  title: 'Resource not found',
  detail: 'The relationship does not exist on this resource.'
});

export const UNKNOWN_ERROR_500 = ErrorDocument({
  status: '500',
  code: 'EUNKNOWN',
  title: 'Unknown Error',
  detail: 'An unknown error occurred. See stack trace for details.'
});
