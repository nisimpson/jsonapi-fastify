/* eslint-disable @typescript-eslint/no-unused-vars */

import * as fastify from 'fastify';
import type { JsonapiContext } from '../jsonapi-fastify';

declare module 'fastify' {
  export interface FastifyRequest {
    jsonapi: JsonapiContext;
  }

  export interface FastifyReply {
    jsonapi: JsonapiContext;
  }
}
