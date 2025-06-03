const WashingMachine = require('../models/WashingMachine');

const modelMap = {
    WashingMachine,
};

const sort = async (req, res) => {
    try {
        const rawMaxPrice = req.body.maxPrice || '0';
        const categoryName = req.body.category;

        const maxPrice = parseInt(rawMaxPrice.replace(/[.,]/g, ''), 10);

        if (isNaN(maxPrice)) {
            return res.status(400).json({error: 'Giá tiền không hợp lệ'});
        }

        const Model = modelMap[categoryName];
        if (!Model) {
            return res.status(400).json({error: 'Loại sản phẩm không hợp lệ'});
        }

        // Lấy các bản ghi có sale_price <= maxPrice
        const items = await Model.find().lean();

        // Convert sale_price từ string -> number, lọc và sắp xếp
        const filteredItems = items
            .map(item => ({
                ...item,
                sale_price_number: parseInt((item.price_sale || '0').replace(/[.,]/g, ''), 10)
            }))
            .filter(item => !isNaN(item.sale_price_number) && item.sale_price_number <= maxPrice)
            .sort((a, b) => a.sale_price_number - b.sale_price_number);

        res.json(filteredItems);
    } catch (err) {
        console.error(err);
        res.status(500).json({error: 'Lỗi máy chủ'});
    }
};


module.exports = {sort};