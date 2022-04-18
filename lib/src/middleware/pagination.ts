import { PageData } from '@typings/handler';
import { JsonapiHandler } from '@typings/jsonapi-fastify';
import { LinksSerializationOptions } from '@utils/serializer';

export function serializePaginationLinks(
  data: PageData | undefined,
  opts: {
    type?: string;
    style: JsonapiHandler['pagination'];
    prefix: string;
    relation?: string;
    limit: number;
  }
): LinksSerializationOptions {
  const links: LinksSerializationOptions = {};
  if (data === undefined) {
    return links;
  }

  const prefix = (
    current: any,
    parent: any,
    id: (value: any) => string,
    type: (value: any) => string
  ) => {
    return opts.relation
      ? `${opts.prefix}/${type(parent)}/${id(parent)}/relationships/${opts.relation}`
      : `${opts.prefix}/${Array.isArray(current) ? opts.type : type(current)}`;
  };

  const { prev, next } = data;
  const { limit } = opts;

  if (prev) {
    links.prev = (current, parent, { id, type }) => {
      return `${prefix(current, parent, id, type)}?page[${
        opts.style
      }]=${prev}&page[limit]=${limit}`;
    };
  }
  if (next) {
    links.next = (current, parent, { id, type }) => {
      return `${prefix(current, parent, id, type)}?page[${
        opts.style
      }]=${next}&page[limit]=${limit}`;
    };
  }

  return links;
}
