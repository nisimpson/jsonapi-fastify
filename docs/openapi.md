### Dynamic OpenAPI Documentation

To opt-in to having a `openapi.json` built for you off the back of your resource schema, simply provide a `openapi` property to the server options and fill out some of the fields:

```javascript
const server = jsonapiFastify({
  // ...
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
  // ...
});
```

When this is done, fire up your api and take a look at your swagger file, found at: `/openapi.json`:

```bash
$ curl http://localhost:3000/openapi.json

# Note: The actual response is unformatted.
{
  "openapi": "3.0.0",
  "info": {
    "title": "test server",
    "version": "1.0.0",
    "description": "a jsonapi server",
    "contact": {
      "url": "https://jsonapi.org",
      "email": "support@jsonapi.org"
    },
    "license": {
      "name": "MIT",
      "url": "https://jsonapi.org/license"
    }
  },
  "paths": { ... },
  "components": { ... },
  "tags": [ ... ],
  "servers": [ ... ]
}
```
