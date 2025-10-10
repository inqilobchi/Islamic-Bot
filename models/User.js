const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  telegramId: { type: String, required: true, unique: true },
  name: String,
  username: String,
  region: String, // hudud kaliti: masalan, 'toshkent', 'namangan'...
  duaTime: String // HH:mm formatda: masalan, "08:00"
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);
