import { FastifyInstance } from 'fastify';
import main from '../..';
import { JsonapiFastifyOptions } from '../../@types';

export default function build(opts: JsonapiFastifyOptions): FastifyInstance {
  opts.loggerLevel = 'silent';
  return main(opts);
}
