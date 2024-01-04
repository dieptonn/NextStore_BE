const WashingMachine = require('../../models/WashingMachine');
const ProductDetail = require('../../models/ProductDetail');


const showProduct = async (req, res) => {
    try {
        const data = await WashingMachine.find({});
        return res.status(200).json({
            status: 'success',
            data: data
        })
    } catch (error) {
        return res.status(500).json({ error: 'Internal Server Error' });
    }
};

const showProductDetail = async (req, res) => {
    try {
        const productName = req.query.productName;
        // console.log(productName);
        // const productName = 'casper-inverter-8-kg-wf-8vg1';

        const product = await WashingMachine.findOne({ slug: productName });
        if (!product) {
            return res.status(404).json({ error: 'Product not found' });
        }

        const productDetails = await ProductDetail.find({ PD_id: product.PD_id });

        return res.status(200).json({
            status: 'success',
            data: productDetails
        })
    } catch (error) {
        res.status(500).json({ error: 'Internal Server Error' });
    }
}

module.exports = { showProduct, showProductDetail };
