/* eslint-disable @typescript-eslint/explicit-module-boundary-types */

import { JsonapiResourceDefinition } from '../@types';
import { isRelationDefinition } from './fields';
import { CONTENT_TYPE, JsonapiDocument, RelationshipData, ResourceObject } from './common';
import { z } from 'zod';

export function CREATE(definition: JsonapiResourceDefinition) {
  const document = JsonapiDocument.extend({
    data: ResourceObject({
      requiresId: false,
      definition
    })
  });

  return document.refine(
    ({ data }) => {
      if (data.id && !definition.allowClientIdOnCreate) {
        return false;
      }
      return true;
    },
    {
      message: 'Client generated identifiers are not allowed on this resource',
      params: {
        status: '403',
        code: 'EFORBIDDEN'
      }
    }
  );
}

export function UPDATE(
  definition: JsonapiResourceDefinition,
  opts?: {
    relation: string;
  }
) {
  const type = definition.resource;
  if (opts?.relation) {
    const schema = definition.fields[opts.relation];
    if (isRelationDefinition(schema)) {
      return JsonapiDocument.extend({
        data: RelationshipData({
          type: schema.relation.type,
          primary: true,
          association: schema.relation.association
        })
      });
    }
    throw new Error(`'${opts.relation} is not a valid relationship on resource ${type}`);
  }

  return JsonapiDocument.extend({
    data: ResourceObject({
      requiresId: false,
      definition
    })
  });
}

const queryKeyPatterns = z.union(
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

export const QUERYSTRING = z.record(z.string()).superRefine((record, ctx) => {
  // a query string will be transformed into an object first,
  // with key representing the query key and the query value.
  for (const key of Object.keys(record)) {
    const validKey = queryKeyPatterns.safeParse(key);
    if (validKey.success === false) {
      ctx.addIssue({
        code: z.ZodIssueCode.invalid_arguments,
        message: `Invalid query key: ${key}`,
        argumentsError: validKey.error
      });
    }
  }
});

export const HEADERS = (opts?: { create?: boolean }) =>
  z
    .object({
      'content-type': z.literal(CONTENT_TYPE),
      accept: opts?.create
        ? z.literal(CONTENT_TYPE, { required_error: 'Missing or invalid accept header' })
        : z.literal(CONTENT_TYPE).optional()
    })
    .passthrough();
