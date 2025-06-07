const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const slug = require('mongoose-slug-updater');
mongoose.plugin(slug);
// const mongooseDelete = require('mongoose-delete');

const CartSchema = new Schema(
    {
        userId: {
            type: Number,
            unique: true,
            required: true,
        },
        items: [
            {
                PD_id: {
                    type: Number,
                    // unique: true,
                    required: true
                },
                name: {
                    type: String,
                    maxLength: 255,
                    trim: true,
                },
                product_img: {
                    type: String,
                    maxLength: 255,
                    trim: true,
                },
                quantity: {
                    type: Number,
                    required: true
                },
                price: {
                    type: String,
                    required: true,
                    maxLength: 255,
                },
                other_details: {
                    brand: {
                        type: String,
                        maxLength: 255,
                        trim: true,
                    },
                    type: {
                        type: String,
                        maxLength: 255,
                        trim: true,
                    }
                }
            }
        ],
        total_price: {
            type: String,
            required: true,
            maxLength: 255,
        },
        status: {
            type: String,
            enum: ['active', 'unactive', 'cancelled'],
            default: 'active',
            maxLength: 10,
        }
    },
    {
        timestamps: true,
    },
);

module.exports = mongoose.model('Cart', CartSchema);
