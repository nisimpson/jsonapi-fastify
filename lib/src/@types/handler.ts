import { FastifyRequest } from 'fastify';
import { Meta } from 'src/@types/jsonapi-spec';

export type PageData = {
  prev?: string | number;
  next?: string | number;
};

export interface HandlerResult<TResource, TError = unknown, TPage = never> {
  result?: TResource;
  page?: TPage;
  meta?: Meta;
}

interface Response<TResource, TError, TPage = never> {
  /**
   * Returns a successful response; The response status will differ by operation:
   *  - For search and find operations, this will return:
   *    - 200 if result is defined
   *    - 500 if result is undefined
   *  - For create operations, this will return:
   *    - 201 if result is defined
   *    - 204 if result is undefined and client generated id is provided
   *  - For update operations, this will return:
   *    - 200 if result is defined
   *    - 204 if result is undefined
   *
   * @param result The existing or newly created resource
   * @param count The number of resources that were retrieved from the server.
   */
  ok(result?: TResource, page?: TPage): HandlerResult<TResource, TError, TPage>;
  /** Returns a 404 for non existent resource(s). */
  notFound(): HandlerResult<TResource, TError, TPage>;
  /**
   * Halts further processing and sends the specified errors directly to the client.
   *
   * @param errors The server errors.
   */
  error(errors: TError[]): HandlerResult<TResource, TError, TPage>;
  /**
   * Sends a 202 response for requests that have been accepted for processing,
   * but must be resolved asynchronously.
   *
   * @param meta Optional meta information to include in the response.
   */
  accepted(meta?: Meta): HandlerResult<TResource, TError>;
  /**
   * Sends a 409 response under the following conditions:
   *  - For create operations:
   *    - A resource already exists with the client generated ID
   *    - The resource type is not among the type(s) that represent the collection
   *      represented by the endpoint.
   */
  conflict(): HandlerResult<TResource, TError, TPage>;
}

export type SearchResponse<TResource, TError> = Pick<
  Response<TResource[], TError, PageData>,
  'ok' | 'notFound' | 'error'
>;

export type SearchResult<TResource, TError> = HandlerResult<TResource[], TError, PageData>;

export type SearchFunction<TRequest, TResource, TError> = (params: {
  /**
   * The incoming request object.
   */
  request: TRequest;
  /**
   * The response object. Contains helper functions for sending
   * valid responses.
   */
  response: SearchResponse<TResource, TError>;
}) => Promise<SearchResult<TResource, TError>>;

export type FindResponse<TResource, TError> = Pick<
  Response<TResource, TError>,
  'ok' | 'notFound' | 'error'
>;

export type FindResult<TResource, TError> = HandlerResult<TResource, TError>;

export type FindFunction<TRequest, TResource, TError> = (params: {
  /**
   * The incoming request object.
   */
  request: TRequest;
  /**
   * The response object. Contains helper functions for sending
   * valid responses.
   */
  response: FindResponse<TResource, TError>;
}) => Promise<HandlerResult<TResource, TError>>;

export type UpdateResponse<TResource, TError> = Pick<
  Response<TResource, TError, never>,
  'ok' | 'accepted' | 'notFound' | 'error'
>;

export type UpdateResult<TResource, TError> = HandlerResult<TResource, TError>;

export type UpdateRelationshipOperation =
  | 'relationship:update'
  | 'relationship:add'
  | 'relationship:remove';

export type UpdateFunction<TRequest, TResource, TError> = (params: {
  /**
   * The incoming request object.
   */
  request: TRequest;
  /**
   * The resource data to merge into the existing resource.
   */
  data: TResource;
  /**
   * The kind of update operation requested by the client:
   *  - "update": Perform an update on the requested resource
   *  - "relationship:update": Modify the target relationship on the requested
   *    resource
   *  - "relationship:add": Adds resource ref(s) to a to-many relationship
   *    on the requested resource
   *  - "relationship:remove": Removes resource ref(s) from a to-many relationship
   */
  operation: 'update' | UpdateRelationshipOperation;
  /**
   * The response object. Contains helper functions for sending
   * valid responses.
   */
  response: Response<TResource, TError>;
}) => Promise<UpdateResult<TResource, TError>>;

export type CreateResponse<TResource, TError> = Pick<
  Response<TResource, TError, never>,
  'ok' | 'accepted' | 'notFound' | 'error' | 'conflict'
>;

export type CreateResult<TResource, TError> = UpdateResult<TResource, TError>;

export type CreateFunction<TRequest, TResource, TError> = (params: {
  /**
   * The incoming request object.
   */
  request: TRequest;
  /**
   * The resource data to create.
   */
  data: TResource;
  /**
   * The response object. Contains helper functions for sending
   * valid responses.
   */
  response: CreateResponse<TResource, TError>;
}) => Promise<CreateResult<TResource, TError>>;

export type DeleteResponse<TError> = Pick<Response<never, TError>, 'error' | 'notFound'> & {
  /**
   * Sends the following to the client indicating a successful deletion:
   *  - 200 if meta information is defined
   *  - 204 if meta information is undefined
   *
   * @param meta Optional metadata to return to the client.
   */
  ok(meta?: Meta): HandlerResult<never, TError>;

  /**
   * Sends a 202 response for requests that have been accepted for processing,
   * but must be resolved asynchronously.
   */
  accepted(meta?: Meta): HandlerResult<never, TError>;
};

export type DeleteResult<TError> = HandlerResult<never, TError>;

export type DeleteFunction<TRequest, TError> = (params: {
  /**
   * The incoming request object.
   */
  request: TRequest;
  /**
   * The response object. Contains helper functions for sending
   * valid responses.
   */
  response: DeleteResponse<TError>;
}) => Promise<DeleteResult<TError>>;

export type HandlerOperation = 'create' | 'search' | 'find' | 'update' | 'delete';

/**
 * Interface for handling incoming jsonapi requests.
 *
 * @type TConfig The handler or resource configuration type.
 * @type TRequest The handler request type.
 * @type TResource The resource target type for this handler.
 * @type TError The handler error object type.
 * @type TContext The context object type.
 */
export interface Handler<TConfig, TRequest, TResource, TError, TContext> {
  /**
   * Invoked whenever a request is received. Useful for allocating memory,
   * connecting to databases, etc.
   *
   * @param config The resource handler configuration.
   * @param context The current jsonapi context.
   */
  initialize(config: TConfig, context: TContext): unknown;
  /**
   * Determines if the request has been authorized by the server. If the request
   * is rejected, subsequent processing is halted and a 401 unauthorized response
   * is returned to the client.
   *
   * @params operation The requested operation.
   * @params request The incoming fastify request object.
   * @returns true if the request is authorized; false otherwise.
   */
  authorize?: (operation: HandlerOperation, request: FastifyRequest) => Promise<boolean>;
  /**
   * Invoked when a request to create a new resource is received.
   */
  create?: CreateFunction<TRequest, TResource, TError>;
  /**
   * Invoked when a request to search for resources that match specified
   * criteria is received.
   */
  search?: SearchFunction<TRequest, TResource, TError>;
  /**
   * Invoked when a request to find a specific resource is received.
   */
  find?: FindFunction<TRequest, TResource, TError>;
  /**
   * Invoked when a request to update a resource or its relationships
   * is received.
   */
  update?: UpdateFunction<TRequest, TResource, TError>;
  /**
   * Invoked when a request to delete a resource is received.
   */
  delete?: DeleteFunction<TRequest, TError>;
  /**
   * Invoked when server.close() is called. Useful for performing any cleanup
   * operations.
   */
  close(): unknown;
  /**
   * Determines if the handler is ready to process the specified operation.
   *
   * @param operation The handler operation requested.
   */
  ready(operation: HandlerOperation): boolean;
  allowSort: boolean;
  allowFilter: boolean;
  pagination: 'offset' | 'cursor';
}
