import { nanoid } from 'nanoid';
import { define } from '../../index';
import TestHandler from './TestHandler';

type Tag = {
  value: string;
};

export const TagHandler = TestHandler<Tag>({});

const tags = define<Tag>((schema) => ({
  resource: 'tags',
  idGenerator: () => nanoid(),
  handler: TagHandler,
  fields: {
    value: schema.attribute({ type: (z) => z.string() })
  },
  allowsIdOnCreate: true,
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
