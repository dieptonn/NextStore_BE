const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const PaymentSchema = new Schema(
    {
        orderId: {
            type: Schema.Types.ObjectId,
            ref: 'Order',
            required: true,
        },
        amount: {
            type: String,
            required: true,
        },
        method: {
            type: String,
            required: true,
        },
        transactionId: {
            type: String,
            required: true,
        },
        status: {
            type: String,
            enum: ['pending', 'completed', 'failed'],
            default: 'pending',
            required: true,
        },
    },
    {
        timestamps: true,
    }
);

module.exports = mongoose.model('Payment', PaymentSchema);
