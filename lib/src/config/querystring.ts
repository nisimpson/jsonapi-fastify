import { FastifyInstance, FastifyServerOptions } from 'fastify';
import qs from 'qs';
import { parse } from 'querystring';
import { JsonapiQuery } from '@typings/jsonapi-fastify';
import { nonEmptyString } from '@schemas/schema';
import { z } from 'zod';

export type ParsedQuery = {
  parsed: Record<string, unknown>;
  refine: () => Record<string, unknown>;
};

type ParsedFieldset = JsonapiQuery['fields'];

export function setContentParser(fastify: FastifyInstance): void {
  // set content parsing -- JSON:API is still json
  fastify.addContentTypeParser(
    'application/vnd.api+json',
    { parseAs: 'string' },
    fastify.getDefaultJsonParser('ignore', 'ignore')
  );
}

// comma delimited tokens, some tokens possibly delimited by periods
const IncludeQueryValue = z.string().regex(/^\w+(\.\w+)*(,\w+(\.\w+)*)*$/);

// comma delimited tokens, some tokens having a desc (-) prefix
const SortQueryValue = z.string().regex(/^[-]{0,1}\w+(,[-]{0,1}\w+)+$/);

const StringToNumber = nonEmptyString.transform((val) => Number(val));

const TransformToArray = (schema: z.ZodString) =>
  schema.optional().transform((val) => (val ? val.split(',') : []));

const RefinedQuery = z
  .object({
    include: TransformToArray(IncludeQueryValue),
    sort: TransformToArray(SortQueryValue),
    fields: z
      .record(nonEmptyString)
      .default({})
      .transform((fields) => {
        const result: ParsedFieldset = {};
        for (const [key, value] of Object.entries(fields)) {
          result[key] = value.split(',');
        }
        return result;
      }),
    page: z
      .object({
        limit: StringToNumber.optional(),
        offset: StringToNumber.optional(),
        cursor: nonEmptyString.optional()
      })
      .default({})
  })
  .passthrough();

export function buildQueryParser(): Partial<FastifyServerOptions> {
  return {
    querystringParser: (fragment) => {
      const parsed = parse(fragment);
      return {
        parsed,
        refine: () => {
          const query: any = qs.parse(fragment);
          const refined = RefinedQuery.parse(query);
          return refined;
        }
      };
    }
  };
}
