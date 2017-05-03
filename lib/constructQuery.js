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
module.exports = function (models, model, knex, whereClauses, sortAttr, sortDir, limit, skip) {

  // Generate the select statements needed for the joins and result mapping
  const idSelect = helpers.createSelectStatement(
      `${model.viewId}-core`,
      model.idProperty,
      model.mapId
  );

  const propSelects = model.properties.map(prop =>
      helpers.createSelectStatement(`${model.viewId}-core`, prop)
  );


  const assocSelects = model.associations.map(assoc => {
    if (!assoc.populate) {
      // If an association is not populated, all we need is the regular column
      // in the table
      return [helpers.createSelectStatement(`${model.viewId}-core`, assoc.mapId)];
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
    return helpers.createAssociationJoinParameters(`${model.viewId}-core`, assoc.mapId, assoc.viewId);
  });
  const collJoinParams = model.collections.map(coll =>
    helpers.createCollectionJoinParameters(model.mapId, `${model.viewId}-core`, coll.mapId, coll.viewId)
  );

  const allSelects = [idSelect].concat(propSelects).concat(assocSelects).concat(collectionSelects);

  // Put it all together
  let queryObj = knex

      // Build a subquery to apply the limit, skip and order-by on the primary entity for the query
      .with(`${model.viewId}-core`, qb => {
          qb = qb.select()
                 .from(model.viewId);
          if (limit) {
            qb = qb.limit(limit);
          }
          if (skip) {
            qb = qb.offset(skip);
          }
          if (sortAttr && sortDir) {
            qb = qb.orderBy(`${model.viewId}.${sortAttr}`, sortDir);
          }

          return qb;
      })

      .select(
          // Flatten the array of select strings
          [].concat.apply([], allSelects)
      )
      .from(`${model.viewId}-core`);

  // Remove any null param sets
  const joinParams = assocJoinParams.concat(collJoinParams).filter(p => !!p);

  // Attach the join to the query Object
  queryObj = helpers.attachJoins(queryObj, joinParams);

  const modifiedWhereClauses = whereClauses.map(clause => {

    // Default to the view on the model itself
    let viewId = `${model.viewId}-core`;

    // If a model is specified, use its view
    if (clause.model) {
      const altModel = models.find(m => m.mapId === clause.model);
      if (!altModel) {
        throw new Error('Invalid model value');
      }
      viewId = altModel.viewId;
    }

    let binding = clause.value;
    if (binding === undefined) {
      binding = clause.values;
    }
    return {
      method: getMethodFromClause(clause),
      params: [`${viewId}.${clause.key}`, binding]
    };
  });

  // Attach any where clauses we need
  queryObj = helpers.applyWhereClauses(queryObj, modifiedWhereClauses);

  if (sortAttr && sortDir) {
    queryObj = queryObj.orderBy(`${model.viewId}-core.${sortAttr}`, sortDir);
  }

  return queryObj;
};

function getMethodFromClause(clause) {
  if (clause.value !== undefined) {
    return 'where';
  }
  if (clause.values !== undefined) {
    return 'whereIn';
  }

  throw new Error('Must pass in value or values parameter for each clause');
}
