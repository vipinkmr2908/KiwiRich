const mongoose = require('mongoose');
const {Schema, model} = mongoose

const DiseaseSchema = new Schema({
    name: String,
    description: String,
    doctor: {type: Schema.Types.ObjectId, ref: 'User'},
  }, {
    timestamps: true,
  });

const DiseaseModel = model('Disease', DiseaseSchema);

module.exports = DiseaseModel;
