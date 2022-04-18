# jsonapi-fastify

## About

Inspired by projects such as [jagql-framework](https://github.com/jagql/framework) and [jsonapi-server](https://github.com/holidayextras/jsonapi-server), **jsonapi-fastify** allows developers to stand up a [`{json:api}`](https://jsonapi.org) compliant API server quickly and easily. As the name implies, **jsonapi-fastify** uses [fastify](https://www.fastify.io/) to handle request routing and configuration.

## Motivation / Justification / Rationale

This framework solves the challenges of json:api without coupling us to any one ORM solution. Every other module out there is either tightly coupled to a database implementation, tracking an old version of the json:api spec, or is merely a helper library for a small feature. If you're building an API and your use case only involves reading and writing to a data store... well count yourself lucky. For everyone else, this framework provides the flexibility to provide a complex API without being confined to any one technology.

A config driven approach to building an API enables:

- Enforced json:api responses
- Automatic GraphQL schema generation
- Request validation
- Payload validation
- Automatic documentation generation
- Automatic inclusions
- Automatic routing
- Automatic handling of relationships

Ultimately, the only things users of this framework need to care about are:

- What are your resources called
- What properties yours resources have
- For each resource, implement a `handler` to:
  - `create` a resource
  - `delete` a resource
  - `search` for multiple resources
  - `find` a specific resource
  - `update` a specific resource

### Handlers

- [memory-handler](#) - an in-memory data store to enable rapid prototyping.
  This ships as a part of `jsonapi-fastify` and powers the core test suite.
- [resource-handler](#) - a database agnostic handler that allows users to fully customize handler behavior.
  Useful for resources that do not stem from stores with CRUD interfaces or are composed from multiple sources.

## Full documentation

- [Suggested Project Structure](docs/guides/suggested-project-structure.md)
- [Configuring jsonapi-fastify](docs/guides/configuration.md)
- [Automatic OpenAPI Generation](docs/guides/openapi.md)
- [Defining Resources](docs/guides/resources.md)
- [Foreign Key Relations](docs/guides/foreign-relations.md)
- [Resource Handlers](docs/guides/handlers.md)

## Quick Start: Server

```javascript
const { jsonapiFastify, define, MemoryHandler } = require("jsonapi-fastify");
const { nanoid } = require("nanoid");

const server = jsonapiFastify({
  openapi: {
    info: {
      version: "1.0.0",
      title: "test server",
      description: "a jsonapi server",
      contact: {
        url: "https://jsonapi.org",
        email: "support@jsonapi.org",
      },
      license: {
        name: "MIT",
        url: "https://jsonapi.org/license",
      },
    },
  },
  definitions: [
    define((schema) => ({
      resource: "people",
      idGenerator: () => nanoid(),
      handlers: MemoryHandler(),
      fields: {
        firstname: schema.attribute(),
        lastname: schema.attribute(),
        articles: schema.belongsToOne({
          resource: "articles",
          as: "author",
        }),
      },
      examples: [
        {
          id: "42",
          type: "people",
          firstname: "John",
          lastname: "Doe",
        },
        {
          id: "24",
          type: "people",
          firstname: "Jane",
          lastname: "Doe",
        },
        {
          id: "22",
          type: "people",
          firstname: "Billy",
          lastname: "Idol",
        },
      ],
      defaultPageSize: 100,
    })),
  ],
});

server.listen(3000, (err, address) => {
  if (err) {
    console.error(err);
  } else {
    console.log(`Ready at address ${address}!`);
  }
});
```

## Quick Start: Serverless (AWS Lambda)

```yaml
# serverless.yml
provider:
  name: aws
  stage: dev
functions:
  handler: src/handler.main
  environment:
    STAGE: ${self:provider.stage}
  events:
    - http:
        method: any
        path: api/{proxy+}
```

```javascript
// src/handler.js

import awsLambdaFastify from "aws-lambda-fastify";
import { jsonapiFastify, define, MemoryHandler } from "jsonapi-fastify";
import { nanoid } from "nanoid";

const app = jsonapiFastify({
  urlPrefixAlias: `https://api.example.com/${process.env.STAGE}`,
  prefix: "/api",
  openapi: {
    info: {
      version: "1.0.0",
      title: "test server",
      description: "a jsonapi server",
      contact: {
        url: "https://jsonapi.org",
        email: "support@jsonapi.org",
      },
      license: {
        name: "MIT",
        url: "https://jsonapi.org/license",
      },
    },
  },
  definitions: [
    define((schema) => ({
      resource: "people",
      idGenerator: () => nanoid(),
      handlers: MemoryHandler(),
      fields: {
        firstname: schema.attribute({
          description: "The person's first name",
          validator: (z) => z.string(),
        }),
        lastname: schema.attribute({
          description: "The person's last name",
          validator: (z) => z.string(),
        }),
        articles: schema.belongsToOne({
          resource: "articles",
          as: "author",
        }),
      },
      examples: [
        {
          id: "42",
          type: "people",
          firstname: "John",
          lastname: "Doe",
        },
      ],
      defaultPageSize: 100,
    })),
  ],
});

export const main = awsLambdaFastify(app);
```
