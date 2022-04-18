## Creating Custom Handlers

Handlers represent the mechanism that backs a resource. Each handler is an object expected to provide:

- an `initialize` function - when jsonapi-fastify loads, this is invoked first on request. Its an opportunity to allocate memory, connect to databases, etc.

- a `ready` function - indicates if the handler is ready to process requests.

- some of the following optional functions:
  - `authorize` - determines if the request has access to the resource and operation
  - `close` - for cleaning up upon `server.close()`
  - `search` - for searching for resources that match some vague parameters.
  - `find` - for finding a specific resource by id.
  - `create` - for creating a new instance of a resource.
  - `delete` - for deleting an existing resource.
  - `update` - for updating an existing resource.

Failure to provide the above handler functions will result in `EFORBIDDEN` HTTP errors if the corresponding REST routes are requested.

### Handler Parameters

Each operation handler is invoked with a single object, `params`, containing the following properties:

- `request`
- `response`
- `data` (create, update only)
- `operation` (update only, see update handler section)

#### The `data` Property

All data stored behind handlers should be stored in a developer-friendly format with both attributes and relations mingled together in a simple Plain Old Javascript Object (POJO):

```javascript
{
  id: "aab14844-97e7-401c-98c8-0bd5ec922d93",
  type: "photos",
  title: "Matrix Code",
  url: "http://www.example.com/foobar",
  photographer: { type: "people", id: "ad3aa89e-9c5b-4ac9-a652-6670f9f27587" }
}
```

In the above example the `photographer` attribute is defined as relation to a resource of type `people`. jsonapi-fastify will deal with shuffling around and separating those attributes and relations when it needs to. Keep It Simple.

#### The `request` Property

All requests are presented to handlers in the following format:

```javascript
{
  query: {
    // ?sort=first,-second
    sort: ["first", "-second"],
    // ?page=[offset]=10&page[limit]=100
    page: {
      offset: 10,
      limit: 100
    }
    // ?filter[foo]=bar&filter[baz][duz]=true&filter[id]=abc,def
    filter: {
      foo: "bar",
      baz: { duz: "true" },
      id: ["abc", "def"]
    }
  },
  params: {
    // All request parameters get combined into this object.
    id: "8dd6278a-a5bc-4e57-ac2b-f28901ba79fc",
    relation: "owner",
    // In addition, the request body is parsed and stored in the resource key
    resource: { ... }
  },
  // For conveinence, the fastify request and reply objects are provided
  fastify: {
    request: { ... },
    reply: { ... }
  }
}
```

#### The `response` Property

The response property passed into each handler request object provides context specific
functions that help users return the correct response that matches the server's intention:

```javascript
{
  async create({ response, data }) {
    const result = await model.save(data);
    // data is returned in a 201 created response as primary data
    return response.ok(result);
  },
  async find({ request, response }) {
    const result = await model.get(request.params.id);
    if (result === undefined) {
      return response.notFound();
    }
    return response.ok(result);
  },
  async delete({ request, response }) {
    const jobId = await model.addToWorkerQueue('delete', request.params.id);
    // data is returned in a 202 accepted response
    // in the top level meta field
    return response.accepted({ success: true, jobId });
  }
}
```

#### The `operation` Property

A string value, only found on `update` handler requests.

- `update`: Perform an update on the requested resource. Properties of `data` should be merged with the target resource.
- `relationship:update`: Modify the target relationship on the requested resource. The target relationship should be replaced with the relationship property in `data`.
- `relationship:add`: Adds resource ref(s) to a to-many relationship on the target resource.
- `relationship:remove`: Removes resource refs(s) from a to-many relationship on the target resource.

### The `error` Format

While most common errors (not found, conflict) is handled via the response property, any custom errors should be provided in the following format:

```javascript
{
  // The desired HTTP code
  status: "404",
  // A very short identifier for this error
  code: "ENOTFOUND",
  // A short human readable description
  title: "Requested resource does not exist",
  // Some detail to assist debugging
  detail: "There is no "+request.params.type+" with id "+request.params.id
}
```

### Handler Functions

#### ready

The `ready` property should return `true` once the handler is ready to process requests (which will usually happen at the end of `initialize`). If the handler is temporarily unable to process requests this property should return `false` during the down period.

#### initialize

`initialise` is invoked with the definition of each resource using this handler, along with the current context.

```javascript
(definition, context) => {};
```

`definition` is the complete resource definition object returned from `define()`.

#### close

`close` is invoked without any parameters, when `server.close()` is called.
It should close database connections, file handles, timers, event listeners, etc, as though `initialize` were never called.

#### search

The `search` function parameter contains the following properties:

- `request` - The request object
- `response` - The response object

```javascript
async ({ request, response }) => {};
```

The function should return a promised result; use the `response` object for valid result data.

**NOTE:** `search` needs to watch for any `request.params.filter` parameters, as they may represent foreign key lookups. An example of this:

```javascript
request.params.filter = {
  user: "ad3aa89e-9c5b-4ac9-a652-6670f9f27587",
};
```

translates to "Find me all of the resources whose user attribute is a link to a resource with id == ad3aa89e-9c5b-4ac9-a652-6670f9f27587". A `request.params.parent` object is also provided, containing the original resource request information.

#### find

The `find` function parameter contains the following properties:

- `request` - The request object
- `response` - The response object

```javascript
async ({ request, response }) => {};
```

The function should return a promised result; use the `response` object for valid result data.

#### create

The `create` function parameter contains the following properties:

- `request` - The request object
- `response` - The response object
- `data` - The resource; the object is populated with a new `id` and its properties have already been validated and can be stored.

```javascript
async ({ request, response, data }) => {};
```

The function should return a promised result; use the `response` object for valid result data.

#### delete

The `delete` function parameter contains the following properties:

- `request` - The request object
- `response` - The response object

```javascript
async ({ request, response }) => {};
```

The function should return a promised result; use the `response` object for valid result data.

#### update

The `update` function parameter contains the following properties:

- `request` - The request object
- `response` - The response object
- `data` - The partial resource; properties of `data` need to applied to target resource based on the request operation indicated by the `operation` property (see below)
- `operation` - A string indicating the type of update request

```javascript
async ({ request, response, data, operation }) => {};
```

The function should return a promised result; use the `response` object for valid result data.

### Resource Handler

Users may opt to create handlers using the `ResourceHandler` function:

```javascript
const { ResourceHandler } = require("jsonapi-fastify");

module.exports = ResourceHandler({
  // For better isolation of individual resource updates, define optional handlers
  // on a per-relationship basis:
  relationships: {
    // handlers only apply to the 'owner' relationship
    owner: {
      /**
       * Invoked when the client wishes to replace the target resource relationship
       * with the specified payload.
       */
      set: async (params) => {},
      /**
       * Invoked when the client wishes to add specified resources to
       * the target resource 'to-many' relationship.
       */
      add: async (params) => {},
      /**
       * Invoked when the client wishes to remove specified resources from
       * the target resource 'to-many' relationship.
       */
      remove: async (params) => {},
    },
  },
  // define the default handler functions as needed; undefined handlers
  // will return a 403 forbidden for that operation.
});
```
