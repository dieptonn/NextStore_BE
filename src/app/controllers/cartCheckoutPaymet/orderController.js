const Order = require('../../models/Order')

const getOrder = async (req, res) => {
    try {
        const orders = req.body;
        const order = await Order.findOne({ orderId: orders.userId });

        if (!order) {
            return res.status(200).json({
                status: 'success',
                data: 'Cart is empty!'
            });
        }

        return res.status(200).json({
            status: 'success',
            data: order
        });
    } catch (error) {
        return res.status(500).json({
            err: -1,
            msg: 'Fail at cart controller ' + error
        });
    }
};

const createNewOrder = async (req, res) => {
    try {
        const orders = req.body;

        const newOrder = new Order({
            userId: orders.userId,
            items: [{
                PD_id: orders.Pd_id,
                name: orders.name,
                quantity: orders.quantity,
                price: orders.price,
                other_details: orders.other_details,
            }],
            voucher: orders.voucher,
            address: orders.address,
            shipping_fee: orders.shipping_fee,
            total_price: parseFloat(orders.quantity) * parseFloat(orders.price) + parseFloat(orders.shipping_fee),
        });

        await newOrder.save();

        return res.status(200).json({
            status: 'success',
            data: newCart
        });
    } catch (error) {
        return res.status(500).json({
            err: -1,
            msg: 'Fail at cart controller ' + error
        });
    }
};


module.exports = { getOrder, createNewOrder }