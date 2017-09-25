const helpers = require('./helpers');

/**
 * Builds up a list of select statements for a collection of the entity being queried. This
 * includes the idProperty, any regular properties and any associations if this collection
 * is populated.
 * @ignore
 */
function addCollectionSelects(coll, model, models) {
  const collModel = models.find(m => m.mapId === coll.mapId);

  let selects = collModel.properties.map(prop =>
      helpers.createRenamedSelectStatement(coll.viewId, prop, coll.mapId)
  );

  selects.push(
      helpers.createRenamedSelectStatement(coll.viewId, collModel.idProperty, coll.mapId)
  );

  if (coll.populate) {
    selects = selects.concat(collModel.associations.map(collAssoc =>
        helpers.createRenamedSelectStatement(coll.viewId, collAssoc.mapId, coll.mapId)
    ));
  }

  return selects;
}

/**
 * Builds up a list of select statements for an association of the entity being queried. This
 * is just the Id from the original entity (eg the foreign key) if this association isn't
 * populated, or all properties if it is.
 * @ignore
 */
function addAssociationSelects(assoc, model, models) {
  if (!assoc.populate) {
    // If an association is not populated, all we need is the regular column
    // in the table
    return [helpers.createSelectStatement(`${model.viewId}-core`, assoc.mapId)];
  }

  const assocModel = models.find(m => m.mapId === assoc.mapId);

  // Get the property fields
  let selects = assocModel.properties.map(prop =>
      helpers.createRenamedSelectStatement(assoc.viewId, prop, assoc.mapId)
  );
  // Get the ID field
  selects.push(
      helpers.createRenamedSelectStatement(assoc.viewId, assocModel.idProperty, assoc.mapId)
  );

  // Get the fields for associations of the populated association
  selects = selects.concat(assocModel.associations.map(assocAssoc =>
      helpers.createRenamedSelectStatement(assoc.viewId, assocAssoc.mapId, assoc.mapId)
  ));

  return selects;
}

/**
 * Builds up a list of select statements for the entity being queried.
 * @ignore
 */
function constructSelects(models, model) {
  // Generate the select statements needed for the joins and result mapping
  const idSelect = helpers.createSelectStatement(
      `${model.viewId}-core`,
      model.idProperty,
      model.mapId
  );

  const propSelects = model.properties.map(prop =>
      helpers.createSelectStatement(`${model.viewId}-core`, prop)
  );

  const assocSelects = model.associations.map(assoc =>
      addAssociationSelects(assoc, model, models)
  );

  const collectionSelects = model.collections.map(coll =>
      addCollectionSelects(coll, model, models)
  );

  const allSelects = [idSelect]
      .concat(propSelects)
      .concat(assocSelects)
      .concat(collectionSelects);

  // Flatten the arrays of select statements
  return [].concat.apply([], allSelects);
}

/**
 * Generates a `core` subquery for the primary entity and applies any filters to it, including
 * limit, skip, sort and where clauses. By applying these filters to a subquery, the sorting
 * and pagination will behave as expected with the extra association and collection fields added
 * after.
 * @ignore
 */
function constructSubQuery(qb, viewId, limit, skip, sortAttr, sortDir, whereClauses) {
  qb = qb.select().from(viewId);
  if (limit) {
    qb = qb.limit(limit);
  }
  if (skip) {
    qb = qb.offset(skip);
  }
  if (sortAttr && sortDir) {
    qb = qb.orderBy(`${viewId}.${sortAttr}`, sortDir);
  }

  // Attach any where clauses we need
  qb = helpers.applyWhereClauses(qb, whereClauses);

  return qb;
}

/**
 * As the where clauses are validated when they are passed into the PreparedQuery
 * instance, we know that there will be exactly one value or list of values. We select
 * the relevant knex method depending on the input structure.
 * @ignore
 */
function getMethodFromClause(clause) {
  if (clause.value !== undefined) {
    return 'where';
  }
  if (clause.values !== undefined) {
    return 'whereIn';
  }

  // This is checked when clauses are supplied to the PreparedQuery instance
  // so we should never get here
  throw new Error('Must pass in value or values parameter for each clause');
}


/**
 * Creates an object with the information required to generate a knex where clause. The
 * object has the following keys:
 *
 * - method: 'where' or 'whereIn'
 * - params: A list of parameters to pass to the method (table.field, value(s))
 * - core: Bool indicating if it should be applied to the `core` subquery, or the outer query
 * @ignore
 */
function preProcessWhereClause(clause, models, model) {

  // Default to the the model itself
  let viewId = model.viewId;
  let core = true;
  const params = [];

  // If a model is specified, use its view (outside the core query)
  if (clause.model) {
    const altModel = models.find(m => m.mapId === clause.model);
    if (!altModel) {
      throw new Error(`Invalid modelId value supplied as part of where clause: ${clause}`);
    }
    viewId = altModel.viewId;
    core = false;
  }
  // add the key to the params
  params.push(`${viewId}.${clause.key}`);

  let binding = clause.value;
  if (binding === undefined) {
    binding = clause.values;
  }
  // allow to add an operator to the clause: like, >, <
  if (clause.operator) {
    params.push(clause.operator);
  }
  // add the values
  params.push(binding);

  return {
    method: getMethodFromClause(clause),
    params,
    core
  };
}


/**
 * Contructs a knex object ready to extract the required info to feed into the mapper
 * for auto-populating collections/associations.
 * @ignore
 *
 * @param {JoinJsMap} models
 * @param {Object} model
 * @param {KnexInstance} knex
 * @param {Array} whereClauses - Array of where clauses
 * @param {String} sortAttr - The property to sort based on
 * @param {String} sortDir - asc/desc
 * @param {Int} limit - The max number of results to return
 * @param {Int} skip - The offset from the start of the result set
 */
function constructQuery(models, model, knex, whereClauses, sortAttr, sortDir, limit, skip) {

  const wClauses = whereClauses.map(clause => preProcessWhereClause(clause, models, model));
  const coreWClauses = wClauses.filter(clause => clause.core);

  let queryObj = knex

      // Start with a subquery to apply the limit, skip and order-by
      // on the primary entity for the query
      .with(`${model.viewId}-core`, qb =>
            constructSubQuery(qb, model.viewId, limit, skip, sortAttr, sortDir, coreWClauses))

      .from(`${model.viewId}-core`);

  // Add all the select statements required for the joins and the properties to
  // be returned
  queryObj = queryObj.select(constructSelects(models, model));

  // Generate a list of params to be passed to leftJoin
  const assocJoinParams = model.associations
    .filter(assoc => assoc.populate)
    .map(assoc => helpers.createAssociationJoinParameters(
        `${model.viewId}-core`,
        assoc.mapId,
        assoc.viewId
    ));

  const collJoinParams = model.collections
    .map(coll => helpers.createCollectionJoinParameters(
        model.mapId,
        `${model.viewId}-core`,
        coll.mapId,
        coll.viewId
    ));


  // Remove any null param sets
  const joinParams = assocJoinParams.concat(collJoinParams).filter(p => !!p);

  // Attach the join to the query Object
  queryObj = helpers.attachJoins(queryObj, joinParams);

  queryObj = helpers.applyWhereClauses(queryObj, wClauses.filter(clause => !clause.core));

  if (sortAttr && sortDir) {
    queryObj = queryObj.orderBy(`${model.viewId}-core.${sortAttr}`, sortDir);
  }

  return queryObj;
}

module.exports = constructQuery;

// Export these for unit testing
module.exports._addCollectionSelects = addCollectionSelects;
module.exports._addAssociationSelects = addAssociationSelects;
module.exports._constructSelects = constructSelects;
module.exports._constructSubQuery = constructSubQuery;
