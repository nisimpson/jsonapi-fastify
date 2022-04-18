import { nanoid } from 'nanoid';
import { define } from '../../index';
import TestHandler from './TestHandler';

type Person = {
  firstname: string;
  lastname: string;
  articles?: undefined;
};

export const PersonHandler = TestHandler<Person>({});

const people = define<Person>((schema) => ({
  resource: 'people',
  description: "The people's resource",
  idGenerator: () => nanoid(),
  handler: PersonHandler,
  fields: {
    firstname: schema.attribute({
      description: "The person's first name.",
      type: (z) => z.string()
    }),
    lastname: schema.attribute({
      description: "The person's last name.",
      type: (z) => z.string()
    }),
    articles: schema.belongsToOne('articles', {
      description: 'The collection of articles written by this person.',
      as: 'author'
    })
  },
  examples: [
    {
      id: '42',
      type: 'people',
      firstname: 'John',
      lastname: 'Doe'
    },
    {
      id: '24',
      type: 'people',
      firstname: 'Jane',
      lastname: 'Doe'
    },
    {
      id: '22',
      type: 'people',
      firstname: 'Billy',
      lastname: 'Idol'
    }
  ],
  defaultPageSize: 100
}));

export default people;
