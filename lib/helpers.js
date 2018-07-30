
/**
 * Helper function to generate select strings.
 * @ignore
 */
const createRenamedSelectStatement = (view, attr, table) => `${view}.${attr} as ${table}_${attr}`;

/**
 * Helper function to generate select strings.
 * @ignore
 */
const createSelectStatement = (view, attr) => `${view}.${attr} as ${attr}`;

/**
 * Helper function to generate the params to leftJoin needed for an association.
 * @ignore
 */
const createAssociationJoinParameters =
    (identityView, join, joinView) => [joinView, `${joinView}.id`, `${identityView}.${join}`];

/**
 * Helper function to generate the params to leftJoin needed for a collection.
 * @ignore
 */
const createCollectionJoinParameters = (identity, identityView, joinView) =>
  [joinView, `${identityView}.id`, `${joinView}.${identity}`];

/**
 * Helper function to generate the params to leftJoin needed for an M-M collection.
 * @ignore
 */
const createCollectionJoinTableParameters = (identity, identityView, joinView) =>
  [joinView, `${identityView}.${identity}`, `${joinView}.id`];

/**
 * Applies all the sets of leftJoin parameters to the knex object.
 * @ignore
 */
const attachJoins = (queryObj, joinParams) =>
  joinParams.reduce(
    // This works as leftJoin returns the knex object again (chaining)
    (qo, params) => qo.leftJoin.apply(qo, params),
    queryObj
  );

/**
 * Applies all the sets of leftJoin parameters to the knex object.
 * @ignore
 */
const applyWhereClauses = (queryObj, whereClauses) =>
  whereClauses.reduce(
    // This works as where and whereIn return the knex object again (chaining)
    (qo, clause) => qo[clause.method].apply(qo, clause.params),
    queryObj
  );

module.exports = {
  attachJoins,
  applyWhereClauses,
  createAssociationJoinParameters,
  createCollectionJoinParameters,
  createCollectionJoinTableParameters,
  createRenamedSelectStatement,
  createSelectStatement
};
