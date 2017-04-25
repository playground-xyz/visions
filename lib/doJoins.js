'use strict';

const joinjs = require('join-js').default;

module.exports = function doJoins(res, models, originalModel, modifiedModel, skip, limit) {

  // Manipulate the models being passed into join-js to un-populate the collections/associations of
  // associations/collections
  models = models.map(model => {
    const assocFound = originalModel.associations.find(assoc => assoc.mapId === model.mapId);
    const collFound = originalModel.collections.find(coll => coll.mapId === model.mapId);
    if (collFound || assocFound) {
      model.properties = model.properties.concat(
          model.associations.map(assoc => assoc.mapId)
      );
      model.properties = model.properties.concat(
          model.collections.map(coll => coll.mapId)
      );
      model.collections = [];
      model.associations = [];
    }
    return model;
  });

  // Do the populating
  let joined = joinjs.map(res, models, originalModel.mapId);

  // Simplify the collections that shouldnt be populated
  modifiedModel.collections.forEach(coll => {
    if (!coll.populate) {
      joined = joined.map(nested => {
        nested[coll.name] = nested[coll.name].map(c => c.id);
        return nested;
      });
    }
  });

  // Remove all the records before the skip value
  if (skip) {
    joined.splice(0, skip);
  }

  // Remove all records after the limit value
  if (limit) {
    joined.splice(limit);
  }

  return joined;
};
