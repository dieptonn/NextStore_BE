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
const modelMap = {
    airs: Air,
    cookers: Cooker,
    freezers: Freezer,
    fridges: Fridge,
    fryers: Fryer,
    robots: Robot,
    televisions: Television,
    washingmachines: WashingMachine,
    waterheaters: WaterHeater,
};

// Controller function để thêm sản phẩm mới
const addProductToCategory = async (req, res) => {
    const {categorySlug} = req.params; // Lấy categorySlug từ params của route
    const productData = req.body;

    // Lấy Model tương ứng dựa trên categorySlug
    const ProductModel = modelMap[categorySlug.toLowerCase()];

    if (!ProductModel) {
        return res.status(400).json({
            status: 'error',
            message: `Invalid category: ${categorySlug}`,
        });
    }

    try {
        // Xử lý PD_id: Tìm PD_id lớn nhất hiện tại và +1
        const lastProduct = await ProductModel.findOne().sort({PD_id: -1}).exec();
        let nextPD_id = 1;
        if (lastProduct && typeof lastProduct.PD_id === 'number') {
            nextPD_id = lastProduct.PD_id + 1;
        }

        // Tạo sản phẩm mới với PD_id đã được tính toán
        // Slug sẽ được mongoose-slug-updater tự động tạo dựa trên trường 'name'
        const newProduct = new ProductModel({
            ...productData,
            PD_id: nextPD_id,
        });

        const savedProduct = await newProduct.save();

        res.status(201).json({
            status: 'success',
            message: 'Product added successfully!',
            data: savedProduct,
        });
    } catch (error) {
        console.error(`Error adding product to ${categorySlug}:`, error);
        if (error.name === 'ValidationError') {
            const messages = []; // Khởi tạo mảng rỗng
            for (const field in error.errors) {
                // Kiểm tra xem error.errors[field] có tồn tại và có thuộc tính 'message' là string không
                if (error.errors[field] && error.errors[field].message && typeof error.errors[field].message === 'string') {
                    messages.push(error.errors[field].message);
                }
            }
            return res.status(400).json({
                status: 'error',
                message: 'Validation failed.',
                errors: messages.length > 0 ? messages : ['An unknown validation error occurred.'],
            });
        }
        if (error.code === 11000) {
            return res.status(409).json({
                status: 'error',
                message: 'Duplicate key error. A product with similar unique fields might already exist.',
                // field: error.keyValue (có thể thêm để debug)
            });
        }
        res.status(500).json({
            status: 'error',
            message: 'Failed to add product.',
            error: error.message,
        });
    }
};

// (Optional) Controller function để lấy sản phẩm (nếu bạn muốn tách logic ra khỏi file route)
const getProductsByCategory = async (req, res) => {
    const {categorySlug} = req.params;
    const ProductModel = modelMap[categorySlug.toLowerCase()];

    if (!ProductModel) {
        return res.status(404).json({
            status: 'error',
            message: `Category '${categorySlug}' not found.`,
        });
    }

    try {
        const products = await ProductModel.find({});
        res.status(200).json({
            status: 'success',
            data: products,
        });
    } catch (error) {
        console.error(`Error fetching products for ${categorySlug}:`, error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to fetch products.',
            error: error.message,
        });
    }
};

const updateProductInCategory = async (req, res) => {
    const {categorySlug, productId} = req.params;
    const updateData = req.body;
    const ProductModel = modelMap[categorySlug.toLowerCase()];

    if (!ProductModel) {
        return res.status(400).json({status: 'error', message: `Invalid category: ${categorySlug}`});
    }
    
    if (updateData._id) delete updateData._id;
    if (updateData.PD_id) delete updateData.PD_id;


    try {
        const updatedProduct = await ProductModel.findByIdAndUpdate(
            productId,
            updateData,
            {
                new: true, // Trả về document đã được cập nhật
                runValidators: true, // Chạy Mongoose validators khi cập nhật
            }
        ).exec();

        if (!updatedProduct) {
            return res.status(404).json({
                status: 'error',
                message: `Product with ID '${productId}' not found in category '${categorySlug}'.`,
            });
        }

        res.status(200).json({
            status: 'success',
            message: 'Product updated successfully!',
            data: updatedProduct,
        });
    } catch (error) {
        console.error(`Error updating product ${productId} in ${categorySlug}:`, error);
        if (error.name === 'ValidationError') {
            const errorObjects = Object.values(error.errors);
            const messages = errorObjects
                .filter(errObj => errObj && errObj.message && typeof errObj.message === 'string')
                .map(errObj => errObj.message);
            return res.status(400).json({
                status: 'error',
                message: 'Validation failed.',
                errors: messages.length > 0 ? messages : ['An unknown validation error occurred.']
            });
        }
        if (error.code === 11000) { // Lỗi duplicate key, ví dụ nếu cố đổi 'name' thành một cái đã có slug
            return res.status(409).json({
                status: 'error',
                message: 'Update failed due to duplicate key error (e.g., slug already exists for the new name).'
            });
        }
        res.status(500).json({
            status: 'error',
            message: 'Failed to update product.',
            error: error.message,
        });
    }
};

const deleteProductInCategory = async (req, res) => {
    const {categorySlug, productId} = req.params;
    const ProductModel = modelMap[categorySlug.toLowerCase()];

    if (!ProductModel) {
        return res.status(400).json({status: 'error', message: `Invalid category: ${categorySlug}`});
    }

    try {
        const deletedProduct = await ProductModel.findByIdAndDelete(productId).exec();

        if (!deletedProduct) {
            return res.status(404).json({
                status: 'error',
                message: `Product with ID '${productId}' not found in category '${categorySlug}'.`,
            });
        }

        res.status(200).json({ // Hoặc 204 No Content nếu không muốn trả về body
            status: 'success',
            message: 'Product deleted successfully!',
            data: deletedProduct, // Có thể trả về sản phẩm đã xóa hoặc chỉ là message
        });
    } catch (error) {
        console.error(`Error deleting product ${productId} in ${categorySlug}:`, error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to delete product.',
            error: error.message,
        });
    }
};


module.exports = {
    addProductToCategory,
    getProductsByCategory,
    updateProductInCategory,
    deleteProductInCategory,
    getHotProductData
};