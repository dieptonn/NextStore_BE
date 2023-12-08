const Fryer = require('../../models/Fryer');

const showProduct = async (req, res) => {
    try {
        const data = await Fryer.find({});
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
