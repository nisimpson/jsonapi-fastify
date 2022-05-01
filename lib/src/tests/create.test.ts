import { MEDIA_TYPE } from '@schemas/schema';
import { build, resetHandlers, expectDocument, fromDefinition, tags, people } from './fixtures';
import { PersonHandler } from './fixtures/people';
import { TagHandler } from './fixtures/tags';

describe('when creating resources', () => {
  beforeAll(() => {
    const app = build();
    app.ready(() => {
      console.log(app.printPlugins());
      console.log(app.printRoutes({ commonPrefix: false }));
    });
  });

  beforeEach(() => {
    resetHandlers();
  });

  describe('with client generated resource ids', () => {
    it('returns the created resource', async () => {
      PersonHandler.config().create = async (args) => {
        return args.response.ok({
          ...args.data,
          type: 'tags'
        });
      };

      const app = build();
      const url = '/tags';
      const response = await app.inject({
        method: 'POST',
        url,
        headers: {
          'content-type': MEDIA_TYPE,
          accept: MEDIA_TYPE
        },
        payload: {
          data: {
            id: 'politics',
            type: 'tags',
            attributes: {
              value: '#politics'
            }
          }
        }
      });
      expect(response.statusCode).toBe(201);
      expect(response.body).toBeDefined();
      const document = JSON.parse(response.body);
      expectDocument(document)
        .toBeJsonapiVersion('1.0')
        .toHaveSelfLink('/tags')
        .toBeSingleResource();

      fromDefinition(tags).expectPrimaryData(document.data).toMatchExample({
        id: 'politics',
        type: 'tags',
        value: '#politics'
      });
      expect(response.headers['location']).toBeDefined();
    });

    it('returns no content', async () => {
      TagHandler.config().create = async (args) => {
        return args.response.ok();
      };

      const app = build();
      const url = '/tags';
      const response = await app.inject({
        method: 'POST',
        url,
        headers: {
          'content-type': MEDIA_TYPE,
          accept: MEDIA_TYPE
        },
        payload: {
          data: {
            id: 'music',
            type: 'tags',
            attributes: {
              value: '#music'
            }
          }
        }
      });
      expect(response.statusCode).toBe(204);
      expect(response.body).toBe('');
      expect(response.headers['location']).not.toBeDefined();
    });

    it('handles conflicts with existing resources', async () => {
      const tag = tags.examples[0];
      const app = build();
      const url = '/tags';
      const response = await app.inject({
        method: 'POST',
        url,
        headers: {
          'content-type': MEDIA_TYPE,
          accept: MEDIA_TYPE
        },
        payload: {
          data: {
            id: tag.id,
            type: 'tags',
            attributes: {
              value: '#value'
            }
          }
        }
      });
      expect(response.statusCode).toBe(409);
    });
  });

  it('rejects when the accept header is invalid', async () => {
    const app = build();
    const url = '/people';
    const response = await app.inject({
      method: 'POST',
      url,
      headers: {
        'content-type': MEDIA_TYPE,
        accept: 'application/json'
      },
      payload: {
        data: {
          type: 'people',
          attributes: {
            firstname: 'Jonah',
            lastname: 'Jameson'
          }
        }
      }
    });
    expect(response.statusCode).toBe(422);
    expect(response.body).toBeDefined();
    const body = JSON.parse(response.body);
    expect(body.errors[0].code).toBe('EINVALID');
    expect(body.errors[0].status).toBe('422');
    expect(body.errors[0].source.pointer).toBe('/accept');
  });

  it('returns the created resource', async () => {
    PersonHandler.config().create = async (args) => {
      return args.response.ok({
        ...args.data,
        type: 'people'
      });
    };

    const app = build();
    const url = '/people';
    const response = await app.inject({
      method: 'POST',
      url,
      headers: {
        'content-type': MEDIA_TYPE,
        accept: MEDIA_TYPE
      },
      payload: {
        data: {
          type: 'people',
          attributes: {
            firstname: 'Jonah',
            lastname: 'Jameson'
          }
        }
      }
    });
    expect(response.statusCode).toBe(201);
    expect(response.body).toBeDefined();
    const document = JSON.parse(response.body);
    expectDocument(document)
      .toBeJsonapiVersion('1.0')
      .toHaveSelfLink('/people')
      .toBeSingleResource();

    fromDefinition(people).expectPrimaryData(document.data).toMatchExample({
      id: document.data.id,
      type: 'people',
      firstname: 'Jonah',
      lastname: 'Jameson'
    });
    expect(response.headers['location']).toBeDefined();
    expect(response.headers['location']).toBe(`${url}/${document.data.id}`);
  });

  it('accepts the request for further processing', async () => {
    PersonHandler.config().create = async (args) => {
      return args.response.accepted({
        type: 'people',
        id: args.data.id
      });
    };

    const app = build();
    const url = '/people';
    const response = await app.inject({
      method: 'POST',
      url,
      headers: {
        'content-type': MEDIA_TYPE,
        accept: MEDIA_TYPE
      },
      payload: {
        data: {
          type: 'people',
          attributes: {
            firstname: 'Jonah',
            lastname: 'Jameson'
          }
        }
      }
    });
    expect(response.statusCode).toBe(202);
    expect(response.body).toBeDefined();
    const document = JSON.parse(response.body);
    expectDocument(document)
      .toBeJsonapiVersion('1.0')
      .toHaveMeta({
        type: 'people',
        id: expect.any(String)
      });
  });

  it('rejects forbidden requests', async () => {
    const create = PersonHandler.create;
    // if a resource request handler is undefined, it is assumed that the associated
    // operation is forbidden on that resource.
    PersonHandler.create = undefined;
    const app = build();
    const url = '/people';
    const response = await app
      .inject({
        method: 'POST',
        url,
        headers: {
          'content-type': MEDIA_TYPE,
          accept: MEDIA_TYPE
        },
        payload: {
          data: {
            type: 'people',
            attributes: {
              firstname: 'Jonah',
              lastname: 'Jameson'
            }
          }
        }
      })
      .then((res) => {
        PersonHandler.create = create;
        return res;
      })
      .catch(() => {
        PersonHandler.create = create;
        return undefined;
      });

    expect(response).toBeDefined();
    expect(response?.statusCode).toBe(403);
  });

  it('rejects resources that do not exist', async () => {
    const app = build();
    const url = '/apples';
    const response = await app.inject({
      method: 'POST',
      url,
      headers: {
        'content-type': MEDIA_TYPE,
        accept: MEDIA_TYPE
      },
      payload: {
        data: {
          type: 'apples',
          attributes: {}
        }
      }
    });
    expect(response.statusCode).toBe(404);
  });

  it('rejects conflicts on resources with invalid types', async () => {
    const app = build();
    const url = '/people';
    const response = await app.inject({
      method: 'POST',
      url,
      headers: {
        'content-type': MEDIA_TYPE,
        accept: MEDIA_TYPE
      },
      payload: {
        data: {
          type: 'bananas',
          attributes: {
            firstname: 'Jonah',
            lastname: 'Jameson'
          }
        }
      }
    });
    expect(response.statusCode).toBe(409);
    expect(response.body).toBeDefined();
  });

  it('rejects missing attributes', async () => {
    const app = build();
    const url = '/people';
    const response = await app.inject({
      method: 'POST',
      url,
      headers: {
        'content-type': MEDIA_TYPE,
        accept: MEDIA_TYPE
      },
      payload: {
        data: {
          type: 'people',
          attributes: {
            firstname: 'Jonah'
          }
        }
      }
    });
    expect(response.statusCode).toBe(422);
    const body = JSON.parse(response.body);
    expect(body.errors[0].source.pointer).toBe('/data/attributes/lastname');
  });

  it('rejects unknown attributes', async () => {
    const app = build();
    const url = '/people';
    const response = await app.inject({
      method: 'POST',
      url,
      headers: {
        'content-type': MEDIA_TYPE,
        accept: MEDIA_TYPE
      },
      payload: {
        data: {
          type: 'people',
          attributes: {
            firstname: 'Jonah',
            lastname: 'Jameson',
            someAttribute: 42
          }
        }
      }
    });
    expect(response.statusCode).toBe(422);
    const body = JSON.parse(response.body);
    expect(body.errors[0].source.pointer).toBe('/data/attributes');
  });
});
