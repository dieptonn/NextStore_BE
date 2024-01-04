const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const slug = require('mongoose-slug-updater');
mongoose.plugin(slug);
// const mongooseDelete = require('mongoose-delete');

const WashingMachineSchema = new Schema(
    {
        PD_id: {
            type: Number,
            required: [true],
            trim: true,
        },
        name: {
            type: String,
            maxLength: 255,
            required: [true],
            trim: true,
        },
        size: {
            type: String,
            maxLength: 255,
            trim: true,
        },
        resolution: {
            type: String,
            maxLength: 255,
            trim: true,
        },
        price_old: {
            type: String,
            maxLength: 255,
            trim: true,
        },
        discount: {
            type: String,
            maxLength: 255,
            trim: true,
        },
        price_sale: {
            type: String,
            maxLength: 255,
            trim: true,
        },
        rating: {
            type: String,
            maxLength: 255,
            trim: true,
        },
        rating_number: {
            type: String,
            maxLength: 255,
            trim: true,
        },
        product_img: {
            type: String,
            maxLength: 255,
            trim: true,
        },
        slug: {
            type: String,
            slug: 'name', // Chọn trường để tạo slug từ đó
            unique: true,
        },
    },
    {
        timestamps: true,
    },
);

module.exports = mongoose.model('WashingMachine', WashingMachineSchema);
