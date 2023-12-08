const Freezer = require('../../models/Freezer');

const showProduct = async (req, res) => {
    try {
        const data = await Freezer.find({});
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
