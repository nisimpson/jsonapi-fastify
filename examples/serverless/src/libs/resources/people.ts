import { define, MemoryHandler } from "jsonapi-fastify";
import { nanoid } from "nanoid";

const people = define((schema) => ({
  resource: "people",
  idGenerator: () => nanoid(),
  handler: MemoryHandler(),
  fields: {
    firstname: schema.attribute({ type: (z) => z.string() }),
    lastname: schema.attribute({ type: (z) => z.string() }),
    articles: schema.belongsToOne("articles", {
      as: "author",
    }),
  },
  examples: [
    {
      id: "42",
      type: "people",
      firstname: "John",
      lastname: "Doe",
    },
    {
      id: "24",
      type: "people",
      firstname: "Jane",
      lastname: "Doe",
    },
    {
      id: "22",
      type: "people",
      firstname: "Billy",
      lastname: "Idol",
    },
  ],
  defaultPageSize: 100,
}));

export default people;
