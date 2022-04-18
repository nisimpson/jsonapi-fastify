import { generateSchema } from '@anatine/zod-openapi';
import { RouteShorthandOptionsWithHandler } from 'fastify';
import {
  RequestBodyObject,
  ReferenceObject,
  ResponseObject,
  OperationObject,
  ResponsesObject,
  ExampleObject,
  OpenApiBuilder
} from 'openapi3-ts';
import { JsonapiContext } from 'src/@types';
import { relationshipMeta } from 'src/middleware';
import { forEachFieldInDefinition } from 'src/schemas/fields';
import {
  schemas,
  MEDIA_TYPE,
  documents,
  resourceFromDef,
  ResourceSchema,
  ref
} from 'src/schemas/schema';
import { z } from 'zod';

function componentRef(opts: { name: string; category: string }) {
  return `#/components/${opts.category}/${opts.name}`;
}

function responseRef(schema: z.AnyZodObject | string): string {
  if (typeof schema === 'string') {
    return componentRef({ name: schema, category: 'responses' });
  }
  return componentRef({ name: schema.description!, category: 'responses' });
}

function schemaRef(name: string) {
  return componentRef({ name, category: 'schemas' });
}

function requestBodyRef(name: string) {
  return componentRef({ name, category: 'requestBodies' });
}

function strip(obj: any, parser: z.AnyZodObject) {
  if (Array.isArray(obj)) {
    obj = obj.map((item) => parser.parse(item));
  } else if (typeof obj === 'object' && obj !== null) {
    if (obj['$ref']) {
      return { $ref: obj['$ref'] };
    }
    Object.keys(obj).forEach((key) => {
      const item = obj[key];
      obj[key] = parser.parse(item);
    });
  }
  return obj;
}

const stripPropsfromRefs = (): any =>
  z
    .any()
    .transform((obj: any) => strip(obj, stripPropsfromRefs()))
    .transform((obj: any) => {
      if (obj && Array.isArray(obj.required) && obj.required.length === 0) {
        obj.required = undefined;
      }
      return obj;
    });

function toOperation(opts: {
  summary: string;
  tags?: string[];
  parameters?: string[];
  requestBody?: RequestBodyObject | ReferenceObject;
  responses: { status: number | 'default'; schema: ResponseObject | ReferenceObject }[];
}): OperationObject {
  return {
    summary: opts.summary,
    parameters: opts.parameters?.map((param) => ({
      $ref: componentRef({ name: param, category: 'parameters' })
    })),
    requestBody: opts.requestBody,
    responses: opts.responses.reduce<ResponsesObject>((acc, cur) => {
      acc[`${cur.status}`] = cur.schema;
      return acc;
    }, {}),
    tags: opts.tags
  };
}

function toResponseObjectWithRef(opts: {
  description: string;
  ref: string;
  example?: ExampleObject;
  isArray?: boolean;
}): ResponseObject {
  // omit data property, because we'll be using references.
  const document = schemas.success.omit({ data: true });
  const generated = generateSchema(document);
  if (opts.isArray) {
    generated.properties!.data = {
      type: 'array',
      items: {
        $ref: opts.ref
      }
    };
  } else {
    generated.properties!.data = {
      $ref: opts.ref
    };
  }
  return {
    description: opts.description,
    content: {
      [MEDIA_TYPE]: {
        schema: generated,
        example: opts.example
      }
    }
  };
}

export function createDocument(context: JsonapiContext): unknown {
  const builder = new OpenApiBuilder();
  builder.addInfo(
    Object.assign(
      {
        title: 'JSON:API server',
        version: '1.0'
      },
      context.options.openapi?.info
    )
  );
  // add shared schemas
  for (const [key, value] of Object.entries(schemas)) {
    builder.addSchema(key, generateSchema(value));
  }

  // add parameters
  builder
    .addParameter('resourceId', {
      name: 'id',
      in: 'path',
      schema: { type: 'string', minLength: 1 },
      required: true,
      description: 'Unique ID of the target resource'
    })
    .addParameter('resourceRelation', {
      name: 'relation',
      in: 'path',
      schema: { type: 'string', minLength: 1 },
      required: true,
      description: 'Relationship associated with the resource'
    })
    .addParameter('sort', {
      name: 'sort',
      in: 'query',
      description: 'Sort resources per the JSON:API specification',
      style: 'form',
      explode: false,
      required: false,
      schema: { type: 'string' }
    })
    .addParameter('include', {
      name: 'include',
      in: 'query',
      description: 'Fetch additional resources per the JSON:API specification',
      style: 'form',
      explode: false,
      required: false,
      schema: { type: 'string' }
    })
    .addParameter('filter', {
      name: 'filter',
      in: 'query',
      description: 'Filters resources per the JSON:API specification',
      style: 'deepObject',
      explode: true,
      required: false,
      schema: { type: 'string' }
    })
    .addParameter('page', {
      name: 'page',
      in: 'query',
      description: 'Paginates resource collection responses',
      style: 'deepObject',
      explode: true,
      required: false,
      schema: { type: 'string' }
    })
    .addParameter('fields', {
      name: 'fields',
      in: 'query',
      description: 'Sparse fieldsets per the JSON:API specification',
      required: false,
      schema: { type: 'string' }
    });

  // add error responses
  for (const [key, value] of Object.entries(documents)) {
    if (key.startsWith('error')) {
      const errorSchema = generateSchema(value as any);
      builder.addResponse(key, {
        description: errorSchema.description || '',
        content: {
          [MEDIA_TYPE]: {
            schema: errorSchema,
            example: (value as any).parse({})
          }
        }
      });
    }
  }

  // add basic responses
  builder
    .addResponse('relationResponse', {
      description: 'A relationship linkage response',
      content: {
        [MEDIA_TYPE]: {
          schema: {
            $ref: schemaRef('success')
          },
          example: {
            data: { id: '42', type: 'articles' }
          }
        }
      }
    })
    .addResponse('infoResponse', {
      description: 'An informational response',
      content: {
        [MEDIA_TYPE]: {
          schema: {
            $ref: schemaRef('info')
          },
          example: {
            meta: { success: true }
          }
        }
      }
    });

  // add resource specific components
  for (const def of context.options.definitions) {
    // add tag
    builder.addTag({
      name: def.resource,
      description: def.description
    });

    // add resource object schema
    const resourceData = resourceFromDef(def);
    const resourceName = resourceData.description!;
    builder.addSchema(resourceName, generateSchema(resourceData));

    // add example
    const exampleName = `${def.resource}Example`;
    const resourceResponseName = `${def.resource}Response`;
    const resourceResponseMultiName = `${def.resource}CollectionResponse`;
    const example = def.examples[0];
    const exampleSchema: ResourceSchema = {
      id: example.id,
      type: example.type,
      attributes: {},
      relationships: {}
    };
    forEachFieldInDefinition(def, {
      onPrimitive: (_, key) => (exampleSchema.attributes![key] = example[key]),
      onRelation: (field, key) => {
        exampleSchema.relationships![key] = {
          meta: relationshipMeta(field),
          data: example[key]
        };
      }
    });
    builder.addExample(exampleName, {
      summary: `A ${def.resource} resource`,
      value: exampleSchema
    });

    // add resource success responses
    builder
      .addResponse(
        resourceResponseName,
        toResponseObjectWithRef({
          description: `The target ${def.resource} resource`,
          ref: schemaRef(resourceName),
          example: {
            summary: `A ${def.resource} resource`,
            value: schemas.success.parse({ data: exampleSchema })
          }
        })
      )
      .addResponse(
        resourceResponseMultiName,
        toResponseObjectWithRef({
          description: `The list of ${def.resource} resources`,
          ref: schemaRef(resourceName),
          example: {
            summary: `A ${def.resource} resource collection`,
            value: schemas.success.parse({ data: [exampleSchema] })
          }
        })
      );

    // add request body
    const requestBodyName = `${def.resource}Request`;
    builder.addRequestBody(requestBodyName, {
      description: `A ${def.resource} request document`,
      required: true,
      content: {
        [MEDIA_TYPE]: {
          schema: generateSchema(
            z.object({
              data: ref(resourceData.omit({ id: true }))
            })
          ),
          example: {
            data: resourceData.parse(exampleSchema)
          }
        }
      }
    });

    // add paths
    const tags = [def.resource];
    builder.addPath(`/${def.resource}`, {
      get: toOperation({
        summary: `Search for ${def.resource} resources`,
        tags,
        parameters: ['sort', 'include', 'filter', 'page', 'fields'],
        responses: [
          {
            status: 200,
            schema: { $ref: responseRef(resourceResponseMultiName) }
          },
          {
            status: 500,
            schema: { $ref: responseRef(documents.error500Unknown) }
          },
          {
            status: 503,
            schema: { $ref: responseRef(documents.error503Unavailable) }
          }
        ]
      }),
      post: toOperation({
        summary: `Create a new ${def.resource} resource`,
        tags,
        requestBody: {
          $ref: requestBodyRef(requestBodyName)
        },
        responses: [
          {
            status: 201,
            schema: { $ref: responseRef(resourceResponseName) }
          },
          {
            status: 202,
            schema: { $ref: responseRef('infoResponse') }
          },
          {
            status: 204,
            schema: {
              description: 'The resource was created successfully'
            }
          },
          {
            status: 403,
            schema: { $ref: responseRef(documents.error403Forbidden) }
          },
          {
            status: 409,
            schema: { $ref: responseRef(documents.error409Conflict) }
          },
          {
            status: 500,
            schema: { $ref: responseRef(documents.error500Unknown) }
          },
          {
            status: 503,
            schema: { $ref: responseRef(documents.error503Unavailable) }
          }
        ]
      })
    });
    builder.addPath(`/${def.resource}/{id}`, {
      get: toOperation({
        summary: `Find a specific ${def.resource} resource`,
        tags,
        parameters: ['resourceId', 'fields', 'filter', 'include', 'sort'],
        responses: [
          {
            status: 200,
            schema: { $ref: responseRef(resourceResponseName) }
          },
          {
            status: 403,
            schema: { $ref: responseRef(documents.error403Forbidden) }
          },

          {
            status: 500,
            schema: { $ref: responseRef(documents.error500Unknown) }
          },
          {
            status: 503,
            schema: { $ref: responseRef(documents.error503Unavailable) }
          }
        ]
      }),
      patch: toOperation({
        summary: `Find a specific ${def.resource} resource`,
        tags,
        parameters: ['resourceId'],
        responses: [
          {
            status: 200,
            schema: { $ref: responseRef(resourceResponseName) }
          },
          {
            status: 202,
            schema: { $ref: responseRef('infoResponse') }
          },
          {
            status: 204,
            schema: {
              description: 'The resource was updated successfully'
            }
          },
          {
            status: 403,
            schema: { $ref: responseRef(documents.error403Forbidden) }
          },
          {
            status: 409,
            schema: { $ref: responseRef(documents.error409Conflict) }
          },
          {
            status: 500,
            schema: { $ref: responseRef(documents.error500Unknown) }
          },
          {
            status: 503,
            schema: { $ref: responseRef(documents.error503Unavailable) }
          }
        ]
      }),
      delete: toOperation({
        summary: `Removes a specific ${def.resource} resource`,
        tags,
        parameters: ['resourceId'],
        responses: [
          {
            status: 200,
            schema: { $ref: responseRef('infoResponse') }
          },
          {
            status: 202,
            schema: { $ref: responseRef('infoResponse') }
          },
          {
            status: 204,
            schema: {
              description: 'The resource was deleted successfully'
            }
          },
          {
            status: 403,
            schema: { $ref: responseRef(documents.error403Forbidden) }
          },
          {
            status: 500,
            schema: { $ref: responseRef(documents.error500Unknown) }
          },
          {
            status: 503,
            schema: { $ref: responseRef(documents.error503Unavailable) }
          }
        ]
      })
    });
    builder.addPath(`/${def.resource}/{id}/relationships/{relation}`, {
      // find
      get: toOperation({
        summary: 'Fetches resource relationships',
        tags,
        parameters: [
          'resourceId',
          'resourceRelation',
          'include',
          'filter',
          'sort',
          'page',
          'fields'
        ],
        responses: [
          {
            status: 200,
            schema: {
              $ref: responseRef('relationResponse')
            }
          },
          {
            status: 403,
            schema: { $ref: responseRef(documents.error403Forbidden) }
          },
          {
            status: 500,
            schema: { $ref: responseRef(documents.error500Unknown) }
          },
          {
            status: 503,
            schema: { $ref: responseRef(documents.error503Unavailable) }
          }
        ]
      }),
      // set
      patch: toOperation({
        summary: 'Updates the target resource relationships',
        tags,
        parameters: ['resourceId', 'resourceRelation'],
        responses: [
          {
            status: 200,
            schema: {
              $ref: responseRef('relationResponse')
            }
          },
          {
            status: 200,
            schema: {
              $ref: responseRef('infoResponse')
            }
          },
          {
            status: 204,
            schema: {
              description: 'The relationships was updated successfully'
            }
          },
          {
            status: 403,
            schema: { $ref: responseRef(documents.error403Forbidden) }
          },
          {
            status: 500,
            schema: { $ref: responseRef(documents.error500Unknown) }
          },
          {
            status: 503,
            schema: { $ref: responseRef(documents.error503Unavailable) }
          }
        ]
      }),
      // add
      post: toOperation({
        summary: 'Adds a new reference to the relationship list',
        tags,
        parameters: ['resourceId', 'resourceRelation'],
        responses: [
          {
            status: 200,
            schema: {
              $ref: responseRef('relationResponse')
            }
          },
          {
            status: 200,
            schema: {
              $ref: responseRef('infoResponse')
            }
          },
          {
            status: 204,
            schema: {
              description: 'The relationships was updated successfully'
            }
          },
          {
            status: 403,
            schema: { $ref: responseRef(documents.error403Forbidden) }
          },
          {
            status: 500,
            schema: { $ref: responseRef(documents.error500Unknown) }
          },
          {
            status: 503,
            schema: { $ref: responseRef(documents.error503Unavailable) }
          }
        ]
      }),
      // remove
      delete: toOperation({
        summary: 'Removes an existing reference from the relationship list',
        tags,
        parameters: ['resourceId', 'resourceRelation'],
        responses: [
          {
            status: 200,
            schema: {
              $ref: responseRef('relationResponse')
            }
          },
          {
            status: 200,
            schema: {
              $ref: responseRef('infoResponse')
            }
          },
          {
            status: 204,
            schema: {
              description: 'The relationships was updated successfully'
            }
          },
          {
            status: 403,
            schema: { $ref: responseRef(documents.error403Forbidden) }
          },
          {
            status: 500,
            schema: { $ref: responseRef(documents.error500Unknown) }
          },
          {
            status: 503,
            schema: { $ref: responseRef(documents.error503Unavailable) }
          }
        ]
      })
    });
    builder.addPath(`/${def.resource}/{id}/{relation}`, {
      get: toOperation({
        summary: 'Fetches resource(s) associated with the target relationship',
        tags,
        parameters: ['resourceId', 'resourceRelation'],
        responses: [
          {
            status: 200,
            schema: toResponseObjectWithRef({
              description: `The list of related resources`,
              isArray: true,
              ref: componentRef({ name: 'resource', category: 'schemas' })
            })
          },
          {
            status: 403,
            schema: { $ref: responseRef(documents.error403Forbidden) }
          },
          {
            status: 503,
            schema: { $ref: responseRef(documents.error503Unavailable) }
          }
        ]
      })
    });
  }

  const openapi = builder.getSpec();
  return stripPropsfromRefs().parse(openapi);
}

const handler = (): RouteShorthandOptionsWithHandler => {
  return {
    schema: {
      headers: documents.headers()
    },
    onSend: async (_req, reply) => {
      // ensure the reply content type is application/json
      reply.header('content-type', 'application/json');
    },
    config: {},
    handler: async (request, reply) => {
      const doc = createDocument(request.jsonapi);
      const config = reply.context.config as Record<string, unknown>;
      config.doc = doc;
      reply.status(200).send(doc);
      return reply;
    }
  };
};

export default handler;
