const { jsonapiFastify, define, MemoryHandler } = require('jsonapi-fastify');
const { nanoid } = require('nanoid');

const server = jsonapiFastify({
  openapi: {
    info: {
      version: '1.0.0',
      title: 'test server',
      description: 'a jsonapi server',
      contact: {
        url: 'https://jsonapi.org',
        email: 'support@jsonapi.org'
      },
      license: {
        name: 'MIT',
        url: 'https://jsonapi.org/license',
      }
    }
  },
  meta: {
    info: "Thanks for giving jsonapi-fastify a try!"
  },
  definitions: [
    define((schema) => ({
      resource: 'people',
      idGenerator: () => nanoid(),
      handler: MemoryHandler(),
      fields: {
        firstname: schema.attribute({ type: (z) => z.string() }),
        lastname: schema.attribute({ type: (z) => z.string() }),
        articles: schema.belongsToOne('articles', {
          as: 'author'
        })
      },
      examples: [
        {
          id: '42',
          type: 'people',
          firstname: 'John',
          lastname: 'Doe'
        },
        {
          id: '24',
          type: 'people',
          firstname: 'Jane',
          lastname: 'Doe'
        },
        {
          id: '22',
          type: 'people',
          firstname: 'Billy',
          lastname: 'Idol'
        }
      ],
      defaultPageSize: 100
    }))
  ]
});

server.init();
server.listen(3000, (err, address) => {
  if (err) {
    console.error(err);
  } else {
    console.log(`Ready at address ${address}!`);
  }
});
