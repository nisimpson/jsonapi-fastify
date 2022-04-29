import { MEDIA_TYPE } from '@schemas/schema';
import {
  build,
  resetHandlers,
  tags,
  expectDocument,
  fromDefinition,
  expectResponse,
  articles,
  people,
  comments
} from './fixtures';
import { PersonHandler } from './fixtures/people';

describe('when fetching', () => {
  const originalSearch = PersonHandler.search;
  const originalFind = PersonHandler.find;

  beforeAll(() => {
    const app = build();
    app.ready(() => {
      console.log(app.printPlugins());
      console.log(app.printRoutes({ commonPrefix: false }));
    });
  });

  afterEach(() => {
    PersonHandler.search = originalSearch;
    PersonHandler.find = originalFind;
    resetHandlers();
  });

  describe('resources', () => {
    it('fetches an individual resource', async () => {
      const tag = tags.examples[0];
      const app = build();
      const url = `/tags/${tag.id}`;
      const response = await app.inject({
        method: 'GET',
        url,
        headers: {
          'content-type': MEDIA_TYPE
        }
      });
      expect(response.statusCode).toBe(200);
      expect(response.body).toBeDefined();

      const document = JSON.parse(response.body);

      // prettier-ignore
      expectDocument(document)
        .toBeJsonapiVersion('1.0')
        .toHaveSelfLink(url)
        .toBeSingleResource();

      // prettier-ignore
      fromDefinition(tags)
        .expectPrimaryData(document.data)
        .toMatchExample(tag);
    });

    it('fetches a resource collection', async () => {
      const app = build();
      const response = await app.inject({
        method: 'GET',
        url: '/tags',
        headers: {
          'content-type': MEDIA_TYPE
        }
      });
      expect(response.statusCode).toBe(200);
      expect(response.body).toBeDefined();

      const document = JSON.parse(response.body);
      expectDocument(document)
        .toBeJsonapiVersion('1.0')
        .toHaveSelfLink('/tags')
        .toBeMultiResource()
        .withCount(tags.examples.length);

      // prettier-ignore
      fromDefinition(tags)
        .expectPrimaryData(document.data[0])
        .toMatchExample(tags.examples[0]);
    });

    it('rejects resources that do not exist', async () => {
      const app = build();
      const response1 = await app.inject({
        method: 'GET',
        url: `/people/some-unknown-id`,
        headers: {
          'content-type': MEDIA_TYPE
        }
      });
      expectResponse(response1).to404();

      const response2 = await app.inject({
        method: 'GET',
        url: `/some-unknown-resource/some-unknown-id`,
        headers: {
          'content-type': MEDIA_TYPE
        }
      });
      expectResponse(response2).to404();
    });

    it('rejects invalid queries', async () => {
      const app = build();
      const response = await app.inject({
        method: 'GET',
        url: `/tags?id=1234`,
        headers: {
          'content-type': MEDIA_TYPE
        }
      });
      expect(response.statusCode).toBe(422);
      expect(response.body).toBeDefined();

      const document = JSON.parse(response.body);
      expectDocument(document).toContainErrors().withCode('EINVALID').withStatus('422');
    });

    it('fetches specific fields', async () => {
      const article = articles.examples[0];
      const app = build();
      const url = '/articles/1?fields[articles]=body,title';
      const response = await app.inject({
        method: 'GET',
        url,
        headers: {
          'content-type': MEDIA_TYPE
        }
      });
      expect(response.statusCode).toBe(200);
      expect(response.body).toBeDefined();

      const document = JSON.parse(response.body);
      expectDocument(document).toBeJsonapiVersion('1.0').toHaveSelfLink(url);
      expectDocument(document).toBeSingleResource();
      expect(document.data.attributes).toStrictEqual({
        body: article.body,
        title: article.title
      });
    });

    it('rejects fields that do not exist', async () => {
      const app = build();
      const url = '/articles/1?fields[articles]=foo';
      const response = await app.inject({
        method: 'GET',
        url,
        headers: {
          'content-type': MEDIA_TYPE
        }
      });
      expect(response.statusCode).toBe(422);
    });

    it('includes related resources', async () => {
      const article = articles.examples[0];
      const app = build();
      const url = '/articles/1?include=author';
      const response = await app.inject({
        method: 'GET',
        url,
        headers: {
          'content-type': MEDIA_TYPE
        }
      });
      expect(response.statusCode).toBe(200);
      expect(response.body).toBeDefined();

      const document = JSON.parse(response.body);
      expectDocument(document)
        .toBeJsonapiVersion('1.0')
        .toHaveSelfLink(url)
        .toHaveIncludes()
        .withCount(1);

      expectDocument(document).toBeSingleResource();
      fromDefinition(articles).expectPrimaryData(document.data).toMatchExample(article);
      fromDefinition(people)
        .expectPrimaryData(document.included[0])
        .toMatchExample(people.examples[0]);
    });

    it('includes resources related to other resources', async () => {
      const comment = comments.examples[0];
      const app = build();
      const url = '/comments/1?include=article.author';
      const response = await app.inject({
        method: 'GET',
        url,
        headers: {
          'content-type': MEDIA_TYPE
        }
      });
      expect(response.statusCode).toBe(200);
      expect(response.body).toBeDefined();

      const document = JSON.parse(response.body);
      expectDocument(document)
        .toBeJsonapiVersion('1.0')
        .toHaveSelfLink(url)
        .toHaveIncludes()
        .withCount(2);

      expectDocument(document).toBeSingleResource();

      // prettier-ignore
      fromDefinition(comments)
        .expectPrimaryData(document.data)
        .toMatchExample(comment);
    });

    it('includes multiple related resources', async () => {
      const article = articles.examples[0];
      const app = build();
      const url = '/articles/1?include=author,tags';
      const response = await app.inject({
        method: 'GET',
        url,
        headers: {
          'content-type': MEDIA_TYPE
        }
      });
      expect(response.statusCode).toBe(200);
      expect(response.body).toBeDefined();

      const document = JSON.parse(response.body);
      expectDocument(document)
        .toBeJsonapiVersion('1.0')
        .toHaveSelfLink(url)
        .toHaveIncludes()
        .withCount(3);

      expectDocument(document).toBeSingleResource();

      // prettier-ignore
      fromDefinition(articles)
          .expectPrimaryData(document.data)
          .toMatchExample(article);
    });
  });

  it('forbids unhandled search requests', async () => {
    PersonHandler.search = undefined;
    const app = build();
    const response = await app.inject({
      method: 'GET',
      url: '/people',
      headers: {
        'content-type': MEDIA_TYPE
      }
    });
    expect(response.statusCode).toBe(403);
    expect(response.body).toBeDefined();
    const body = JSON.parse(response.body);
    expect(body.errors[0]).toBeDefined();
  });

  it('forbids unhandled find requests', async () => {
    PersonHandler.find = undefined;
    const app = build();
    const response = await app.inject({
      method: 'GET',
      url: '/people/1234',
      headers: {
        'content-type': MEDIA_TYPE
      }
    });
    expect(response.statusCode).toBe(403);
    expect(response.body).toBeDefined();
    const body = JSON.parse(response.body);
    expect(body.errors[0]).toBeDefined();
  });

  describe('relationships', () => {
    it('fetches a to-one relationship', async () => {
      const app = build();
      const url = '/articles/1/relationships/author';
      const response = await app.inject({
        method: 'GET',
        url,
        headers: {
          'content-type': MEDIA_TYPE
        }
      });
      expect(response.statusCode).toBe(200);
      expect(response.body).toBeDefined();
    });

    it('fetches a to-many relationship', async () => {
      const app = build();
      const url = '/articles/1/relationships/tags';
      const response = await app.inject({
        method: 'GET',
        url,
        headers: {
          'content-type': MEDIA_TYPE
        }
      });
      expect(response.statusCode).toBe(200);
      expect(response.body).toBeDefined();
    });

    it('rejects non-existent relationships', async () => {
      const app = build();
      const url = '/articles/1/relationships/null';
      const response = await app.inject({
        method: 'GET',
        url,
        headers: {
          'content-type': MEDIA_TYPE
        }
      });
      expect(response.statusCode).toBe(404);
      expect(response.body).toBeDefined();
    });
  });

  describe.skip('sorted resources', () => {
    it('sorts by a specified field', async () => {
      const app = build();
      const url = '/people/?sort=firstname';
      const response = await app.inject({
        method: 'GET',
        url,
        headers: {
          'content-type': MEDIA_TYPE
        }
      });
      expect(response.statusCode).toBe(200);
      expect(response.body).toBeDefined();
    });

    it('sorts by multiple fields', async () => {
      const app = build();
      const url = '/people/?sort=lastname,firstname';
      const response = await app.inject({
        method: 'GET',
        url,
        headers: {
          'content-type': MEDIA_TYPE
        }
      });
      expect(response.statusCode).toBe(200);
      expect(response.body).toBeDefined();
    });

    it('sorts in descending order', async () => {
      const app = build();
      const url = '/people/?sort=-firstname';
      const response = await app.inject({
        method: 'GET',
        url,
        headers: {
          'content-type': MEDIA_TYPE
        }
      });
      expect(response.statusCode).toBe(200);
      expect(response.body).toBeDefined();
    });

    it('handles non-sortable resources', async () => {
      PersonHandler.config().allowSort = false;

      const app = build();
      const url = '/people/?sort=firstname';
      const response = await app.inject({
        method: 'GET',
        url,
        headers: {
          'content-type': MEDIA_TYPE
        }
      });
      expect(response.statusCode).toBe(422);
    });
  });

  describe('related resources', () => {
    it('returns the related resource as primary data (to-one)', async () => {
      const article = articles.examples[0];
      const app = build();
      const url = `/articles/${article.id}/author`;
      const response = await app.inject({
        method: 'GET',
        url,
        headers: {
          'content-type': MEDIA_TYPE
        }
      });
      expect(response.statusCode).toBe(200);
      expect(response.body).toBeDefined();
      const document = JSON.parse(response.body);
      expectDocument(document).toBeJsonapiVersion('1.0').toBeSingleResource();
    });

    it('returns the related resource as primary data (to-many)', async () => {
      const article = articles.examples[0];
      const app = build();
      const url = `/articles/${article.id}/tags`;
      const response = await app.inject({
        method: 'GET',
        url,
        headers: {
          'content-type': MEDIA_TYPE
        }
      });
      expect(response.statusCode).toBe(200);
      expect(response.body).toBeDefined();
      const document = JSON.parse(response.body);
      expectDocument(document).toBeJsonapiVersion('1.0').toBeMultiResource();
    });
  });

  describe('paginated resources', () => {
    it('contains pagination links', async () => {
      PersonHandler.config().search = async (params) => {
        const { limit, offset = 0 } = params.request.query.page || {};
        const items = [...people.examples];
        const result = items.slice(offset, limit);
        return params.response.ok(result, {
          next: offset + result.length
        });
      };
      const app = build();
      const url = '/people?page[limit]=1';
      const response = await app.inject({
        method: 'GET',
        url,
        headers: {
          'content-type': MEDIA_TYPE
        }
      });
      expect(response.statusCode).toBe(200);
      expect(response.body).toBeDefined();
      const document = JSON.parse(response.body);
      expectDocument(document).toBeJsonapiVersion('1.0').toBeMultiResource();
      expect(document.links).toBeDefined();
      expect(document.links.next).toBe('/people?page[offset]=1&page[limit]=1');
    });
  });

  describe.skip('filtered resources', () => {
    it('filters results by resource id', async () => {
      //
    });
    it('filters results by relationship id', () => {
      //
    });
  });
});
