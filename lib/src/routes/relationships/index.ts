import { decorate } from './updateRelationship';
import findRelated from './findRelated';
import findRelationship from './findRelationship';

export default {
  related: findRelated,
  find: findRelationship,
  update: decorate('relationship:update'),
  add: decorate('relationship:add'),
  remove: decorate('relationship:remove')
};
