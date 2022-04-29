# @jsonapi-fastify/serverless-example

## 1.0.1

### Patch Changes

- ec5f06a:

  #### Bugfixes

  - Fixed validation on create and update resource requests. The expected behavior for create and update request documents
    better reflect expectations expressed in the JSON:API 1.0 specification.

  #### Chores

  - Updated gitlab actions to use changeset action as intended. See the repo [readme](https://github.com/changesets/action#readme)
    for details.

  - Updated package.json to only include distribution files, license, and markdown (README, CHANGELOG)

  - Fixed serverless example handler

- Updated dependencies [ec5f06a]
  - jsonapi-fastify@0.0.3
