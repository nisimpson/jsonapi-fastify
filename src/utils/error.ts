import { JsonapiError } from '../@types';
import { z } from 'zod';
import { FastifyInstance } from 'fastify';
import { RESOURCE_NOT_FOUND_404, UNKNOWN_ERROR_500 } from '../schemas/response';

export class JsonapiFastifyError extends Error {
  errors: JsonapiError[];

  constructor(errors: JsonapiError[]) {
    super('Internal error');
    this.name = 'JsonapiFastifyError';
    this.errors = errors;
  }

  static isInternalError(error: Error): error is JsonapiFastifyError {
    return error.name === 'JsonapiFastifyError';
  }

  static isValidationError(error: Error): error is z.ZodError {
    return error instanceof z.ZodError;
  }

  static zodToJsonapiError(
    error: z.ZodError,
    opts?: { isSerializationError: boolean }
  ): JsonapiError[] {
    const title = opts?.isSerializationError ? 'Serialization Error' : 'Validation Error';
    const status = opts?.isSerializationError ? '500' : '422';
    const issueToJsonapiError = (issue: z.ZodIssue) => {
      // use the embedded issue status if applicable.
      const issueStatus = issue.code === 'custom' ? issue.params?.status : undefined;
      const issueCode = issue.code === 'custom' ? issue.params?.code : 'EINVALID';
      const jsonapiError: Record<string, unknown> = {
        code: issueCode,
        status: issueStatus ?? status,
        title,
        detail: issue.message,
        source: {
          pointer: `/${issue.path.join('/')}`
        }
      };
      if (issue.code === z.ZodIssueCode.invalid_union) {
        const flattened = issue.unionErrors
          .map((err) => err.flatten(issueToJsonapiError))
          .map((obj) => Object.values(obj.fieldErrors).flat())
          .flat();
        jsonapiError.meta = { errors: flattened };
      }
      return jsonapiError;
    };

    const flattened = error.flatten(issueToJsonapiError);
    const fieldErrors = Object.values(flattened.fieldErrors);

    if (Array.isArray(fieldErrors)) {
      return [...flattened.formErrors, ...fieldErrors.flat()];
    }

    return [...flattened.formErrors, ...fieldErrors];
  }
}

export function setErrorHandling(fastify: FastifyInstance): void {
  fastify.log.debug('adding 404 not found handler');
  fastify.setNotFoundHandler(async (_request, reply) => {
    reply.status(404).send(RESOURCE_NOT_FOUND_404.parse({}));
  });

  fastify.log.debug('adding error handler');
  fastify.setErrorHandler((error, request, reply) => {
    request.server.log.error(error);
    if (JsonapiFastifyError.isInternalError(error)) {
      const statusCode = Number(error.errors[0].status);
      reply.status(statusCode).send({ errors: error.errors });
    } else if (JsonapiFastifyError.isValidationError(error)) {
      const isSerializationError = reply.jsonapi.document !== undefined;
      const formattedErrors = JsonapiFastifyError.zodToJsonapiError(error, {
        isSerializationError
      });
      const statusCode = Number(formattedErrors[0].status);
      reply.status(statusCode).send({ errors: formattedErrors });
    } else {
      reply.send(UNKNOWN_ERROR_500.parse({}));
    }
    reply.sent = true;
  });
}
