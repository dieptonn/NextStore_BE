const { Parser } = require('json2csv');
const fs = require('fs');
const path = require('path'); // Import path module

const Air = require('../models/Air');
const Cooker = require('../models/Cooker');
const Freezer = require('../models/Freezer');
const Fridge = require('../models/Fridge');
const Fryer = require('../models/Fryer');
const Robot = require('../models/Robot');
const Television = require('../models/Television');
const WashingMachine = require('../models/WashingMachine');
const WaterHeater = require('../models/WaterHeater');

async function priceExtraction(req, res) {
    try {
        const airData = await Air.find({}, 'PD_id price_sale rating');
        const cookerData = await Cooker.find({}, 'PD_id price_sale rating');
        const freezerData = await Freezer.find({}, 'PD_id price_sale rating');
        const fridgeData = await Fridge.find({}, 'PD_id price_sale rating');
        const fryerData = await Fryer.find({}, 'PD_id price_sale rating');
        const robotData = await Robot.find({}, 'PD_id price_sale rating');
        const televisionData = await Television.find({}, 'PD_id price_sale rating');
        const washingMachineData = await WashingMachine.find({}, 'PD_id price_sale rating');
        const waterHeaterData = await WaterHeater.find({}, 'PD_id price_sale rating');

        let allData = [
            ...airData,
            ...cookerData,
            ...freezerData,
            ...fridgeData,
            ...fryerData,
            ...robotData,
            ...televisionData,
            ...washingMachineData,
            ...waterHeaterData
        ];


        // Filter out records with empty values for PD_id, price_sale, or rating
        allData = allData.filter(item =>
            item.PD_id !== '' &&
            item.price_sale !== '' &&
            item.rating !== ''
        );

        // Convert JSON to CSV with price_sale and rating renamed
        const json2csvParser = new Parser({
            fields: [
                'PD_id',
                { label: 'price', value: 'price_sale' },
                { label: 'rating', value: 'rating' }
            ]
        });
        const csv = json2csvParser.parse(allData);

        // Set file path
        const filePath = path.join(__dirname, '../../data', 'data.csv');

        // Write CSV to file
        fs.writeFileSync(filePath, csv);

        // Send file as attachment
        res.download(filePath, 'data.csv', (err) => {
            // Delete file after sending
            // fs.unlinkSync(filePath);
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Internal server error" });
    }
}

module.exports = {
    priceExtraction
};
