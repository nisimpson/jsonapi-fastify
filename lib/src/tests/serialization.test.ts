import serializer from '../utils/serializer';

const { serialize, deserialize } = serializer;

describe('jsonapi serializer', () => {
  describe('id and type', () => {
    it('should retrieve the correct id and type', () => {
      const data = {
        id: '1',
        type: 'apples',
        kind: 'Red Delicious'
      };
      const result: any = serialize(data, {
        id: (data: any) => data.id,
        type: (data: any) => data.type,
        resources: {
          apples: { attributes: ['kind'] }
        }
      });
      expect(result.data).toBeDefined();
      expect(result.data.id).toBe('1');
    });

    it('should retrieve the correct id and type (multi)', () => {
      const data = [
        {
          id: '1',
          type: 'apples'
        },
        {
          id: '2',
          type: 'apples'
        }
      ];
      const result: any = serialize(data, {
        id: (data: any) => data.id,
        type: (data: any) => data.type,
        resources: {
          apples: { attributes: ['kind'] }
        }
      });
      expect(result.data).toBeDefined();
      expect(result.data[0].id).toBe('1');
      expect(result.data[0].type).toBe('apples');
      expect(result.data[1].id).toBe('2');
      expect(result.data[1].type).toBe('apples');
    });
  });

  describe('attributes', () => {
    it('should serialize attributes', () => {
      const data = {
        id: '1',
        type: 'apples',
        kind: 'Red Delicious'
      };
      const result: any = serialize(data, {
        id: (data: any) => data.id,
        type: (data: any) => data.type,
        resources: {
          apples: { attributes: ['kind'] }
        }
      });
      expect(result.data).toBeDefined();
      expect(result.data.id).toBe('1');
      expect(result.data.type).toBe('apples');
      expect(result.data.attributes).toBeDefined();
      expect(result.data.attributes.kind).toBe('Red Delicious');
    });

    it('should serialize attributes (multi)', () => {
      const data = [
        {
          id: '1',
          type: 'apples',
          kind: 'Red Delicious'
        },
        {
          id: '2',
          type: 'apples',
          kind: 'Granny Smith'
        }
      ];
      const result: any = serialize(data, {
        id: (data: any) => data.id,
        type: (data: any) => data.type,
        resources: {
          apples: { attributes: ['kind'] }
        }
      });
      expect(result.data).toBeDefined();
      expect(result.data[0].id).toBe('1');
      expect(result.data[0].type).toBe('apples');
      expect(result.data[0].attributes).toBeDefined();
      expect(result.data[0].attributes.kind).toBe('Red Delicious');
      expect(result.data[1].id).toBe('2');
      expect(result.data[1].type).toBe('apples');
      expect(result.data[1].attributes).toBeDefined();
      expect(result.data[1].attributes.kind).toBe('Granny Smith');
    });

    it('should ignore keys', () => {
      const data = {
        id: '1',
        type: 'apples',
        kind: 'Red Delicious',
        tastes: 'Alright, not the best'
      };
      const result: any = serialize(data, {
        id: (data: any) => data.id,
        type: (data: any) => data.type,
        resources: {
          apples: { attributes: ['kind'] }
        }
      });
      expect(result.data).toBeDefined();
      expect(result.data.id).toBe('1');
      expect(result.data.type).toBe('apples');
      expect(result.data.attributes).toBeDefined();
      expect(result.data.attributes.kind).toBe('Red Delicious');
      expect(result.data.attributes.tastes).not.toBeDefined();
    });

    it('should handle complex attributes', () => {
      const data = {
        id: '1',
        type: 'apples',
        kind: 'Red Delicious',
        tastes: {
          cooked: 'Lovely',
          raw: 'Not so good'
        },
        dishes: ['pies', 'salads', 'jams', 'jellies']
      };
      const result: any = serialize(data, {
        id: (data: any) => data.id,
        type: (data: any) => data.type,
        resources: {
          apples: { attributes: ['kind', 'tastes', 'dishes'] }
        }
      });
      expect(result.data).toBeDefined();
      expect(result.data.id).toBe('1');
      expect(result.data.type).toBe('apples');
      expect(result.data.attributes).toBeDefined();
      expect(result.data.attributes.kind).toBe('Red Delicious');
      expect(result.data.attributes.tastes).toStrictEqual({
        cooked: 'Lovely',
        raw: 'Not so good'
      });
      expect(result.data.attributes.dishes).toEqual(
        expect.arrayContaining(['pies', 'salads', 'jams', 'jellies'])
      );
    });
  });

  describe('relationships', () => {
    it('should serialize relationships', () => {
      const data = {
        id: '1',
        type: 'apples',
        kind: 'Red Delicious',
        store: {
          id: '42',
          type: 'stores'
        }
      };
      const result: any = serialize(data, {
        id: (data: any) => data.id,
        type: (data: any) => data.type,
        resources: {
          apples: {
            attributes: ['kind'],
            relationships: {
              store: {}
            }
          }
        }
      });
      expect(result.data.relationships).toBeDefined();
      expect(result.data.relationships.store.data.id).toBe('42');
      expect(result.data.relationships.store.data.type).toBe('stores');
    });

    it('should serialize relationships (multi)', () => {
      const data = {
        id: '1',
        type: 'apples',
        kind: 'Red Delicious',
        store: [
          {
            id: '42',
            type: 'stores'
          },
          {
            id: '24',
            type: 'stores'
          }
        ]
      };
      const result: any = serialize(data, {
        id: (data: any) => data.id,
        type: (data: any) => data.type,
        resources: {
          apples: {
            attributes: ['kind'],
            relationships: {
              store: {}
            }
          }
        }
      });
      expect(result.data.relationships).toBeDefined();
      expect(result.data.relationships.store.data[0].id).toBe('42');
      expect(result.data.relationships.store.data[0].type).toBe('stores');
      expect(result.data.relationships.store.data[1].id).toBe('24');
      expect(result.data.relationships.store.data[1].type).toBe('stores');
    });
  });

  describe('links', () => {
    it('should serialize top links', () => {
      const data = {
        id: '1',
        type: 'apples',
        kind: 'Red Delicious'
      };
      const result: any = serialize(data, {
        id: (data: any) => data.id,
        type: (data: any) => data.type,
        links: {
          self: (current, _, opts) => `/${opts.type(current)}/${opts.id(current)}`
        },
        resources: {
          apples: { attributes: ['kind'] }
        }
      });
      expect(result.links.self).toBe('/apples/1');
    });

    it('should serialize data links', () => {
      const data = {
        id: '1',
        type: 'apples',
        kind: 'Red Delicious'
      };
      const result: any = serialize(data, {
        id: (data: any) => data.id,
        type: (data: any) => data.type,
        links: {
          self: (current, _, opts) => `/${opts.type(current)}/${opts.id(current)}`
        },
        resources: {
          apples: {
            dataLinks: {
              self: (current, _, opts) =>
                `https://www.example.com/${opts.type(current)}/${opts.id(current)}`
            },
            attributes: ['kind']
          }
        }
      });
      expect(result.links.self).toBe('/apples/1');
      expect(result.data.links.self).toBe('https://www.example.com/apples/1');
    });

    it('should serialize data links (multi)', () => {
      const data = [
        {
          id: '1',
          type: 'apples'
        },
        {
          id: '2',
          type: 'apples'
        }
      ];
      const result: any = serialize(data, {
        id: (data: any) => data.id,
        type: (data: any) => data.type,
        resources: {
          apples: {
            dataLinks: {
              self: (current, _, opts) =>
                `https://www.example.com/${opts.type(current)}/${opts.id(current)}`
            },
            attributes: ['kind']
          }
        }
      });
      expect(result.data[0].links.self).toBe('https://www.example.com/apples/1');
      expect(result.data[1].links.self).toBe('https://www.example.com/apples/2');
    });

    it('should serialize relationship links', () => {
      const data = {
        id: '1',
        type: 'apples',
        kind: 'Red Delicious',
        store: {
          id: '42',
          type: 'stores'
        }
      };
      const result: any = serialize(data, {
        id: (data: any) => data.id,
        type: (data: any) => data.type,
        resources: {
          apples: {
            attributes: ['kind'],
            relationships: {
              store: {
                relationshipLinks: {
                  self: (_, parent, opts) =>
                    `/${opts.type(parent)}/${opts.id(parent)}/relationships/store`,
                  related: (_, parent, opts) => `/${opts.type(parent)}/${opts.id(parent)}/store`
                }
              }
            }
          }
        }
      });
      expect(result.data.relationships.store.links.self).toBe('/apples/1/relationships/store');
      expect(result.data.relationships.store.links.related).toBe('/apples/1/store');
    });
  });

  describe('metadata', () => {
    it('should serialize relationship meta', () => {
      const data = {
        id: '1',
        type: 'apples',
        kind: 'Red Delicious',
        store: {
          id: '42',
          type: 'stores'
        }
      };
      const result: any = serialize(data, {
        id: (data: any) => data.id,
        type: (data: any) => data.type,
        resources: {
          apples: {
            attributes: ['kind'],
            relationships: {
              store: {
                relationshipMeta: () => ({ grocery: false })
              }
            }
          }
        }
      });
      expect(result.data.relationships.store.meta).toStrictEqual({ grocery: false });
    });

    it('should serialize relationship data metadata', () => {
      const data = {
        id: '1',
        type: 'apples',
        kind: 'Red Delicious',
        store: {
          id: '42',
          type: 'stores'
        }
      };
      const result: any = serialize(data, {
        id: (data: any) => data.id,
        type: (data: any) => data.type,
        resources: {
          apples: {
            attributes: ['kind'],
            relationships: {
              store: {
                relationshipMeta: () => ({ grocery: false })
              }
            }
          },
          stores: {
            dataMeta: (curr, _, { id }) => ({ answer: id(curr) })
          }
        }
      });
      expect(result.data.relationships.store.data.meta).toStrictEqual({
        answer: '42'
      });
    });
  });

  describe('included resources', () => {
    it('should include nested resources', () => {
      const dataSet = [
        {
          id: '1',
          type: 'articles',
          body: 'Basketball is fun!',
          comments: [
            {
              id: '42',
              type: 'comments',
              body: 'Cool article!',
              author: {
                id: '23',
                type: 'people',
                name: 'Michael Jordan'
              }
            },
            {
              id: '24',
              type: 'comments',
              body: 'I have read better...',
              author: {
                id: '33',
                type: 'people',
                name: 'Larry Bird'
              }
            }
          ]
        },
        {
          id: '2',
          type: 'articles',
          comments: [
            {
              id: '25',
              type: 'comments',
              body: 'Subscribed!',
              author: {
                id: '33',
                type: 'people',
                name: 'Larry Bird'
              }
            }
          ]
        }
      ];
      const result: any = serialize(dataSet, {
        id: (data) => data.id,
        type: (data) => data.type,
        included: (path) => 'comments.author'.startsWith(path),
        resources: {
          articles: {
            attributes: ['body'],
            relationships: ['comments']
          },
          comments: {
            attributes: ['body'],
            relationships: ['author']
          },
          people: { attributes: ['name'] }
        }
      });
      expect(result.included).toBeDefined();
      // 3 comments + 2 authors = 5 includes
      expect(result.included.length).toBe(5);
    });

    it('should handle cyclical references', () => {
      const article = {
        id: '1',
        type: 'articles',
        body: 'Basketball is fun!',
        subarticle: null,
        comments: [
          {
            id: '42',
            type: 'comments',
            body: 'Cool article!',
            author: {
              id: '23',
              type: 'people',
              name: 'Michael Jordan'
            }
          },
          {
            id: '24',
            type: 'comments',
            body: 'I have read better...',
            author: {
              id: '33',
              type: 'people',
              name: 'Larry Bird'
            }
          }
        ]
      };
      const dataSet = [
        article,
        {
          id: '2',
          type: 'articles',
          subarticle: article,
          comments: [
            {
              id: '25',
              type: 'comments',
              body: 'Subscribed!',
              author: {
                id: '33',
                type: 'people',
                name: 'Larry Bird'
              }
            }
          ]
        }
      ];
      const result: any = serialize(dataSet, {
        id: (data) => data.id,
        type: (data) => data.type,
        included: (path) => 'comments.author'.startsWith(path),
        dataLinks: {
          self: (data, parent, { id, type }) => `/${type(data)}/${id(data)}`
        },
        relationshipLinks: {
          self: (_, parent, { id, type, ref }) =>
            `/${type(parent)}/${id(parent)}/relationships/${ref}`,
          related: (_, parent, { id, type, ref }) => `/${type(parent)}/${id(parent)}/${ref}`
        },
        relationshipMeta: (data) => ({
          count: Array.isArray(data) ? data.length : undefined
        }),
        resources: {
          articles: {
            attributes: ['body'],
            relationships: ['comments', 'subarticle']
          },
          comments: {
            attributes: ['body'],
            relationships: ['author']
          },
          people: { attributes: ['name'] }
        }
      });
      expect(result.included).toBeDefined();
      console.log(JSON.stringify(result, null, 2));
      // 3 comments + 2 authors = 5 includes
      expect(result.included.length).toBe(5);
    });
  });
});

describe('jsonapi deserializer', () => {
  it('should deserialize the document', () => {
    const document = {
      data: {
        id: '42',
        type: 'cars',
        attributes: {
          make: 'Subaru',
          model: 'WRX',
          year: 2022
        },
        relationships: {
          owner: { data: { id: '24', type: 'people' } }
        }
      }
    };

    const result = deserialize(document);
    expect(result).toStrictEqual({
      id: '42',
      type: 'cars',
      make: 'Subaru',
      model: 'WRX',
      year: 2022,
      owner: {
        id: '24',
        type: 'people'
      }
    });
  });

  it('should deserialize the document (multi)', () => {
    const document = {
      data: [
        {
          id: '42',
          type: 'cars',
          attributes: {
            make: 'Subaru',
            model: 'WRX',
            year: 2022
          },
          relationships: {
            owner: { data: { id: '24', type: 'people' } }
          }
        },
        {
          id: '44',
          type: 'cars',
          attributes: {
            make: 'Honda',
            model: 'Civic',
            year: 2022
          },
          relationships: {
            owner: { data: { id: '24', type: 'people' } }
          }
        }
      ]
    };

    const result = deserialize(document);
    expect(result).toStrictEqual([
      {
        id: '42',
        type: 'cars',
        make: 'Subaru',
        model: 'WRX',
        year: 2022,
        owner: {
          id: '24',
          type: 'people'
        }
      },
      {
        id: '44',
        type: 'cars',
        make: 'Honda',
        model: 'Civic',
        year: 2022,
        owner: {
          id: '24',
          type: 'people'
        }
      }
    ]);
  });

  it('should deserialize relation documents', () => {
    const document = {
      data: [
        {
          id: '42',
          type: 'people'
        },
        {
          id: '24',
          type: 'people'
        }
      ]
    };
    const result = deserialize(document);
    expect(result).toStrictEqual([
      {
        id: '42',
        type: 'people'
      },
      {
        id: '24',
        type: 'people'
      }
    ]);
  });
});
