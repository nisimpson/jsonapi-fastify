import { JsonapiRelation } from '@typings/jsonapi-fastify';
import { nanoid } from 'nanoid';
import { define } from '../../index'
import TestHandler from './TestHandler';

type Comment = {
  body: string;
  author: JsonapiRelation;
  article: JsonapiRelation;
};

export const CommentHandler = TestHandler<Comment>({});

const comments = define<Comment>((field) => ({
  resource: 'comments',
  idGenerator: () => nanoid(),
  defaultPageSize: 100,
  fields: {
    body: field((z) => z.string()),
    author: field.toOne('people'),
    article: field.toOne('articles')
  },
  handlers: CommentHandler,
  examples: [
    {
      id: '1',
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
    },
    {
      id: '2',
      type: 'comments',
      body: 'JSON is awesome!',
      author: {
        id: '22',
        type: 'people'
      },
      article: {
        id: '1',
        type: 'articles'
      }
    }
  ]
}));

export default comments;
