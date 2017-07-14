const mongoose = require('mongoose');
const Schema = mongoose.Schema;
// const ObjectId = Schema.ObjectId;

const lastUpdatedExecution = new Schema(
  {
    _id: Schema.Types.ObjectId,
    crawlerCustomId: String,
    startedAt: { type: Date },
    finishedAt: { type: Date },
    status: String
  });

const productSchema = new Schema({
  name: String,
  path: String,
  sku: String,
  productId: String,
  categoryId: String,
  price: String,
  currency: String,
  image: String,
  description: String,
  categories: [String],
  createdAt: { type: Date },
  updatedAt: { type: Date },
  lastUpdatedExecution: { lastUpdatedExecution }
});

module.exports = mongoose.model('products', productSchema);
