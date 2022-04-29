---
"@jsonapi-fastify/serverless-example": patch
"jsonapi-fastify": patch
---

## Bugfixes

- Fixed validation on create and update resource requests. The expected behavior for create and update request documents
  better reflect expectations expressed in the JSON:API 1.0 specification.

## Chores

- Updated gitlab actions to use changeset action as intended. See the repo [readme](https://github.com/changesets/action#readme)
  for details.

- Updated package.json to only include distribution files, license, and markdown (README, CHANGELOG)

- Fixed serverless example handler
