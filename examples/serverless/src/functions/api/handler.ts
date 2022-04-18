import { middyfy } from "@libs/lambda";
import people from "@libs/resources/people";
import awsLambdaFastify from "aws-lambda-fastify";
import { jsonapiFastify } from "jsonapi-fastify";

const server = jsonapiFastify({
  urlPrefixAlias: `http://localhost:3000/${process.env.STAGE}`,
  prefix: "/api",
  openapi: {
    info: {
      version: "1.0.0",
      title: "test server",
      description: "a jsonapi server",
      contact: {
        url: "https://jsonapi.org",
        email: "support@jsonapi.org",
      },
      license: {
        name: "MIT",
        url: "https://jsonapi.org/license",
      },
    },
  },
  definitions: [people],
});

server.init();
const api = awsLambdaFastify(server);
export const main = middyfy(api);
