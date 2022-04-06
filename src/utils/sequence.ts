import type { FastifyReply, FastifyRequest } from 'fastify';

type PromiseChain<TParams> = (params: TParams) => Promise<TParams>;

type FastifyAsyncCallbackParams = {
  request: FastifyRequest;
  reply: FastifyReply;
};

export type FastifyAsyncCallback = PromiseChain<FastifyAsyncCallbackParams>;

export type SequenceDecorator = (
  request: FastifyRequest,
  reply: FastifyReply,
  operations: FastifyAsyncCallback[]
) => Promise<void>;

const sequence: SequenceDecorator = async (request, reply, operations) => {
  let args = { request, reply };
  request.server.log.trace('executing sequence');
  for (const op of operations) {
    if (args.reply.sent) {
      request.server.log.trace('reply was sent; breaking sequence');
      break;
    }

    args = await op(args);
  }
  request.server.log.trace('sequence completed');
};

export { sequence };
