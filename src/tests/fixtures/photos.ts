import { nanoid } from 'nanoid';
import { define } from '../..';
import { MemoryHandler } from '../../handlers/MemoryHandler';

export const photos = define((field) => ({
  resource: 'photos',
  idGenerator: () => nanoid(),
  handlers: MemoryHandler(),
  fields: {
    category: field((z) => z.string()),
    photographer: field.toOne('people'),
    owner: field.toOne('people')
  },
  examples: [
    {
      id: 'e2ab4076-78ab-46ac-9c10-8483d48273d2',
      type: 'photos',
      category: 'portrait',
      photographer: {
        id: '8e6ce2a6-de8b-43ba-8f27-98e07b3e2151',
        type: 'people'
      },
      owner: {
        id: '8c9acee3-31de-4a20-9e05-064f98c39751',
        type: 'people'
      }
    }
  ],
  defaultPageSize: 100
}));
