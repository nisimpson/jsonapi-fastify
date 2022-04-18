import type {
  FastifyLoggerInstance,
  FastifyPluginOptions,
  FastifyReply,
  FastifyRequest
} from 'fastify';
import { JsonapiErrorObject, RelatedResourceDocument, ResourceDocument } from 'src/@types/jsonapi-spec';
import type { FieldDefinition } from '../schemas/fields';
import type { Handler, HandlerResult } from './handler';
import { InfoObject } from 'openapi3-ts';

export type HttpVerbs = 'GET' | 'POST' | 'DELETE' | 'PUT' | 'PATCH';

export type JsonapiError = JsonapiErrorObject;

export interface JsonapiQuery {
  include?: string[];
  filter?: {
    [key: string]: unknown;
  };
  sort?: string[];
  fields?: {
    [key: string]: string[];
  };
  page?: {
    cursor?: string;
    limit?: number;
    offset?: number;
  };
  [key: string]: unknown;
}

export interface JsonapiPathParams {
  id?: string;
  relation?: string;
  [key: string]: unknown;
}

export interface JsonapiRequest {
  query: JsonapiQuery;
  params: JsonapiPathParams;
  fastify: {
    request: FastifyRequest;
    reply: FastifyReply;
  };
}

export type JsonapiResource<TItem = Record<string, unknown>> = TItem & {
  id: string;
  type: string;
};

export type ToOneRelation = JsonapiResource | null;
export type ToManyRelation = JsonapiResource[];
export type JsonapiRelation = ToOneRelation | ToManyRelation;

type Attributes<TItem> = {
  [x in keyof TItem]: FieldDefinition;
};

export type JsonapiResourceAttributes<TItem> = Omit<Attributes<TItem>, 'id' | 'type'>;

export type JsonapiHandler<TResource = any> = Handler<
  JsonapiResourceDefinition<TResource>,
  JsonapiRequest,
  JsonapiResource<TResource>,
  JsonapiError,
  JsonapiContext
>;

export type JsonapiResourceDefinition<TResource = any> = {
  namespace?: string;
  description?: string;
  resource: string;
  handlers: JsonapiHandler<TResource>;
  fields: JsonapiResourceAttributes<TResource>;
  examples: JsonapiResource<TResource>[];
  searchParams?: Partial<Attributes<TResource>>;
  allowsIdOnCreate?: boolean;
  createsResourceAsync?: boolean;
  defaultPageSize: number;
  idGenerator: () => string;
};

export interface JsonapiFastifyOptions extends FastifyPluginOptions {
  urlPrefixAlias?: string;
  meta?: Record<string, unknown>;
  openapi?: {
    info?: InfoObject;
  };
  definitions: JsonapiResourceDefinition[];
  pagination?: 'cursor' | 'offset';
  loggerLevel?: string;
  test?: boolean;
}

type JsonapiResult = JsonapiResource | JsonapiResource[];
type JsonapiResponse = HandlerResult<JsonapiResult, JsonapiError, any>;

export type JsonapiContext = {
  options: JsonapiFastifyOptions;
  request?: JsonapiRequest;
  response: JsonapiResponse;
  included?: JsonapiResource[];
  resource?: JsonapiResource | JsonapiRelation;
  definitions: {
    [key: string]: JsonapiResourceDefinition;
  };
  log: FastifyLoggerInstance;
  baseUrl: string;
  document?: ResourceDocument | RelatedResourceDocument;
  query(request: FastifyRequest): JsonapiQuery;
  params(request: FastifyRequest): JsonapiPathParams;
  isMultiResource(value?: JsonapiResult): value is JsonapiResource[];
  isSingleResource(value?: JsonapiResult): value is JsonapiResource;
  [key: string]: unknown;
};
