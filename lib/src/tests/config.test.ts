import { JsonapiFastifyOptions } from "../@types";
import { MEDIA_TYPE } from "../schemas/schema";
import { build, people } from "./fixtures";

describe('app config', () => {
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
    urlPrefixAlias: 'https://www.example.com',
    definitions: [people]
  };

  it('adds the url prefix alias', async () => {
    const app = build(options);
    const response = await app.inject({
      method: 'GET',
      url: '/people',
      headers: {
        'content-type': MEDIA_TYPE
      }
    });
    expect(response.statusCode).toBe(200);
    expect(response.body).toBeDefined();
    const body = JSON.parse(response.body);
    expect(body.links.self).toBe('https://www.example.com/people');
  });

});
