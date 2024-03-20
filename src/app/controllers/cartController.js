const Cart = require('../models/Cart');

const getCart = async (req, res) => {
    try {
        const orders = req.body;
        const userCart = await Cart.findOne({ userId: orders.userId });

        if (!userCart) {
            return res.status(200).json({
                status: 'success',
                data: 'Cart is empty!'
            });
        }

        return res.status(200).json({
            status: 'success',
            data: userCart
        });
    } catch (error) {
        return res.status(500).json({
            err: -1,
            msg: 'Fail at cart controller ' + error
        });
    }
};

const addToCart = async (req, res) => {
    try {
        const orders = req.body;
        const userCart = await Cart.findOne({ userId: orders.userId });

        if (userCart) {
            const existingItemIndex = userCart.items.findIndex(item => item.PD_id === orders.Pd_id);

            if (existingItemIndex !== -1) {
                // Nếu sản phẩm đã tồn tại trong giỏ hàng
                userCart.items[existingItemIndex].quantity += orders.quantity;

                // Chuyển đổi giá trị từ string sang số và cập nhật tổng giá của giỏ hàng
                userCart.total_price = parseFloat(userCart.total_price) + parseFloat(orders.quantity) * parseFloat(orders.price);

                // Lưu lại giỏ hàng đã cập nhật
                await userCart.save();

                return res.status(200).json({
                    status: 'success',
                    data: userCart
                });
            } else {
                // Nếu sản phẩm chưa tồn tại trong giỏ hàng
                userCart.items.push({
                    PD_id: orders.Pd_id,
                    name: orders.name,
                    quantity: orders.quantity,
                    price: orders.price,
                    other_details: orders.other_details
                });

                // Chuyển đổi giá trị từ string sang số và cập nhật tổng giá của giỏ hàng
                userCart.total_price = parseFloat(userCart.total_price) + parseFloat(orders.quantity) * parseFloat(orders.price);

                // Lưu lại giỏ hàng đã cập nhật
                await userCart.save();

                return res.status(200).json({
                    status: 'success',
                    data: userCart
                });
            }
        } else {
            // Nếu giỏ hàng của người dùng chưa tồn tại
            const newCart = new Cart({
                userId: orders.userId,
                items: [{
                    PD_id: orders.Pd_id,
                    name: orders.name,
                    quantity: orders.quantity,
                    price: orders.price,
                    other_details: orders.other_details
                }],
                total_price: parseFloat(orders.quantity) * parseFloat(orders.price),
                status: 'active'
            });

            // Lưu giỏ hàng mới vào cơ sở dữ liệu
            await newCart.save();

            return res.status(200).json({
                status: 'success',
                data: newCart
            });
        }
    } catch (error) {
        return res.status(500).json({
            err: -1,
            msg: 'Fail at cart controller ' + error
        });
    }
};

module.exports = { getCart, addToCart };
