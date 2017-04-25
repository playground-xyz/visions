
/**
 * Helper function to generate select strings.
 */
const createRenamedSelectStatement = (view, attr, table) => `${view}.${attr} as ${table}_${attr}`;
const createSelectStatement = (view, attr) => `${view}.${attr} as ${attr}`;

/**
 * Helper function to generate the params to leftJoin needed for a collection.
 */
const createAssociationJoinParameters =
    (identityView, join, joinView) => [joinView, `${joinView}.id`, `${identityView}.${join}`];

const createCollectionJoinParameters =
    (identity, identityView, join, joinView) => [joinView, `${identityView}.id`, `${joinView}.${identity}`];

/**
 * Applies all the sets of leftJoin parameters to the knex object.
 */
const attachJoins = (queryObj, joinParams) =>
    joinParams.reduce(
        // This works as leftJoin returns the knex object again (chaining)
        (qo, params) => qo.leftJoin.apply(qo, params),
        queryObj
    );

/**
 * Applies all the sets of leftJoin parameters to the knex object.
 */
const applyWhereClauses = (queryObj, whereClauses) =>
    whereClauses.reduce(
        // This works as leftJoin returns the knex object again (chaining)
        (qo, clause) => qo[clause.method].apply(qo, clause.params),
        queryObj
    );

module.exports = {
  attachJoins,
  applyWhereClauses,
  createAssociationJoinParameters,
  createCollectionJoinParameters,
  createRenamedSelectStatement,
  createSelectStatement
};
