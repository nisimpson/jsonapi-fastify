export type Meta = {
  [key: string]: unknown;
};

type JsonapiObject = {
  version: string;
  meta?: Meta;
  [key: string]: unknown;
};

export type Link =
  | string
  | {
      href?: string;
      meta?: Meta;
    };

export type LinksRecord = {
  [key: string]: Link;
};

type SelfLink = LinksRecord & {
  self: Link;
};

type RelatedLink = LinksRecord & {
  related: Link;
};

type RelationshipLinks = LinksRecord & (SelfLink | RelatedLink);

export type ResourceRef = {
  id: string;
  type: string;
  meta?: Meta;
};

export type RelationshipObjectData = ResourceRef | ResourceRef[] | null;

export type RelationshipObject = {
  links?: RelationshipLinks;
  meta?: Meta;
  data?: RelationshipObjectData;
};

type SetRequired<TObject, TProp extends keyof TObject> = Omit<TObject, TProp> & {
  [P in TProp]-?: TObject[P];
};

type SetOptional<TObject, TProp extends keyof TObject> = Omit<TObject, TProp> & {
  [P in TProp]?: TObject[P];
};

type RelationshipsRecord = {
  [key: string]:
    | SetRequired<RelationshipObject, 'links'>
    | SetRequired<RelationshipObject, 'meta'>
    | SetRequired<RelationshipObject, 'data'>;
};

type AnyAttributes = {
  [key: string]: any;
};

export type ResourceObject<TAttributes = AnyAttributes> = {
  links?: LinksRecord;
  meta?: Meta;
  id: string;
  type: string;
  attributes?: TAttributes;
  relationships?: RelationshipsRecord;
};

export type JsonapiErrorObject = {
  meta?: Meta;
  id?: string;
  links?: LinksRecord;
  status?: string;
  code?: string;
  title?: string;
  detail?: string;
  source?: {
    pointer?: string;
    parameter?: string;
  };
};

type DocumentBaseProps<TData> = {
  data?: TData;
  errors?: JsonapiErrorObject[];
  meta?: Meta;
  jsonapi?: JsonapiObject;
  links?: LinksRecord;
  included?: ResourceObject[];
};

type ResponseDocument<TData> =
  | SetRequired<DocumentBaseProps<TData>, 'data'>
  | SetRequired<DocumentBaseProps<TData>, 'errors'>
  | SetRequired<DocumentBaseProps<TData>, 'meta'>;

type RequestDocument<TData> = SetRequired<DocumentBaseProps<TData>, 'data'>;

type CreateResourceData<TAttributes> = SetOptional<ResourceObject<TAttributes>, 'id'>;
type UpdateResourceData<TAttributes> = ResourceObject<TAttributes>;
type UpdateRelationData = RelationshipObjectData;

type SingleResourceData<TAttributes> = ResourceObject<TAttributes>;
type MultiResourceData<TAttributes> = ResourceObject<TAttributes>[];
type RelatedResourceData = RelationshipObjectData;

export type CreateResourceDocument<TAttributes = AnyAttributes> = RequestDocument<
  CreateResourceData<TAttributes>
>;

export type UpdateResourceDocument<TAttributes = AnyAttributes> = RequestDocument<
  UpdateResourceData<TAttributes>
>;

export type UpdateRelationDocument = RequestDocument<UpdateRelationData>;

export type SingleResourceDocument<TAttributes = AnyAttributes> = ResponseDocument<
  SingleResourceData<TAttributes>
>;

export type MultiResourceDocument<TAttributes = AnyAttributes> = ResponseDocument<
  MultiResourceData<TAttributes>
>;

export type RelatedResourceDocument = ResponseDocument<RelatedResourceData>;

export type ResourceDocument<TAttributes = AnyAttributes> =
  | SingleResourceDocument<TAttributes>
  | MultiResourceDocument<TAttributes>;
