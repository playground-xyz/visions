const PreparedQuery = require('./lib/PreparedQuery');
const preProcessModels = require('./lib/preProcessModels');

/**
 * Factory class for generating queries for a set of views that are "overlayed"
 * over the schema of your model.
 *
 * @param {JoinJsMap} models - The complete schema of your database (using joinjs structure)
 * @param {KnexInstance} knex - A knex instance, configured for access to your database
 */
class KnexWrapper {
  constructor(models, knex) {
    this.knex = knex;
    this.models = models;
  }

  /**
   * Adds the names of the views to use for queries for each model.
   *
   * @param {Object} views - A mapping from modelId to view
   */
  applyViews(views) {
    this.processedModels = preProcessModels(this.models, views);
  }

  /**
   * Creates a query object for the chosen model.
   *
   * @param {String} modelId - The model to query
   */
  selectModel(modelId) {
    return new PreparedQuery(modelId, this.processedModels, this.knex);
  }

  /**
   * Returns the name of the view for the model. Used for constructing queries
   * directly with knex when they are beyond the scope of this wrapper to generate
   * effectively.
   *
   * @param {String} modelId - The modelId of the requested view name
   */
  getViewName(modelId) {
    const model = this.models.find(m => m.mapId === modelId);
    return model.viewId || model.modelId;
  }
}

module.exports = KnexWrapper;
