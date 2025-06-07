const getAll = async (req, res) => {
    try {
        const categories = [
            'Air',
            'Cooker',
            'Freezer',
            'Fridge',
            'Fryer',
            'Robot',
            'Television',
            'WashingMachine',
            'WaterHeater'
        ];

        return res.status(200).json({
            status: 'success',
            data: categories
        });

    } catch (error) {
        return res.status(500).json({
            status: 'error',
            message: 'Đã xảy ra lỗi khi lấy danh sách danh mục',
            error: error.message
        });
    }
};

module.exports = {
    getAll
};
