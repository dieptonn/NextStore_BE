const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const { ObjectId } = mongoose.Schema.Types;


const ProductDetailsSchema = new Schema(
    {
        PD_id: {
            type: Number,
            // ref: 'WashingMachine',
            required: [true],
        },
        name: {
            type: String,
            maxLength: 255,
            required: [true],
            trim: true,
        },
        description: {
            type: String,
            maxLength: 2000,
            trim: true,
        },
        brand: {
            Type: { type: String, trim: true },
            name: [
                {
                    type: String,
                    maxLength: 255,
                    trim: true,
                    required: [true],
                }
            ],

        },
        product_description: {
            type: String,
            maxLength: 5000,
            trim: true,
        },
        image: [
            {
                type: [String],
                maxLength: 255,
                trim: true,
            }
        ],
        additionalProperty: [
            {
                Type: { type: String, trim: true },
                name: {
                    type: String,
                    maxLength: 255,
                    trim: true,
                },
                value: {
                    type: String,
                    maxLength: 255,
                    trim: true,
                },
            }
        ],
        offers: {
            Type: { type: String, trim: true },
            url: {
                type: String,
                maxLength: 255,
                trim: true,
            },
            priceCurrency: {
                type: String,
                maxLength: 255,
                trim: true,
            },
            price: {
                type: Number,
            },
            priceValidUntil: {
                type: String,
            },
        },

    },
    {
        timestamps: true,
    }
);

module.exports = mongoose.model('ProductDetail', ProductDetailsSchema);
