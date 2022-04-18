import { middyfy } from '@libs/lambda';
import awsLambdaFastify from 'aws-lambda-fastify';
import { server, define, MemoryHandler } from 'jsonapi-fastify';
import { nanoid } from 'nanoid';

const app = server({
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
  definitions: [
    define((field) => ({
      resource: 'people',
      idGenerator: () => nanoid(),
      handlers: MemoryHandler(),
      fields: {
        firstname: field((z) => z.string()),
        lastname: field((z) => z.string()),
        articles: field.belongsToOne({
          resource: 'articles',
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

const api = awsLambdaFastify(app);
export const main = middyfy(api);
