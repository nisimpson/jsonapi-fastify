import { nanoid } from 'nanoid';
import { define } from '../..';
import TestHandler from './TestHandler';

type Person = {
  firstname: string;
  lastname: string;
  articles?: undefined;
};

export const PersonHandler = TestHandler<Person>({});

const people = define<Person>((field) => ({
  resource: 'people',
  idGenerator: () => nanoid(),
  handlers: PersonHandler,
  fields: {
    firstname: field((z) => z.string()),
    lastname: field((z) => z.string()),
    articles: field.belongsToOne({
      resource: 'articles',
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
