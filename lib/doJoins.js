const joinjs = require('join-js').default;

function doJoins(res, models, originalModel, modifiedModel) {

  // Manipulate the models being passed into join-js to un-populate the collections/associations of
  // associations/collections
  models = models.map(model => {

    // Get all the properties of the tables joined
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

    // Keep the un-populated associations as properties for the purposes of join-js
    if (model.mapId === originalModel.mapId) {
      model.properties = model.properties.concat(
          modifiedModel.associations.filter(a => !a.populate).map(a => a.mapId)
      );
      model.associations = modifiedModel.associations.filter(a => a.populate);
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

  return joined;
}

module.exports = doJoins;
