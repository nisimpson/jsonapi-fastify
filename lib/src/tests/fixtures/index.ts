/* eslint-disable @typescript-eslint/explicit-module-boundary-types */

import { FastifyInstance, LightMyRequestResponse } from 'fastify';
import { JsonapiFastifyOptions, JsonapiResourceDefinition } from '../../@types';
import { isPrimitiveDefinition } from '../../schemas/fields';
import { server } from '../../index';
import people, { PersonHandler } from './people';
import articles, { ArticleHandler } from './articles';
import comments, { CommentHandler } from './comments';
import tags, { TagHandler } from './tags';
import { MEDIA_TYPE } from '../../schemas/schema';

export function setupTestSuite() {
  beforeAll(() => {
    const app = build();
    app.ready(() => {
      console.log(app.printPlugins());
      console.log(app.printRoutes({ commonPrefix: false }));
    });
  });

  beforeEach(() => {
    resetHandlers();
  });
}

export function build(opts?: JsonapiFastifyOptions): FastifyInstance {
  const loggerLevel = process.env.LOG_LEVEL || 'silent';
  if (opts) {
    opts.test = true;
    opts.loggerLevel = loggerLevel;
  }
  const instance = server(
    opts ?? {
      test: true,
      loggerLevel,
      definitions: [comments, tags, people, articles]
    }
  );
  instance.addHook('onSend', (req, reply, payload, done) => {
    if (payload && loggerLevel !== 'silent') {
      const parsed = JSON.parse(payload as string);
      reply.log.debug(JSON.stringify(parsed, null, 2));
    }
    done();
  });
  return instance;
}

export function resetHandlers(): void {
  ArticleHandler.reset();
  CommentHandler.reset();
  PersonHandler.reset();
  TagHandler.reset();
}

function expect404(response: LightMyRequestResponse): void {
  expect(response.statusCode).toBe(404);
  expect(response.headers['content-type']).toContain(MEDIA_TYPE);
  const json = JSON.parse(response.body);
  expect(json).toStrictEqual({
    jsonapi: {
      version: '1.0'
    },
    errors: [
      {
        status: '404',
        code: 'ENOTFOUND',
        title: 'Resource not found',
        detail: `The requested resource does not exist on this server.`
      }
    ]
  });
}

function expectResponseToBe(
  response: LightMyRequestResponse,
  params: {
    statusCode: number;
    additionalHeaders?: {
      [key: string]: unknown;
    };
    body?: {
      [key: string]: unknown;
    };
  }
): void {
  expect(response.statusCode).toBe(params.statusCode);
  expect(response.headers['content-type']).toContain(MEDIA_TYPE);
  if (params.additionalHeaders) {
    Object.keys(params.additionalHeaders).forEach((key) => {
      expect(response.headers[key]).toBe(params.additionalHeaders![key]);
    });
  }
  if (params.body) {
    const json = JSON.parse(response.body);
    expect(json).toStrictEqual(params.body);
  } else {
    expect(response.body).toBeUndefined();
  }
}

type ToBeParams = Parameters<typeof expectResponseToBe>[1];

interface ExpectResponse {
  toBe(params: ToBeParams): void;
  to404(): void;
}

export function expectDocument(document: any) {
  const documentExpect = {
    toHaveSelfLink(url: string) {
      expect(document.links).toBeDefined();
      expect(document.links.self).toBe(url);
      return documentExpect;
    },
    toBeJsonapiVersion(version: string) {
      expect(document.jsonapi).toBeDefined();
      expect(document.jsonapi.version).toBe(version);
      return documentExpect;
    },
    toHaveMeta(meta?: any) {
      expect(document.meta).toBeDefined();
      expect(document.meta).toStrictEqual(meta);
      return documentExpect;
    },
    toHaveIncludes() {
      expect(document.included).toBeDefined();
      return {
        withCount(count: number) {
          expect(document.included.length).toBe(count);
        }
      };
    },
    toBeSingleResource() {
      expect(document.data).toBeDefined();
      expect(Array.isArray(document.data)).toBe(false);
    },
    toBeMultiResource() {
      expect(document.data).toBeDefined();
      expect(Array.isArray(document.data)).toBe(true);
      const multiResourceExpect = {
        withCount(count: number) {
          expect(document.meta).toBeDefined();
          expect(document.meta.count).toBe(count);
          expect(document.data.length).toBe(count);
          return documentExpect;
        }
      };
      return multiResourceExpect;
    },
    toContainErrors() {
      expect(document.errors).toBeDefined();
      expect(document.errors.length).toBeGreaterThan(0);
      const toContainErrors = {
        withCode(code: string) {
          expect(document.errors[0].code).toBe(code);
          return toContainErrors;
        },
        withStatus(status: string) {
          expect(document.errors[0].status).toBe(status);
          return toContainErrors;
        }
      };
      return toContainErrors;
    }
  };
  return documentExpect;
}

export function fromDefinition(definition: JsonapiResourceDefinition) {
  return {
    expectPrimaryData(data: any) {
      return expectPrimaryData(data, definition);
    }
  };
}

function expectPrimaryData(data: any, definition: JsonapiResourceDefinition) {
  return {
    toMatchExample(example: any) {
      expect(data.id).toBe(example.id);
      expect(data.type).toBe(example.type);
      expect(data.links).toBeDefined();
      expect(data.links.self).toBe(`/${example.type}/${example.id}`);
      expect(data.attributes).toBeDefined();

      for (const key of Object.keys(definition.fields)) {
        const schema = definition.fields[key];
        if (isPrimitiveDefinition(schema)) {
          expect(data.attributes[key]).toBe(example[key]);
        } else if (schema.relation.association === 'many') {
          expect(data.relationships[key].links).toBeDefined();
          expect(data.relationships[key].links.self).toBe(
            `/${example.type}/${example.id}/relationships/${key}`
          );
          expect(data.relationships[key].links.related).toBe(
            `/${example.type}/${example.id}/${key}`
          );
          if (schema.relation.association === 'many') {
            if (schema.relation.foreign === false) {
              expect(Array.isArray(data.relationships[key].data)).toBe(true);
              for (const item of data.relationships[key].data) {
                expect(item.id).toBeDefined();
                expect(item.type).toBe(schema.relation.type);
              }
            }
          }
          expect(data.relationships[key].meta).toEqual(
            expect.objectContaining({
              relation: schema.relation.foreign ? 'foreign' : 'primary',
              readOnly: schema.relation.foreign ? true : false,
              many: schema.relation.association === 'many'
            })
          );
        }
      }
    }
  };
}

export function expectResponse(response: LightMyRequestResponse): ExpectResponse {
  return {
    toBe(params: ToBeParams): void {
      return expectResponseToBe(response, params);
    },
    to404(): void {
      return expect404(response);
    }
  };
}

export { people, comments, articles, tags };
