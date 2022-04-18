import { MEDIA_TYPE } from '../schemas/schema';
import { articles, build, comments, setupTestSuite } from './fixtures';
import { CommentHandler } from './fixtures/comments';

describe('when deleting', () => {
  setupTestSuite();

  const commentsStore = comments.examples;
  const articlesStore = articles.examples;

  beforeEach(() => {
    comments.examples = [...commentsStore];
    articles.examples = [...articlesStore];
  });

  it('returns no content upon successful deletion', async () => {
    expect(comments.examples.length).toBe(2);
    const example = comments.examples[0];
    const url = `/comments/${example.id}`;
    CommentHandler.config().delete = async (args) => {
      const id = args.request.params.id;
      expect(id).toBe(example.id);
      return CommentHandler.base().delete!(args);
    };
    const app = build();
    const response = await app.inject({
      method: 'DELETE',
      url,
      headers: {
        'content-type': MEDIA_TYPE
      }
    });
    expect(response.statusCode).toBe(204);
    expect(comments.examples.length).toBe(1);
  });

  it('returns ok upon successful deletion', async () => {
    expect(comments.examples.length).toBe(2);
    const example = comments.examples[0];
    const url = `/comments/${example.id}`;
    CommentHandler.config().delete = async (args) => {
      const id = args.request.params.id;
      expect(id).toBe(example.id);
      return args.response.ok({ success: true });
    };
    const app = build();
    const response = await app.inject({
      method: 'DELETE',
      url,
      headers: {
        'content-type': MEDIA_TYPE
      }
    });
    expect(response.statusCode).toBe(200);
    expect(response.body).toBeDefined();
    const body = JSON.parse(response.body);
    expect(body.meta).toBeDefined();
    expect(body.meta.success).toBe(true);
  });

  it('accepts the request for further processing', async () => {
    expect(comments.examples.length).toBe(2);
    const example = comments.examples[0];
    const url = `/comments/${example.id}`;
    CommentHandler.config().delete = async (args) => {
      const id = args.request.params.id;
      expect(id).toBe(example.id);
      return args.response.accepted({ success: true });
    };
    const app = build();
    const response = await app.inject({
      method: 'DELETE',
      url,
      headers: {
        'content-type': MEDIA_TYPE
      }
    });
    expect(response.statusCode).toBe(202);
    expect(response.body).toBeDefined();
    const body = JSON.parse(response.body);
    expect(body.meta).toBeDefined();
    expect(body.meta.success).toBe(true);
  });

  it('handles forbidden requests', async () => {
    expect(comments.examples.length).toBe(2);
    const example = comments.examples[0];
    const url = `/comments/${example.id}`;
    const deleteFunc = CommentHandler.delete;
    CommentHandler.delete = undefined;
    const app = build();
    const response = await app
      .inject({
        method: 'DELETE',
        url,
        headers: {
          'content-type': MEDIA_TYPE
        }
      })
      .then((res) => {
        CommentHandler.delete = deleteFunc;
        return res;
      })
      .catch((err) => {
        CommentHandler.delete = deleteFunc;
        throw err;
      });
    expect(response.statusCode).toBe(403);
    expect(response.body).toBeDefined();
  });

  it('handles resources that do not exist', async () => {
    const app = build();
    const response = await app.inject({
      method: 'DELETE',
      url: '/comments/apples-and-pears',
      headers: {
        'content-type': MEDIA_TYPE
      }
    });

    expect(response.statusCode).toBe(404);
    expect(response.body).toBeDefined();

    const response2 = await app.inject({
      method: 'DELETE',
      url: '/komquats/apples-and-pears',
      headers: {
        'content-type': MEDIA_TYPE
      }
    });

    expect(response2.statusCode).toBe(404);
    expect(response2.body).toBeDefined();
  });

  describe('from to-many relationships', () => {
    it('removes a resource ref from the relationship list', async () => {
      const article = articles.examples[0];
      const url = `/articles/${article.id}/relationships/tags`;
      const app = build();
      const response = await app.inject({
        method: 'DELETE',
        url,
        headers: {
          'content-type': MEDIA_TYPE
        },
        payload: {
          data: [{ id: 'jsonapi', type: 'tags' }]
        }
      });
      expect(response.statusCode).toBe(200);
      expect(response.body).toBeDefined();
    });
  });
});
