const monogoose = require('mongoose');
const {model} = require("mongoose");
const {Schema} = require('mongoose');

const UserSchema = new Schema({
    username: {type: String, required: true, min: 4, unique: true},
    password: {type: String, required: true},

});

const UserModel = model('User', UserSchema);

module.exports = UserModel;
