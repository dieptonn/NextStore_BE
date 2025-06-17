const Order = require('../../models/Order')
const Cart = require('../../models/Cart');

const getOrder = async (req, res) => {
    try {
        const orders = req.body;
        const order = await Order.findOne({orderId: orders.userId});

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

const createOrderAfterPayment = async (req, res) => {
    try {
        const {userId, paymentDetails} = req.body;

        if (!userId || !paymentDetails) {
            return res.status(400).json({status: 'error', message: 'Thiếu userId hoặc paymentDetails'});
        }

        // 1. Lấy giỏ hàng hiện tại của người dùng
        const userCart = await Cart.findOne({userId: userId});

        if (!userCart || userCart.items.length === 0) {
            return res.status(404).json({status: 'error', message: 'Không tìm thấy giỏ hàng hoặc giỏ hàng trống'});
        }

        // 2. Tạo một đơn hàng mới từ thông tin giỏ hàng
        const newOrder = new Order({
            userId: userId,
            items: userCart.items, // Sao chép toàn bộ sản phẩm từ giỏ hàng
            total_price: userCart.total_price, // Lấy tổng giá từ giỏ hàng
            address: paymentDetails.purchase_units[0].shipping.address.address_line_1, // Lấy địa chỉ từ PayPal
            status: 'completed', // Trạng thái đơn hàng đã hoàn thành
            payment_status: 'paid', // Trạng thái thanh toán đã trả
            payment_method: 'paypal', // Thêm phương thức thanh toán
            transactionId: paymentDetails.id // Lưu ID giao dịch của PayPal
        });

        await newOrder.save();

        // 3. Xóa giỏ hàng của người dùng sau khi đã tạo đơn hàng thành công
        await Cart.deleteOne({userId: userId});

        return res.status(201).json({
            status: 'success',
            message: 'Đơn hàng đã được tạo và giỏ hàng đã được xóa thành công',
            data: newOrder
        });

    } catch (error) {
        console.error('Lỗi khi tạo đơn hàng sau thanh toán:', error);
        return res.status(500).json({
            status: 'error',
            message: 'Lỗi server khi xử lý đơn hàng',
            error: error.message
        });
    }
};

const getAllOrders = async (req, res) => {
    try {
        // Sắp xếp theo ngày tạo mới nhất (createdAt: -1)
        const allOrders = await Order.find({}).sort({createdAt: -1});

        if (!allOrders || allOrders.length === 0) {
            return res.status(200).json({
                status: 'success',
                message: 'Không có đơn hàng nào.',
                data: []
            });
        }

        return res.status(200).json({
            status: 'success',
            data: allOrders
        });
    } catch (error) {
        console.error('Lỗi khi lấy tất cả đơn hàng:', error);
        return res.status(500).json({
            status: 'error',
            message: 'Lỗi server khi lấy danh sách đơn hàng.',
            error: error.message
        });
    }
};

module.exports = {getOrder, createNewOrder, createOrderAfterPayment, getAllOrders}