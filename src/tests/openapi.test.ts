import { JsonapiFastifyOptions } from '../@types';
import { build, people } from './fixtures';
import openapiJson from './fixtures/openapi.json';

describe('openapi document', () => {

  const options: JsonapiFastifyOptions = {
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
    definitions: [people]
  };

  it('returns the openapi document', async () => {
    const app = build(options);
    const response = await app.inject({
      url: '/openapi.json',
      method: 'GET',
      headers: {
        'accept': 'application/json'
      }
    });
    expect(response.statusCode).toBe(200);
    expect(response.body).toBeDefined();
    const body = JSON.parse(response.body);
    expect(body).toStrictEqual(openapiJson);
  });
})
