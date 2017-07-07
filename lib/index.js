const PreparedQuery = require('./PreparedQuery');
const preProcessModels = require('./preProcessModels');

/**
 * Factory class for generating queries for a set of views that are "overlayed"
 * over the model schema.
 */
class Visions {
  /**
   * @param {JoinJsMap} models - The complete schema of the database (using joinjs structure)
   * @param {KnexInstance} knex - A knex instance, configured for access to the database
   * @param {Object} views - A mapping from modelId to view
   */
  constructor(models, knex, views) {
    this.knex = knex;
    this.models = models;
    this.processedModels = preProcessModels(this.models, views);
  }

  /**
   * Creates a query object for the chosen model.
   *
   * @param {String} modelId - The model to query
   */
  generateQueryFor(modelId) {
    return new PreparedQuery(modelId, this.processedModels, this.knex);
  }

  /**
   * Returns the name of the view for the model. Used for constructing queries
   * directly with knex when they are beyond the scope of this wrapper to generate
   * effectively.
   *
   * @param {String} modelId - The modelId of the requested view name
   */
  getViewNameFor(modelId) {
    const model = this.processedModels.find(m => m.mapId === modelId);
    if (!model) {
      throw new Error(`Invalid modelId: ${modelId}`);
    }
    return model.viewId;
  }
}

module.exports = Visions;
