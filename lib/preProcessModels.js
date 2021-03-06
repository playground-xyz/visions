/**
 * Process models to ensure that all the viewId properties are valid.
 * @ignore
 *
 * @param {JoinJsMap} models
 * @param {Object} views
 */
module.exports = function preProcessModels(models, views) {
  return models.map(model => {
    const output = {
      mapId: model.mapId,
      viewId: views[model.mapId] || model.mapId,
      idProperty: model.idProperty,
      properties: model.properties
    };

    output.associations = (model.associations || []).map(assoc => ({
      name: assoc.name,
      mapId: assoc.mapId,
      idProperty: model.idProperty,
      viewId: views[assoc.mapId] || assoc.mapId,
      columnPrefix: `${assoc.mapId}_`
    }));

    output.collections = (model.collections || []).map(coll => ({
      name: coll.name,
      mapId: coll.mapId,
      idProperty: model.idProperty,
      joinTable: coll.joinTable,
      viewId: views[coll.mapId] || coll.mapId,
      columnPrefix: `${coll.mapId}_`,
      isOneToOne: coll.isOneToOne
    }));
    return output;
  });
};
