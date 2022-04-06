import { RouteShorthandOptionsWithHandler } from 'fastify';
import { JsonapiContext, JsonapiResourceDefinition } from '../@types';
import * as zEndpoints from 'zod-endpoints';
import { z } from 'zod';
import {
  CONTENT_TYPE,
  Included,
  Jsonapi,
  Link,
  LinkRef,
  LinksRecord,
  Meta,
  NonEmptyString,
  RelationshipData,
  RelationshipLinks,
  ResourceObject,
  ResourceObjectType,
  ResourceRef,
  Url
} from '../schemas/common';
import {
  OpenAPIObject,
  OperationObject,
  PathItemObject,
  ReferenceObject,
  RequestBodyObject,
  ResponseObject,
  ResponsesObject
} from 'openapi3-ts';
import { extendApi, generateSchema, OpenApiZodAny } from '@anatine/zod-openapi';
import {
  DOCUMENT,
  ACCEPTED_202,
  CONFLICT_409,
  FORBIDDEN_403,
  NOT_ACCEPTABLE_406,
  RELATION_NOT_FOUND_404,
  RESOURCE_FOREIGN_404,
  RESOURCE_NOT_FOUND_404,
  RESOURCE_OK_200,
  UNAVAILABLE_503,
  UNKNOWN_ERROR_500,
  ErrorObject
} from '../schemas/response';
import { CREATE } from '../schemas/request';

type CategoryKey = keyof OperationObject;

type ResponseKey =
  | 'H200_RES_OK'
  | 'H200_REL_OK'
  | 'H202_ACCEPTED'
  | 'H403_FORBIDDEN'
  | 'H404_FOREIGN'
  | 'H404_RES_NOT_FOUND'
  | 'H404_REL_NOT_FOUND'
  | 'H406_NOT_ACCEPTABLE'
  | 'H409_CONFLICT'
  | 'H500_UNKNOWN_ERR'
  | 'H503_UNAVAILABLE';

type ParameterKey =
  | 'resourceId'
  | 'resourceRelation'
  | 'sort'
  | 'include'
  | 'filter'
  | 'page'
  | 'fields';

const stripPropsfromRefs = () =>
  z.any().transform((obj) => {
    const strip = stripPropsfromRefs();
    if (Array.isArray(obj)) {
      obj = obj.map((item) => strip.parse(item));
    } else if (typeof obj === 'object' && obj !== null) {
      if (obj['$ref']) {
        return { $ref: obj['$ref'] };
      }
      Object.keys(obj).forEach((key) => {
        const item = obj[key];
        obj[key] = strip.parse(item);
      });
    }
    return obj;
  });

function componentRef(opts: { name: string; category: CategoryKey }) {
  return `#/components/${opts.category}/${opts.name}`;
}

function toResponseObject(schema: OpenApiZodAny): ResponseObject {
  const generated = generateSchema(schema);
  return {
    description: generated.description ?? 'A response object',
    content: {
      [CONTENT_TYPE]: {
        schema: generated
      }
    }
  };
}

function toRequestBodyObject(
  schema: OpenApiZodAny,
  opts: {
    exampleName: string;
    exampleRef: string;
  }
): RequestBodyObject {
  const generated = generateSchema(schema);
  return {
    description: generated.description ?? 'A request document',
    content: {
      [CONTENT_TYPE]: {
        schema: generated,
        examples: {
          [opts.exampleName]: {
            $ref: componentRef({ name: opts.exampleRef, category: 'examples' })
          }
        }
      }
    }
  };
}

function toResponseObjectWithRef(opts: {
  description: string;
  ref: string;
  isArray?: boolean;
}): ResponseObject {
  // omit data property, because we'll be using references.
  const document = extendApi(RESOURCE_OK_200().omit({ data: true }));
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
      [CONTENT_TYPE]: {
        schema: generated
      }
    }
  };
}

function toOperation(opts: {
  summary: string;
  tags?: string[];
  parameters?: ParameterKey[];
  requestBody?: RequestBodyObject;
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

function generateBase(context: JsonapiContext): Promise<OpenAPIObject> {
  const openapi = context.options.openapi;

  const schemas = {
    meta: generateSchema(Meta),
    jsonapi: generateSchema(Jsonapi),
    url: generateSchema(Url),
    linkRef: generateSchema(LinkRef),
    link: generateSchema(Link),
    linksRecord: generateSchema(LinksRecord),
    error: generateSchema(ErrorObject),
    resourceRef: generateSchema(ResourceRef()),
    relationshipData: generateSchema(extendApi(RelationshipData())),
    included: generateSchema(Included)
  };

  const responses: Record<ResponseKey, ResponseObject> = {
    H200_RES_OK: toResponseObject(DOCUMENT),
    H200_REL_OK: toResponseObjectWithRef({
      description: 'JSON:API relationship response',
      ref: componentRef({ name: 'relationshipData', category: 'schemas' })
    }),
    H202_ACCEPTED: toResponseObject(ACCEPTED_202),
    H409_CONFLICT: toResponseObject(CONFLICT_409),
    H406_NOT_ACCEPTABLE: toResponseObject(NOT_ACCEPTABLE_406),
    H403_FORBIDDEN: toResponseObject(FORBIDDEN_403),
    H503_UNAVAILABLE: toResponseObject(UNAVAILABLE_503),
    H404_FOREIGN: toResponseObject(RESOURCE_FOREIGN_404),
    H404_RES_NOT_FOUND: toResponseObject(RESOURCE_NOT_FOUND_404),
    H404_REL_NOT_FOUND: toResponseObject(RELATION_NOT_FOUND_404),
    H500_UNKNOWN_ERR: toResponseObject(UNKNOWN_ERROR_500)
  };

  const docs: PathItemObject = {
    get: {
      summary: 'Returns this OpenAPI document.',
      responses: {
        '200': {
          description: 'Success',
          content: {
            'application/json': {}
          }
        }
      }
    }
  };

  return Promise.resolve({
    openapi: '3.0.0',
    info: Object.assign(
      {
        title: 'JSON:API Server',
        version: '1.0'
      },
      openapi?.info
    ),
    paths: {
      '/openapi.json': { ...docs }
    },
    components: {
      schemas,
      responses,
      examples: {},
      parameters: {
        resourceId: {
          name: 'id',
          in: 'path',
          schema: { type: 'string', minLength: 1 },
          required: true,
          description: 'Unique ID of the target resource'
        },
        resourceRelation: {
          name: 'relation',
          in: 'path',
          schema: { type: 'string', minLength: 1 },
          required: true,
          description: 'Relationship associated with the resource'
        },
        sort: {
          name: 'sort',
          in: 'query',
          description: 'Sort resources per the JSON:API specification',
          style: 'form',
          explode: false,
          required: false,
          schema: { type: 'string' }
        },
        include: {
          name: 'include',
          in: 'query',
          description: 'Fetch additional resources per the JSON:API specification',
          style: 'form',
          explode: false,
          required: false,
          schema: { type: 'string' }
        },
        filter: {
          name: 'filter',
          in: 'query',
          description: 'Filters resources per the JSON:API specification',
          style: 'deepObject',
          explode: true,
          required: false,
          schema: { type: 'string' }
        },
        page: {
          name: 'page',
          in: 'query',
          description: 'Paginates resource collection responses',
          style: 'deepObject',
          explode: true,
          required: false,
          schema: { type: 'string' }
        },
        fields: {
          name: 'fields',
          in: 'query',
          description: 'Sparse fieldsets per the JSON:API specification',
          required: false,
          schema: { type: 'string' }
        }
      }
    },
    tags: []
  });
}

function populateDocument(context: JsonapiContext) {
  return async (openapi: OpenAPIObject) => {
    function populateTags(def: JsonapiResourceDefinition): void {
      openapi.tags!.push({
        name: def.resource,
        description: def.description
      });
    }

    const resourceRefName = (def: JsonapiResourceDefinition) => `${def.resource}Resource`;
    const exampleName = (def: JsonapiResourceDefinition) => `${def.resource}Example`;
    const requestExampleName = (def: JsonapiResourceDefinition) => `${def.resource}RequestExample`;

    function populateComponents(def: JsonapiResourceDefinition): void {
      const resourceObject = extendApi(ResourceObject({ definition: def }), {
        description: def.description
      });
      openapi.components!.schemas![resourceRefName(def)] = generateSchema(resourceObject);

      if (def.examples.length > 0) {
        const example = def.examples[0];
        const resourceExample = zEndpoints
          .record(zEndpoints.any())
          .transform((arg) => {
            const result: ResourceObjectType = {
              id: arg.id,
              type: arg.type,
              attributes: {},
              relationships: {}
            };
            for (const [key, field] of Object.entries(def.fields)) {
              if (field.kind === 'primitive') {
                result.attributes![key] = example[key];
              } else {
                result.relationships![key] = example[key];
              }
            }
            return result;
          })
          .parse(example);

        openapi.components!.examples![exampleName(def)] = {
          summary: `A ${def.resource} resource`,
          value: resourceExample
        };
        openapi.components!.examples![requestExampleName(def)] = {
          summary: `A ${def.resource} request object`,
          value: { ...resourceExample, id: undefined }
        };
      }
    }

    const responseStatusCodes: Record<ResponseKey, number> = {
      H200_REL_OK: 200,
      H200_RES_OK: 200,
      H202_ACCEPTED: 202,
      H403_FORBIDDEN: 403,
      H404_FOREIGN: 404,
      H404_RES_NOT_FOUND: 404,
      H404_REL_NOT_FOUND: 404,
      H406_NOT_ACCEPTABLE: 406,
      H409_CONFLICT: 409,
      H500_UNKNOWN_ERR: 500,
      H503_UNAVAILABLE: 503
    };

    function useResponseRef(key: ResponseKey) {
      return {
        status: responseStatusCodes[key],
        schema: { $ref: componentRef({ name: key, category: 'responses' }) }
      };
    }

    function noContent(description: string) {
      return {
        status: 204,
        schema: {
          description
        }
      };
    }

    function populatePaths(def: JsonapiResourceDefinition): void {
      const tags = [def.resource];
      const name = resourceRefName(def);
      const collection: PathItemObject = {
        // search
        get: toOperation({
          summary: `Search for ${def.resource} resources`,
          tags,
          parameters: ['sort', 'include', 'filter', 'page', 'fields'],
          responses: [
            {
              status: 200,
              schema: toResponseObjectWithRef({
                description: `The list of ${def.resource} resources`,
                isArray: true,
                ref: componentRef({ name, category: 'schemas' })
              })
            },
            useResponseRef('H500_UNKNOWN_ERR'),
            useResponseRef('H503_UNAVAILABLE')
          ]
        })
      };
      const item: PathItemObject = {
        // find
        get: toOperation({
          summary: `Find a specific ${def.resource} resource`,
          tags,
          parameters: ['resourceId', 'fields', 'filter', 'include', 'sort'],
          responses: [
            {
              status: 200,
              schema: toResponseObjectWithRef({
                description: `The target ${def.resource} resource`,
                ref: componentRef({ name, category: 'schemas' })
              })
            },
            useResponseRef('H403_FORBIDDEN'),
            useResponseRef('H500_UNKNOWN_ERR'),
            useResponseRef('H503_UNAVAILABLE')
          ]
        }),
        // create
        post: toOperation({
          summary: `Create a new ${def.resource} resource`,
          tags,
          parameters: ['resourceId'],
          requestBody: toRequestBodyObject(CREATE(def), {
            exampleName: def.resource,
            exampleRef: requestExampleName(def)
          }),
          responses: [
            {
              status: 200,
              schema: toResponseObjectWithRef({
                description: `The created ${def.resource} resource`,
                ref: componentRef({ name, category: 'schemas' })
              })
            },
            noContent('The resource was created successfully'),
            useResponseRef('H202_ACCEPTED'),
            useResponseRef('H403_FORBIDDEN'),
            useResponseRef('H409_CONFLICT'),
            useResponseRef('H500_UNKNOWN_ERR'),
            useResponseRef('H503_UNAVAILABLE')
          ]
        }),
        // update
        patch: toOperation({
          summary: `Find a specific ${def.resource} resource`,
          tags,
          parameters: ['resourceId'],
          responses: [
            {
              status: 200,
              schema: toResponseObjectWithRef({
                description: `The target ${def.resource} resource`,
                ref: componentRef({ name, category: 'schemas' })
              })
            },
            noContent('The resource was updated successfully'),
            useResponseRef('H202_ACCEPTED'),
            useResponseRef('H403_FORBIDDEN'),
            useResponseRef('H409_CONFLICT'),
            useResponseRef('H500_UNKNOWN_ERR'),
            useResponseRef('H503_UNAVAILABLE')
          ]
        }),
        // delete
        delete: toOperation({
          summary: `Removes a specific ${def.resource} resource`,
          tags,
          parameters: ['resourceId'],
          responses: [
            useResponseRef('H200_RES_OK'),
            useResponseRef('H202_ACCEPTED'),
            {
              status: 204,
              schema: {
                description: 'The resource was deleted successfully'
              }
            },
            useResponseRef('H403_FORBIDDEN'),
            useResponseRef('H500_UNKNOWN_ERR'),
            useResponseRef('H503_UNAVAILABLE')
          ]
        })
      };
      const relation: PathItemObject = {
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
            useResponseRef('H200_REL_OK'),
            useResponseRef('H403_FORBIDDEN'),
            useResponseRef('H500_UNKNOWN_ERR'),
            useResponseRef('H503_UNAVAILABLE')
          ]
        }),
        // set
        patch: toOperation({
          summary: 'Updates the target resource relationships',
          tags,
          parameters: ['resourceId', 'resourceRelation'],
          responses: [
            useResponseRef('H200_REL_OK'),
            useResponseRef('H202_ACCEPTED'),
            noContent('The relationship was updated successfully'),
            useResponseRef('H403_FORBIDDEN'),
            useResponseRef('H500_UNKNOWN_ERR'),
            useResponseRef('H503_UNAVAILABLE')
          ]
        }),
        // add
        post: toOperation({
          summary: 'Adds a new reference to the relationship list',
          tags,
          parameters: ['resourceId', 'resourceRelation'],
          responses: [
            useResponseRef('H200_REL_OK'),
            useResponseRef('H202_ACCEPTED'),
            noContent('The relationship was updated successfully'),
            useResponseRef('H403_FORBIDDEN'),
            useResponseRef('H500_UNKNOWN_ERR'),
            useResponseRef('H503_UNAVAILABLE')
          ]
        }),
        // remove
        delete: toOperation({
          summary: 'Removes an existing reference from the relationship list',
          tags,
          parameters: ['resourceId', 'resourceRelation'],
          responses: [
            useResponseRef('H200_REL_OK'),
            useResponseRef('H202_ACCEPTED'),
            noContent('The relationship was updated successfully'),
            useResponseRef('H403_FORBIDDEN'),
            useResponseRef('H500_UNKNOWN_ERR'),
            useResponseRef('H503_UNAVAILABLE')
          ]
        })
      };
      const findRelated: PathItemObject = {
        get: toOperation({
          summary: 'Fetches resource(s) associated with the target relationship',
          tags,
          parameters: ['resourceId', 'resourceRelation'],
          responses: [
            useResponseRef('H200_RES_OK'),
            useResponseRef('H403_FORBIDDEN'),
            useResponseRef('H503_UNAVAILABLE')
          ]
        })
      };
      openapi.paths[`/${def.resource}`] = { ...collection };
      openapi.paths[`/${def.resource}/{id}`] = { ...item };
      openapi.paths[`/${def.resource}/{id}/relationships/{relation}`] = { ...relation };
      openapi.paths[`/${def.resource}/{id}/{relation}`] = { ...findRelated };
    }

    context.options.definitions.forEach((def) => {
      populateTags(def);
      populateComponents(def);
      populatePaths(def);
    });
    return stripPropsfromRefs().parse(openapi);
  };
}

async function generateOpenapiDoc(context: JsonapiContext): Promise<OpenAPIObject> {
  // prettier-ignore
  const document = await generateBase(context).then(populateDocument(context));
  return document;
}

const handler = (): RouteShorthandOptionsWithHandler => {
  return {
    schema: {
      headers: z
        .object({
          accept: NonEmptyString.refine(
            (val) => {
              return (
                val.includes('*/*') ||
                val.includes('application/json') ||
                val.includes(CONTENT_TYPE)
              );
            },
            {
              message: 'Missing or invalid accept header'
            }
          )
        })
        .passthrough()
    },
    onSend: async (_req, reply) => {
      // ensure the reply content type is application/json
      reply.header('content-type', 'application/json');
    },
    handler: async (request, reply) => {
      const doc = await generateOpenapiDoc(request.jsonapi);
      reply.status(200).send(doc);
      return reply;
    }
  };
};

export default handler;
