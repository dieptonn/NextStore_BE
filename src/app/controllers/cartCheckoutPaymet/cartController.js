const Cart = require('../../models/Cart');

const getCart = async (req, res) => {
    try {
        const orders = req.body;
        const userCart = await Cart.findOne({userId: orders.userId});

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
        const userCart = await Cart.findOne({userId: orders.userId});

        if (userCart) {
            const existingItemIndex = userCart.items.findIndex(item => item.PD_id === orders.PD_id);

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
                    PD_id: orders.PD_id,
                    name: orders.name,
                    quantity: orders.quantity,
                    price: orders.price,
                    other_details: orders.other_details
                });

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
                    PD_id: orders.PD_id,
                    name: orders.name,
                    quantity: orders.quantity,
                    price: orders.price,
                    other_details: orders.other_details
                }],
                total_price: parseFloat(orders.quantity) * parseFloat(orders.price),
                status: 'active'
            });

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

const updateCartItemQuantity = async (req, res) => {
    try {
        const {userId, PD_id, quantity} = req.body;

        const userCart = await Cart.findOne({userId});

        if (!userCart) {
            return res.status(404).json({
                status: 'error',
                msg: 'Cart not found for this user'
            });
        }

        const itemIndex = userCart.items.findIndex(item => item.PD_id === PD_id);

        if (itemIndex === -1) {
            return res.status(404).json({
                status: 'error',
                msg: 'Item not found in cart'
            });
        }

        // Cập nhật số lượng item
        userCart.items[itemIndex].quantity = quantity;

        // Nếu số lượng = 0 thì loại bỏ item đó khỏi mảng
        if (quantity === 0) {
            userCart.items.splice(itemIndex, 1);
        }

        // Nếu không còn sản phẩm nào trong giỏ hàng => xóa luôn document Cart
        if (userCart.items.length === 0) {
            await Cart.deleteOne({userId});
            return res.status(200).json({
                status: 'success',
                msg: 'Cart deleted because it is empty'
            });
        }

        // Cập nhật lại total_price
        userCart.total_price = userCart.items.reduce((total, item) => {
            return total + item.quantity * parseFloat(item.price);
        }, 0);

        await userCart.save();

        return res.status(200).json({
            status: 'success',
            data: userCart
        });
    } catch (error) {
        return res.status(500).json({
            err: -1,
            msg: 'Fail at updateCartItemQuantity: ' + error
        });
    }
};


module.exports = {getCart, addToCart, updateCartItemQuantity};
