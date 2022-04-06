import { LinkFunction } from 'jsonapi-serializer';
import { JsonapiHandler } from '../@types';
import { PageData } from '../@types/handler';

type LinkFunctionRecord = Record<string, LinkFunction>;

export function createPaginationLinks(
  data: PageData | undefined,
  opts: {
    type?: string;
    style: JsonapiHandler['pagination'];
    prefix: string;
    relation?: string;
    limit: number;
  }
): LinkFunctionRecord {
  const links: LinkFunctionRecord = {};

  if (data === undefined) {
    return links;
  }

  const prefix = (current: any, parent: any) => {
    return opts.relation
      ? `${opts.prefix}/${parent.type}/${parent.id}/relationships/${opts.relation}`
      : `${opts.prefix}/${current?.type ?? opts.type}`;
  };

  const { prev, next } = data;
  const { limit } = opts;

  if (prev) {
    links.prev = (_record, current, parent) => {
      return `${prefix(current, parent)}?page[${opts.style}]=${prev}&page[limit]=${limit}`;
    };
  }
  if (next) {
    links.next = (_record, current, parent) => {
      return `${prefix(current, parent)}?page[${opts.style}]=${next}&page[limit]=${limit}`;
    };
  }

  return links;
}
