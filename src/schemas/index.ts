import { FastifyInstance } from 'fastify';
import * as common from './common';
import * as request from './request';
import * as response from './response';
import * as validation from './validation';

export function setValidationAndSerialization(fastify: FastifyInstance): void {
  fastify.log.debug('adding validator');

  fastify.setValidatorCompiler((params) => {
    const { httpPart } = params;
    return (data: unknown) => {
      fastify.log.trace(`validating http part: ${httpPart}`);
      return validation.defaultValidationCompiler(params)(data);
    };
  });

  fastify.log.debug('adding serializer');
  fastify.setSerializerCompiler((params) => {
    return (data) => {
      const schema = params.schema as validation.ValidationSchema;
      fastify.log.trace('serializing payload');
      if (schema) {
        data = schema.properties.parse(data);
      }
      return JSON.stringify(data);
    };
  });
}

export { common, request, response, validation };
