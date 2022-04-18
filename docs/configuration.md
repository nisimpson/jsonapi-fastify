## Configuration

```javascript
const { jsonapiFastify } = require("jsonapi-fastify");

const server = jsonapiFastify({
  /*
   * (optional): An alias of the absolute portion of URLs generated in the
   * response file. Does not end with a forward slash.
   */
  urlPrefixAlias: "https://www.example.com/api",
  /* (optional): Prefixes all routes with the specified text. Starts with a forward slash. */
  prefix: "/api",
  /* (optional): Top metadata to append to all responses */
  meta: {
    copyright: "Copyright 2022 ExampleCom"
  },
  /* (optional): Sets the minimum log level. Default is 'info'. */
  loggerLevel: 'info',

  /* (optional): Header for dynamic openapi documentation. */
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
});
```
