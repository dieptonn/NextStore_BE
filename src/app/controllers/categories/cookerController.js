const Cooker = require('../../models/Cooker');

const showProduct = async (req, res) => {
    try {
        const data = await Cooker.find({});
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
