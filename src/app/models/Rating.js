const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const slug = require('mongoose-slug-updater');
mongoose.plugin(slug);
// const mongooseDelete = require('mongoose-delete');

const RatingSchema = new Schema(
    {
        PD_id: {
            type: Number,
            unique: true,
            index: true,
            required: true,
            default: 1
        },
        userId: {
            type: Number,
            maxLength: 255,
            required: [true],
            trim: true,
        },
        rating: {
            type: Number,
            maxLength: 255,
            trim: true,
        },
        timestamp: {
            type: Number,
            maxLength: 255,
            trim: true,

        },
    },
    {
        timestamps: true,
    },
);

module.exports = mongoose.model('Rating', RatingSchema);
