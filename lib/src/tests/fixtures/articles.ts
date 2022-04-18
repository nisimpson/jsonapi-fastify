import { ToOneRelation, ToManyRelation } from '@typings/jsonapi-fastify';
import { nanoid } from 'nanoid';
import { define } from '../../index';
import TestHandler from './TestHandler';

type Article = {
  title: string;
  body: string;
  created: string;
  updated: string;
  author: ToOneRelation;
  tags: ToManyRelation;
};

export const ArticleHandler = TestHandler<Article>({});

const articles = define<Article>((schema) => ({
  resource: 'articles',
  idGenerator: () => nanoid(),
  defaultPageSize: 100,
  fields: {
    title: schema.attribute({ validator: (z) => z.string() }),
    body: schema.attribute({ validator: (z) => z.string() }),
    created: schema.attribute({ validator: (z) => z.string() }),
    updated: schema.attribute({ validator: (z) => z.string() }),
    author: schema.toOne('people'),
    tags: schema.toMany('tags')
  },
  handlers: ArticleHandler,
  examples: [
    {
      id: '1',
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
    }
  ]
}));

export default articles;
