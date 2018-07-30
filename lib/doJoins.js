const joinjs = require('join-js').default;

/**
 * Makes the required adjustments to the models before passing it into join-js.
 * @ignore
 */
module.exports = function doJoins(res, models, originalModel, modifiedModel) {

  // Manipulate the models being passed into join-js to un-populate the
  // collections/associations of associations/collections
  models = models.map(model => {

    // Update the models of the entities that are being joined into the current query.
    // They need to not include any joins of their own, instead the keys they are
    // joined on are moved to basic properties
    const assocFound = originalModel.associations.find(assoc => assoc.mapId === model.mapId);
    const collFound = originalModel.collections.find(coll => coll.mapId === model.mapId);
    if (collFound || assocFound) {
      model.properties = model.properties.concat(
        model.associations.map(assoc => assoc.mapId)
      );
      model.associations = [];

      // Collections are removed entirely as we dont want 2 levels of nesting
      model.collections = [];
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
    const collFound = models.find(model => coll.mapId === model.mapId);
    if (!coll.populate) {
      joined = joined.map(nested => {
        nested[coll.name] = nested[coll.name].map(c => c[collFound.idProperty]);
        return nested;
      });
    }

    if (coll.isOneToOne) {
      joined = joined.map(nested => {
        if (Array.isArray(nested[coll.name]) && nested[coll.name].length === 1) {
          nested[coll.name] = nested[coll.name][0];
        }
        return nested;
      });
    }
  });


  return joined;
};
