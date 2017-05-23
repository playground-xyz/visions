const constructQuery = require('./constructQuery');
const doJoins = require('./doJoins');

/**
 * Object that presents a simple interface for constructing queries for a
 * relational database using a model map object describing the connections
 * between models.
 *
 * @method populate
 * @method where
 * @method skip
 * @method limit
 * @method sort
 * @method exec
 *
 */
function PreparedQuery(modelId, models, knex) {

  // This is safe as the models object is serialisable
  this.models = JSON.parse(JSON.stringify((models)));

  this.knex = knex;
  this.modelId = modelId;
  this.populated = [];
  this.whereClauses = [];

  this.originalModel = this.models.find(model => model.mapId === modelId);
  if (!this.originalModel) {
    throw new Error(`Invalid model ID ${modelId}`);
  }

  return this;
}

PreparedQuery.prototype.populate = function populate(name) {
  this.populated.push(name);
  // Chainable
  return this;
};

PreparedQuery.prototype.skip = function skip(value) {
  this._skip = value;

  // Chainable
  return this;
};

PreparedQuery.prototype.limit = function limit(value) {
  this._limit = value;

  // Chainable
  return this;
};

PreparedQuery.prototype.where = function where(clauses) {
  if (!clauses || clauses.length === 0) {
    return this;
  }

  // Allow a single where clause to be passed in
  if (!Array.isArray(clauses)) {
    clauses = [clauses];
  }

  // Validate the input structure
  clauses.forEach(clause => {
    if (!clause.key) {
      throw new Error(`Where clause missing key: ${clause}`);
    }
    if ((clause.value === undefined) && !Array.isArray(clause.values)) {
      throw new Error(`Where clause missing a value or values (array): ${clause}`);
    }
  });

  this.whereClauses = this.whereClauses.concat(clauses);

  // Chainable
  return this;
};

PreparedQuery.prototype.sort = function sort(attr, dir) {
  this.sortAttr = attr;
  this.sortDir = dir;

  // Chainable
  return this;
};

PreparedQuery.prototype.exec = function exec() {

  this.nonPopulated = [];

  // Note that we don't want to modify the original model
  this.modifiedModel = {
    mapId: this.originalModel.mapId,
    viewId: this.originalModel.viewId,
    idProperty: this.originalModel.idProperty,
    properties: this.originalModel.properties,

    // Add a flag to determine which connections will need populating
    associations: this.originalModel.associations.map(assoc => {
      assoc.populate = !!this.populated.find(name => name === assoc.name);
      return assoc;
    }),
    collections: this.originalModel.collections.map(coll => {
      coll.populate = !!this.populated.find(name => name === coll.name);
      return coll;
    })
  };

  // Construct the query, run it and convert it to a nested object
  return constructQuery(
      this.models,
      this.modifiedModel,
      this.knex,
      this.whereClauses,
      this.sortAttr,
      this.sortDir,
      this._limit,
      this._skip
  ).then(data => doJoins(
      data,
      this.models,
      this.originalModel,
      this.modifiedModel
  ));
};

module.exports = PreparedQuery;
