## Defining a json:api resource

```javascript
const { define } = require("jsonapi-fastify");

const resource = define((schema) => ({
  resource: "fruits",
  handler: {
    /* see "Handlers" section */
  },
  searchParams: {
    /* see "SearchParams" section */
  },
  attributes: {
    /* see "attributes" section */
  },
}));
```

### Handlers

jsonapi-fastify ships with an example barebones implementation of an in-memory handler.

```javascript
const { MemoryHandler } = require("jsonapi-fastify");
```

You can use it as a reference for writing new handlers. Documentation for creating your own handlers can be found [here](handlers.md).

`MemoryHandler` works by allowing each defined resource to contain an `examples` property, which must be an array of JSON objects representing raw resources. Those examples are loaded into memory when the server loads and are served up as if they were real resources. You can search through them, modify them, create new ones, delete them, straight away.

Its a beautiful way of prototyping an experimental new API! Simply define the attributes of a resource, attach the `MemoryHandler` and define some `examples`:

```javascript
define((schema) => ({
  resource: "photos",
  description: "The photos resource api",
  idGenerator: () => uuid(),
  handler: MemoryHandler(),
  attributes: {
    title: schema.attribute(),
    url: schema.attribute({
      validator: (zod) => zod.string().url(),
    }),
    category: schema.attribute({
      description: "The photo category",
    }),
    photographer: schema.toOne("people", {
      description: "The person who took the photo",
    }),
    articles: schema.belongsToMany("articles", {
      as: "photos",
    }),
  },
  examples: [
    {
      id: "aab14844-97e7-401c-98c8-0bd5ec922d93",
      type: "photos",
      title: "Matrix Code",
      category: "movies",
      url: "http://www.example.com/foobar",
      photographer: {
        type: "people",
        id: "ad3aa89e-9c5b-4ac9-a652-6670f9f27587",
      },
    },
  ],
}));
```

## Fields

`fields` defines the properties declared on the given resource. A resource's `fields` should be declared using the `schema` param provided to the `define` function:

```javascript
define((schema) => {
  return {
    fields: {
      url: schema.attribute({
        type: (zod) => zod.string().url(),
      }),
      height: schema.attribute({
        type: (zod) => zod.number().minimum(1).maximum(10000),
      }),
    },
  };
});
```

The `schema.attribute()` function takes an optional parameter with the following properties:

- `description` - The attribute description (optional)
- `type` - The attribute type callback (optional)
- `readonly` - If true, the attribute cannot be modified (optional)

As shown above, the attribute type can be defined and validated by providing a callback that takes in a [Zod](https://github.com/colinhacks/zod) instance and returns a Zod schema object.

In addition to the above, `schema` provides the following functions:

```javascript
{
  // a one-to-one relationship
  photos: schema.toOne("photos", {
    description: "This field is a relation to a photos resource"
  }),
  // indicates that the relationship is stored on the target resource
  article: schema.belongsToOne("articles", {
    as: "comments",
    description: "This field contains comments that links back to this resource"
  }),
  // a one-to-many relationship
  photos: schema.toMany("photos", {
    description: "This field is a relation to many photos resources"
  }),
  // indicates that the relationship is stored on the target resource
  article: schema.belongsToMany("articles", {
    description: "This field contains comments that links back to many of this resource"
    as: "comments",
  })
}
```

Attributes can be marked as `optional` via Zod. Required fields are enforced in both directions - user created/updated resources must comply with the required attributes, as must all resources provided by the server.

While attributes are required by default, relationships must be explicitly marked as required.

```javascript
url: schema.attribute({
  type: (zod) => zod.string().uri().optional();
})
```

Attributes can be declared `readonly` by attaching metadata. Any attempt to write to this attribute when creating a new resource via POST, or when amending a resource via `PUT/PATCH/DELETE` will result in a validation error.

```javascript
url: schema.attribute({
  description: "The attribute cannot be created nor modified by a user",
  type: (zod) => zod.string().url(),
  readonly: true,
});
```

### ID Generation

The optional `idGenerator` property takes in a callback function that returns a string:

```javascript
{
  // use your favorite uuid generator here. undefined generators yield an empty string.
  idGenerator: () => nanoid(),
  // if true, supercedes generated id if provided by client
  allowsIdOnCreate: true,
  handler: {
    async create({ request, response, data }) {
      // generated id, or client provided id
      console.log(data.id); 
    }
  }
}
```

> A 403 response is generated when the client provides an id and `allowsIdOnCreate` is falsy.
