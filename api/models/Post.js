const mongoose = require('mongoose');
const { Schema, model } = mongoose;

const PostSchema = new Schema({
  title: String,
  summary: String,
  content: String,
  cover: Buffer, // Change this to Buffer to store image data
  author: { type: Schema.Types.ObjectId, ref: 'User' },
  tags: [{ type: String }],
}, {
  timestamps: true,
});

const PostModel = model('Post', PostSchema);

module.exports = PostModel;