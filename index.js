'use strict';
const joinjs = require('join-js').default;
const _ = require('lodash');

const preProcessModels = require('./lib/preProcessModels');
const constructQuery = require('./lib/constructQuery');

/**
 * Factory function for adding our own "populate" syntax to knex
 */
function KnexJoins(models, knex) {
  this.knex = knex;
  this.models = models;
  return this;
};

module.exports = KnexJoins;

KnexJoins.prototype.applyViews = function (views) {
  this.processedModels = preProcessModels(this.models, views);
};

/**
 *
 * @param {String} modelId
 */
KnexJoins.prototype.selectModel = function (modelId) {
  return new PreparedQuery(modelId, this.processedModels, this.knex);
};


function PreparedQuery(modelId, models, knex) {

  this.models = _.cloneDeep(models);
  this.knex = knex;
  this.modelId = modelId;
  this.populated = [];

  this.originalModel = this.models.find(model => model.mapId === modelId);
  if (!this.originalModel) {
    throw new Error(`Invalid model ID ${modelId}`);
  }

  return this;
}


PreparedQuery.prototype.doJoin = function (res) {
  
  // Manipulate the models being passed into join-js to un-populate the collections/associations of
  // associations/collections
  this.models = this.models.map(model => {
    const assocFound = this.originalModel.associations.find(assoc => assoc.mapId === model.mapId);
    const collFound = this.originalModel.collections.find(coll => coll.mapId === model.mapId);
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
  let joined = joinjs.map(res, this.models, this.modelId);

  // Simplify the collections that shouldnt be populated
  this.modifiedModel.collections.forEach(coll => {
    if (!coll.populate) {
      joined = joined.map(nested => {
        nested[coll.name] = nested[coll.name].map(c => c.id);
        return nested;
      });
    }
  });

  return joined;
};

PreparedQuery.prototype.populate = function (name) {

  this.populated.push(name);
  // Chainable
  return this;
};

PreparedQuery.prototype.prepareJoins = function () {
  
  this.nonPopulated = [];

  // Note that we don't want to modify the original model
  this.modifiedModel = {
    mapId: this.originalModel.mapId,
    viewId: this.originalModel.viewId,
    idProperty: this.originalModel.idProperty,
    properties: this.originalModel.properties,

    // Filter out an
    associations: this.originalModel.associations.map(assoc => {
      assoc.populate = !!this.populated.find(name => name === assoc.name);
      return assoc;
    }),
    collections: this.originalModel.collections.map(coll => {
      coll.populate = !!this.populated.find(name => name === coll.name);
      return coll;
    })
  };

  // Return the knex object so other things can be added
  return constructQuery(this.models, this.modifiedModel, this.knex);
};
