## Suggested Project Structure

- `server.js` is the main entry point.
- Think of the `resources` folder as your `routes`.
- Think of the `handlers` folder as your `controllers`.

```
├── handlers
│   ├── articleHandler.js
│   ├── commentHandler.js
│   ├── peopleHandler.js
│   ├── photoHandler.js
│   └── tagHandler.js
├── resources
│   ├── articles.js
│   ├── comments.js
│   ├── people.js
│   ├── photos.js
│   └── tags.js
└── server.js
```

## Example Server

```javascript
const { jsonapiFastify } = require("jsonapi-fastify");
const articles = require("./resources/articles");
const comments = require("./resources/comments");
const people = require("./resources/people");
const tags = require("./resources/tags");

const server = jsonapiFastify({
  definitions: [articles, comments, people, tags],
  // additional server configuration...
});

server.listen(3000, (err, address) => {
  if (err) {
    console.error(err);
  } else {
    console.log(`Ready at address ${address}!`);
  }
});
```

## Example Resource

```javascript
// resources/people.js

const { define } = require("jsonapi-fastify");
const personHandler = require("../handlers/personHandler");

const people = define((schema) => ({
  description: "A person (alive, dead, undead, or fictional).",
  handler: personHandler,
  fields: {
    firstname: schema.attribute({
      description: "A person's first, or given name.",
    }),
    lastname: schema.attribute({
      description: "A person's last, or family name.",
    }),
    age: schema.attribute({
      description: "A person's age, in years.",
      type: (zod) => zod.number().nonnegative(),
    }),
    children: schema.belongsToOne('people', {
      description: "A person's children.",
      as: "guardian"
    });
    guardian: schema.toOne('people', {
      description: "A person's legal guardian."
    });
  },
}));

module.exports = people;
```

### Example Handler

```javascript
// handlers/personHandler.js

const { ResourceHandler } = require("jsonapi-fastify");
const model = require("../models/personModel");

const personHandler = ResourceHandler({
  async create({ request, response, data }) {
    const result = await model.createPerson({
      id: data.id,
      firstname: data.firstname,
      lastname: data.lastname,
      age: data.age
    });
    await Promise.all(data.children.map((child) => {
      return model.updatePerson(child.id, {
        guardian: result.id
      });
    }));
    return response.ok(result);
  },
  // other handlers
});

module.exports = personHandler;
```
