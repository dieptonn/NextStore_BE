const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const OrderSchema = new Schema(
    {
        userId: {
            type: Number,
            required: true,
        },
        items: [
            {
                PD_id: {
                    type: Number,
                    required: true
                },
                name: {
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
        voucher: {
            type: String,
            default: 'none',
            maxLength: 255,
        },
        shipping_fee: {
            type: String,
            maxLength: 255,
        },
        status: {
            type: String,
            enum: ['pending', 'completed', 'cancelled'],
            default: 'pending',
            maxLength: 10,
        },
        payment_status: {
            type: String,
            enum: ['paid', 'unpaid'],
            default: 'unpaid',
            maxLength: 10,
        }
    },
    {
        timestamps: true,
    }
);

module.exports = mongoose.model('Order', OrderSchema);
