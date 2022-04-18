/* eslint-disable @typescript-eslint/no-unused-vars */

import * as jsonapiSerializer from 'jsonapi-serializer';

type RelationshipDeserializer = (relationship: { id: string; type: string }) => Promise<unknown>;

declare module 'jsonapi-serializer' {
  export interface DeserializerOptions {
    [key: string]: unknown;
  }

  export type RelationshipOptions = {
    valueForRelationship: RelationshipDeserializer;
  };
}
