const elasticsearchClient = require('../../services/elasticSearch');

const Air = require('../models/Air');
const Cooker = require('../models/Cooker');
const Freezer = require('../models/Freezer');
const Fridge = require('../models/Fridge');
const Fryer = require('../models/Fryer');
const Robot = require('../models/Robot');
const Television = require('../models/Television');
const WashingMachine = require('../models/WashingMachine');
const WaterHeater = require('../models/WaterHeater');
const Rating = require('../models/Rating');

const { spawn } = require('child_process');


const showProduct = async (req, res) => {
    try {
        // Lấy tất cả dữ liệu từ các collection
        const allData = await Promise.all([
            Air.find({}),
            Cooker.find({}),
            Freezer.find({}),
            Fridge.find({}),
            Fryer.find({}),
            Robot.find({}),
            Television.find({}),
            WashingMachine.find({}),
            WaterHeater.find({}),

        ]);

        const ratings = await Rating.find({})

        // Gộp tất cả dữ liệu vào một mảng
        const concatenatedData = allData.flat();

        // Chuyển đổi mảng thành đối tượng JSON
        const PDs_json = concatenatedData.map(doc => doc.toJSON());
        const ratings_json = ratings.map(doc => doc.toJSON());


        // Chuyển đổi đối tượng JSON thành chuỗi và truyền cho quy trình Python
        const process = spawn('python', [
            'D:/Code/NodeJs/NextStore/src/data/rs.py',
        ]);

        // Ghi dữ liệu JSON và userId vào stdin của quy trình Python
        process.stdin.write(JSON.stringify({ userId: req.query.userId, PDs_json: PDs_json, ratings_json: ratings_json }));
        process.stdin.end();

        process.stdout.on('data', function (data) {
            console.log(data.toString());
            res.send(data.toString());
        });
    } catch (error) {
        res.send('error: ' + error);
    }
};


const elasticSearch = async (req, res) => {
    const reqData = req.body;
    // console.log(reqData);
    try {
        const indexList = ['air', 'cooker', 'freezer', 'fridge', 'fryer', 'robot', 'television', 'washing_machine', 'water_heater']
        // Truy vấn Elasticsearch tim kiem tren toan bo field
        const body = await elasticsearchClient.client.search({
            index: indexList,
            body: {
                query: {
                    multi_match: {
                        query: reqData.query,
                        fields: ["*"], // Tìm kiếm trên tất cả các trường
                        fuzziness: "AUTO"
                    }
                },
                size: 80
            }
        });

        // Trả về kết quả từ Elasticsearch
        return res.status(200).json({
            status: 'success',
            data: body
        })
    } catch (error) {
        console.error('Error searching documents:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
};


const pipeLine = async (req, res) => {
    try {
        const data = await Cooker.find({}); // Truy vấn tất cả các tài liệu từ MongoDB

        const body = data.flatMap(doc => {
            const { _id, ...docWithoutId } = doc.toObject(); // Loại bỏ trường _id
            return [{ index: { _index: 'cooker', _type: '_doc', _id: doc._id.toString() } }, docWithoutId];
        });

        const response = await elasticsearchClient.client.bulk({ refresh: true, body });
        console.log(JSON.stringify(response, null, 2))

        if (response && response.body && response.body.errors) {
            const erroredDocuments = [];
            response.body.items.forEach((action, i) => {
                const operation = Object.keys(action)[0];
                if (action[operation].error) {
                    erroredDocuments.push({
                        index: i,
                        id: action[operation]._id,
                        error: action[operation].error
                    });
                }
            });
            console.log('Errored documents:', erroredDocuments);
            return res.status(500).json({ error: 'Internal server error' });
        } else {
            console.log('Bulk operation completed successfully.');
            return res.status(200).json({
                status: 'success',
                data: response.body
            })
        }
    } catch (error) {
        console.error('Error in pipeline:', error);
        return res.status(404).json({ error: 'Internal server error' });
    }

}




module.exports = { showProduct, elasticSearch, pipeLine };
