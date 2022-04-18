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
    copyright: "Copyright 2022 ExampleCom",
  },
  /* (optional): Sets the minimum log level. Default is 'info'. */
  loggerLevel: "info",

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

// Registers all routes and handlers based on the above configuration.
// This must be called before your application serves any requests!
server.init();
```

### Starting jsonapi-fastify

Like any [fastify](https://www.fastify.io/) application, you can start an instance by calling the `listen` function:

```javascript
server.listen(3000);

// or add an optional callback
server.listen(3000, (err, address) => {
  if (err) {
    console.error(err);
  } else {
    console.log(`Ready at address ${address}!`);
  }
});
```

If your server is running inside a serverless environment (such as AWS Lambda), check out
the [aws-lambda-fastify](https://github.com/fastify/aws-lambda-fastify) package:

```javascript
module.exports = { main: awsLambdaFastify(server) };
```

### Stopping jsonapi-fastify

```javascript
server.close();
```

### Advanced Configurations

The jsonapi-fastify instance is a [fastify](https://www.fastify.io/) application, and as such can be modified and extended
using fastify instance APIs. While it is not recommend to make modifications that can potentially
the application's ability to adhere to the json:api specification,
said interfaces are not abstracted from the user.

For example, if you want to register any fastify plugins before the internal routes are defined,
do so before the `server.init()` call:

```javascript
const server = jsonapiFastify({ ... });

// register cors plugin
server.register(require('fastify-cors'), {
  // cors options...
});

// register internal plugin
server.init();

// register additional plugins, routes, etc.
server.register(...);

// start listening
server.listen(3000);
```

See the [documentation here](https://www.fastify.io/docs/latest/Guides/Plugins-Guide/) for more info on fastify plugins.
