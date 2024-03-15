const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const GGUserSchema = new Schema({
    googleId: String,
    email: String,
    name: String
});

GGUserSchema.statics.findOrCreate = async function (conditions, doc) {
    try {
        let user = await this.findOne(conditions);
        if (!user) {
            user = await this.create(doc);
            console.error
        }
        return user;
    } catch (error) {
        throw error;
    }
};


module.exports = mongoose.model('GGUser', GGUserSchema);
