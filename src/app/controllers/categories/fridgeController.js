const Fridge = require('../../models/Fridge');

const showProduct = async (req, res) => {
    try {
        const data = await Fridge.find({});
        return res.status(200).json({
            status: 'success',
            data: data
        })
    } catch (error) {
        return res.send(
            'No data found'
        );
    }
};

module.exports = { showProduct };
