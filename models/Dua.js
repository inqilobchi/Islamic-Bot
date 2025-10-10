const mongoose = require('mongoose');

const duaSchema = new mongoose.Schema({
  image: String,
  caption: String,
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Dua', duaSchema);
