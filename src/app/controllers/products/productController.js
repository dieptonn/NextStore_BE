const Air = require('../../models/Air');
const Cooker = require('../../models/Cooker');
const Freezer = require('../../models/Freezer');
const Fridge = require('../../models/Fridge');
const Fryer = require('../../models/Fryer');
const Robot = require('../../models/Robot');
const Television = require('../../models/Television');
const WashingMachine = require('../../models/WashingMachine');
const WaterHeater = require('../../models/WaterHeater');

const getHotProductData = async (req, res) => {
    try {
        const models = [
            Air,
            Cooker,
            Freezer,
            Fridge,
            Fryer,
            Robot,
            Television,
            WashingMachine,
            WaterHeater
        ];

        const allProducts = (await Promise.all(models.map(model => model.find({})))).flat();

        // Convert rating thành số và tìm giá trị lớn nhất
        const allRatings = allProducts
            .map(product => parseFloat(product.rating))
            .filter(r => !isNaN(r));

        if (allRatings.length === 0) {
            return res.status(200).json({status: 'success', data: []});
        }

        const maxRating = Math.max(...allRatings);

        const topRatedProducts = allProducts.filter(p => parseFloat(p.rating) === maxRating);

        // 8 sản phẩm random
        const shuffled = topRatedProducts.sort(() => 0.5 - Math.random());
        const selected = shuffled.slice(0, 8);

        res.status(200).json({
            status: 'success',
            data: selected
        });

    } catch (error) {
        console.error('Error in getHotProductData:', error);
        res.status(500).json({status: 'error', message: 'Internal server error'});
    }
};

module.exports = {getHotProductData};