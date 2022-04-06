import { nanoid } from 'nanoid';
import { define } from '../..';
import TestHandler from './TestHandler';

type Tag = {
  value: string;
};

export const TagHandler = TestHandler<Tag>({});

const tags = define<Tag>((field) => ({
  resource: 'tags',
  idGenerator: () => nanoid(),
  handlers: TagHandler,
  fields: {
    value: field((z) => z.string())
  },
  allowClientIdOnCreate: true,
  defaultPageSize: 100,
  examples: [
    {
      id: 'jsonapi',
      type: 'tags',
      value: '#jsonapi'
    },
    {
      id: 'apis',
      type: 'tags',
      value: '#apis'
    }
  ]
}));

export default tags;
