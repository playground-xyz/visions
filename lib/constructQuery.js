'use strict';
const helpers = require('./helpers');

/**
 * Contructs a knex object ready to extract the required info to feed into the mapper
 * for auto-populating collections/associations.
 *
 * @param {JoinJsMap} models
 * @param {Object} model
 * @param {KnexInstance} knex
 */
module.exports = function (models, model, knex, whereClauses, sortAttr, sortDir) {

  // Generate the select statements needed for the joins and result mapping
  const idSelect = helpers.createSelectStatement(
      model.viewId,
      model.idProperty,
      model.mapId
  );

  const propSelects = model.properties.map(prop =>
      helpers.createSelectStatement(model.viewId, prop)
  );


  const assocSelects = model.associations.map(assoc => {
    if (!assoc.populate) {
      // If an association is not populated, all we need is the regular column
      // in the table
      return [helpers.createSelectStatement(model.viewId, assoc.mapId)];
    }

    const assocModel = models.find(m => m.mapId === assoc.mapId);
    
    // Get the property fields
    let pSelects = assocModel.properties.map(prop =>
        helpers.createRenamedSelectStatement(assoc.viewId, prop, assoc.mapId)
    );
    // Get the ID field
    pSelects.push(
        helpers.createRenamedSelectStatement(assoc.viewId, assocModel.idProperty, assoc.mapId)
    );
    // Get the fields for associations of the populated association
    pSelects = pSelects.concat(assocModel.associations.map(assocAssoc =>
        helpers.createRenamedSelectStatement(assoc.viewId, assocAssoc.mapId, assoc.mapId)
    ));
    return pSelects;
  });

  const collectionSelects = model.collections.map(coll => {
    const collModel = models.find(m => m.mapId === coll.mapId);

    let pSelects = collModel.properties.map(prop =>
        helpers.createRenamedSelectStatement(coll.viewId, prop, coll.mapId)
    );

    pSelects.push(
        helpers.createRenamedSelectStatement(coll.viewId, collModel.idProperty, coll.mapId)
    );

    if (coll.populate) {
      pSelects = pSelects.concat(collModel.associations.map(collAssoc =>
          helpers.createRenamedSelectStatement(coll.viewId, collAssoc.mapId, coll.mapId)
      ));
    }

    return pSelects;
  });

  // Generate a list of params to be passed to leftJoin
  const assocJoinParams = model.associations.map(assoc => {
    if (!assoc.populate) {
      return null;
    }
    return helpers.createAssociationJoinParameters(model.viewId, assoc.mapId, assoc.viewId);
  });
  const collJoinParams = model.collections.map(coll =>
    helpers.createCollectionJoinParameters(model.mapId, model.viewId, coll.mapId, coll.viewId)
  );

  const allSelects = [idSelect].concat(propSelects).concat(assocSelects).concat(collectionSelects);

  // Put it all together
  let queryObj = knex
      .select(
          // Flatten the array of select strings
          [].concat.apply([], allSelects)
      )
      .from(model.viewId);

  // Remove any null param sets
  const joinParams = assocJoinParams.concat(collJoinParams).filter(p => !!p);

  // Attach the join to the query Object
  queryObj = helpers.attachJoins(queryObj, joinParams);

  const modifiedWhereClauses = whereClauses.map(clause => {

    // Default to the view on the model itself
    let viewId = model.viewId;

    // If a model is specified, use its view
    if (clause.model) {
      const altModel = models.find(m => m.mapId === clause.model);
      if (!altModel) {
        throw new Error('Invalid model value');
      }
      viewId = altModel.viewId;
    }

    return {
      method: clause.value ? 'where' : 'whereIn',
      params: [`${viewId}.${clause.key}`, clause.value || clause.values]
    };
  });

  // Attach any where clauses we need
  queryObj = helpers.applyWhereClauses(queryObj, modifiedWhereClauses);

  // Add an order by clause if specified
  if (sortAttr && sortDir) {
    queryObj = queryObj.orderBy(`${model.viewId}.${sortAttr}`, sortDir);
  }

  return queryObj;
};
