import { CONTENT_TYPE } from '../schemas/common';
import { build, expectDocument, resetHandlers, setupTestSuite } from './fixtures';
import { ArticleHandler } from './fixtures/articles';
import { CommentHandler } from './fixtures/comments';

describe('when updating', () => {
  setupTestSuite();

  const createComment = () => ({
    id: '42',
    type: 'comments',
    body: 'I like XML better...',
    author: {
      id: '24',
      type: 'people'
    },
    article: {
      id: '1',
      type: 'articles'
    }
  });

  const createArticle = () => ({
    id: '42',
    type: 'articles',
    title: 'JSON:API paints my bikeshed!',
    body: 'The shortest article. Ever.',
    created: '2015-05-22T14:56:29.000Z',
    updated: '2015-05-22T14:56:28.000Z',
    author: {
      id: '42',
      type: 'people'
    },
    tags: [
      { id: 'jsonapi', type: 'tags' },
      { id: 'apis', type: 'tags' }
    ]
  });

  const testConfig = {
    accept: false,
    noContent: false
  };

  const updateComments = CommentHandler.update;
  const updateArticles = ArticleHandler.update;

  beforeEach(() => {
    CommentHandler.config().update = async (params) => {
      const _comment = createComment();
      if (params.request.params.id !== _comment.id) {
        return params.response.notFound();
      }
      if (params.operation === 'relationship:update') {
        _comment[params.request.params.relation] = params.data;
        return params.response.ok(_comment);
      }
      if (params.operation === 'update') {
        Object.assign(_comment, params.data);
        if (testConfig.accept) {
          return params.response.accepted({ success: true });
        }
        if (testConfig.noContent) {
          return params.response.ok();
        }
        return params.response.ok(_comment);
      }
      throw new Error('Invalid request');
    };

    ArticleHandler.config().update = async (params) => {
      const _article = createArticle();
      if (params.request.params.id !== _article.id) {
        return params.response.notFound();
      }
      if (params.operation === 'relationship:update') {
        _article[params.request.params.relation] = params.data;
        return params.response.ok(_article);
      }
      throw new Error('Invalid request');
    };
  });

  afterEach(() => {
    testConfig.accept = false;
    testConfig.noContent = false;
    CommentHandler.update = updateComments;
    ArticleHandler.update = updateArticles;
    resetHandlers();
  });

  it('updates the resource attributes', async () => {
    const comment = createComment();
    const bodyBeforeEdit = comment.body;
    const app = build();
    const url = `/comments/${comment.id}`;
    const response = await app.inject({
      method: 'PATCH',
      url,
      headers: {
        'content-type': CONTENT_TYPE,
        accept: CONTENT_TYPE
      },
      payload: {
        data: {
          type: 'comments',
          attributes: {
            body: 'I changed the body!'
          }
        }
      }
    });
    expect(response.statusCode).toBe(200);
    expect(response.body).toBeDefined();
    const document = JSON.parse(response.body);
    expectDocument(document).toBeJsonapiVersion('1.0').toBeSingleResource();
    expect(document.data.id).toBe(comment.id);
    expect(document.data.type).toBe(comment.type);
    expect(document.data.attributes.body).toBeDefined();
    expect(document.data.attributes.body).not.toBe(bodyBeforeEdit);
  });

  it('updates the resource relationships', async () => {
    const comment = createComment();
    const app = build();
    const url = `/comments/${comment.id}`;
    const response = await app.inject({
      method: 'PATCH',
      url,
      headers: {
        'content-type': CONTENT_TYPE,
        accept: CONTENT_TYPE
      },
      payload: {
        data: {
          type: 'comments',
          relationships: {
            author: {
              data: {
                id: '12345',
                type: 'people'
              }
            }
          }
        }
      }
    });
    expect(response.statusCode).toBe(200);
    expect(response.body).toBeDefined();
    const document = JSON.parse(response.body);
    expectDocument(document).toBeJsonapiVersion('1.0').toBeSingleResource();
    expect(document.data.id).toBe(comment.id);
    expect(document.data.type).toBe(comment.type);
    expect(document.data.attributes).toBeDefined();
    expect(document.data.attributes.body).toBe(comment.body);
    expect(document.data.relationships).toBeDefined();
    expect(document.data.relationships.author.data).toStrictEqual({
      id: '12345',
      type: 'people'
    });
    expect(document.data.relationships.article).toBeDefined();
    expect(document.data.relationships.article.data).toStrictEqual({
      id: comment.article.id,
      type: comment.article.type
    });
  });

  it('accepts requests for further processing', async () => {
    testConfig.accept = true;
    const comment = createComment();
    const app = build();
    const url = `/comments/${comment.id}`;
    const response = await app.inject({
      method: 'PATCH',
      url,
      headers: {
        'content-type': CONTENT_TYPE,
        accept: CONTENT_TYPE
      },
      payload: {
        data: {
          type: 'comments',
          relationships: {
            author: {
              data: {
                id: '12345',
                type: 'people'
              }
            }
          }
        }
      }
    });
    expect(response.statusCode).toBe(202);
    expect(response.body).toBeDefined();
    const document = JSON.parse(response.body);
    expectDocument(document).toHaveMeta({ success: true });
  });

  it('returns no content', async () => {
    testConfig.noContent = true;
    const comment = createComment();
    const app = build();
    const url = `/comments/${comment.id}`;
    const response = await app.inject({
      method: 'PATCH',
      url,
      headers: {
        'content-type': CONTENT_TYPE,
        accept: CONTENT_TYPE
      },
      payload: {
        data: {
          type: 'comments',
          relationships: {
            author: {
              data: {
                id: '12345',
                type: 'people'
              }
            }
          }
        }
      }
    });
    expect(response.statusCode).toBe(204);
    expect(response.body).toBe('');
  });

  it('rejects forbidden requests', async () => {
    // if a resource request handler is undefined, it is assumed that the associated
    // operation is forbidden on that resource.
    CommentHandler.update = undefined;
    const comment = createComment();
    const app = build();
    const url = `/comments/${comment.id}`;
    const response = await app.inject({
      method: 'PATCH',
      url,
      headers: {
        'content-type': CONTENT_TYPE,
        accept: CONTENT_TYPE
      },
      payload: {
        data: {
          type: 'comments',
          relationships: {
            author: {
              data: {
                id: '12345',
                type: 'people'
              }
            }
          }
        }
      }
    });

    expect(response).toBeDefined();
    expect(response.statusCode).toBe(403);
  });

  it('rejects resources that do not exist', async () => {
    const app = build();
    const url = `/comments/non-existing-id`;
    const response = await app.inject({
      method: 'PATCH',
      url,
      headers: {
        'content-type': CONTENT_TYPE,
        accept: CONTENT_TYPE
      },
      payload: {
        data: {
          type: 'comments',
          relationships: {
            author: {
              data: {
                id: '12345',
                type: 'people'
              }
            }
          }
        }
      }
    });
    expect(response).toBeDefined();
    expect(response.statusCode).toBe(404);
  });

  it('rejects on resource conflicts with invalid types', async () => {
    const app = build();
    const comment = createComment();
    const url = `/comments/${comment.id}`;
    const response = await app.inject({
      method: 'PATCH',
      url,
      headers: {
        'content-type': CONTENT_TYPE,
        accept: CONTENT_TYPE
      },
      payload: {
        data: {
          type: 'articles',
          attributes: { body: 'a new article' },
          relationships: {
            author: {
              data: {
                id: '12345',
                type: 'people'
              }
            }
          }
        }
      }
    });
    expect(response).toBeDefined();
    expect(response.statusCode).toBe(409);
  });

  describe('relationships', () => {
    it('returns no content', async () => {
      //
    });

    it('rejects forbidden requests', async () => {
      //
    });

    it('rejects resources that do not exist', async () => {
      //
    });

    it('rejects conflicts on resources with invalid types', async () => {
      //
    });

    it('accepts the request for further processing', async () => {
      //
    });
  });

  describe('to-one relationships', () => {
    it('sets the relationship', async () => {
      const comment = createComment();
      const app = build();
      const url = `/comments/${comment.id}/relationships/author`;
      const response = await app.inject({
        method: 'PATCH',
        url,
        headers: {
          'content-type': CONTENT_TYPE,
          accept: CONTENT_TYPE
        },
        payload: {
          data: {
            id: '12345',
            type: 'people'
          }
        }
      });
      expect(response.statusCode).toBe(200);
      expect(response.body).toBeDefined();
      const document = JSON.parse(response.body);
      expectDocument(document).toBeJsonapiVersion('1.0').toBeSingleResource();
      expect(document.data.id).toBe('12345');
      expect(document.data.type).toBe('people');
    });

    it('clears the relationship', async () => {
      const comment = createComment();
      const app = build();
      const url = `/comments/${comment.id}/relationships/author`;
      const response = await app.inject({
        method: 'PATCH',
        url,
        headers: {
          'content-type': CONTENT_TYPE,
          accept: CONTENT_TYPE
        },
        payload: {
          data: null
        }
      });
      expect(response.statusCode).toBe(200);
      expect(response.body).toBeDefined();
      const document = JSON.parse(response.body);
      expectDocument(document).toBeJsonapiVersion('1.0').toBeSingleResource();
      expect(document.data).toBeNull();
    });
  });

  describe('to-many relationships', () => {
    it('sets the relationship', async () => {
      const article = createArticle();
      const app = build();
      const url = `/articles/${article.id}/relationships/tags`;
      const response = await app.inject({
        method: 'PATCH',
        url,
        headers: {
          'content-type': CONTENT_TYPE,
          accept: CONTENT_TYPE
        },
        payload: {
          data: [
            {
              id: 'hearts',
              type: 'tags'
            },
            {
              id: 'stars',
              type: 'tags'
            },
            {
              id: 'horseshoes',
              type: 'tags'
            }
          ]
        }
      });
      expect(response.statusCode).toBe(200);
      expect(response.body).toBeDefined();
      const document = JSON.parse(response.body);
      expectDocument(document).toBeJsonapiVersion('1.0').toBeMultiResource().withCount(3);
    });

    it('clears the relationship', async () => {
      const article = createArticle();
      const app = build();
      const url = `/articles/${article.id}/relationships/tags`;
      const response = await app.inject({
        method: 'PATCH',
        url,
        headers: {
          'content-type': CONTENT_TYPE,
          accept: CONTENT_TYPE
        },
        payload: {
          data: []
        }
      });
      expect(response.statusCode).toBe(200);
      expect(response.body).toBeDefined();
      const document = JSON.parse(response.body);
      expectDocument(document).toBeJsonapiVersion('1.0').toBeMultiResource().withCount(0);
    });
  });
});
