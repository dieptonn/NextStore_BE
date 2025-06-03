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

const {spawn} = require('child_process');


const showProduct = async (req, res) => {
    
    try {
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

        const ratings = await Rating.find({});

        // Gộp tất cả dữ liệu vào một mảng
        const concatenatedData = allData.flat();
        const PDs_json = concatenatedData.map(doc => doc.toJSON());
        const ratings_json = ratings.map(doc => doc.toJSON());

        // Gọi quy trình Python để lấy kết quả gợi ý
        const process = spawn('python', [
            'D:/Code/NodeJs/NextStore/src/data/rs.py',
        ]);

        // Thu thập output từ quy trình Python
        let resultData = '';
        process.stdout.on('data', (data) => {
            resultData += data.toString();
        });

        process.stdout.on('end', async () => {
            // Parse output từ Python thành JSON
            let recResponse;
            try {
                recResponse = JSON.parse(resultData);
            } catch (error) {
                return res.status(500).json({error: 'Lỗi parse dữ liệu từ Python: ' + error.message});
            }
            const {PD_bought, recommendations} = recResponse;

            // Danh sách các model cần truy vấn
            const models = [Air, Cooker, Freezer, Fridge, Fryer, Robot, Television, WashingMachine, WaterHeater];

            // Hàm helper tìm sản phẩm theo tên qua các model đã cho
            const findProductByName = async (name) => {
                for (let model of models) {
                    const found = await model.findOne({name: name});
                    if (found) return found.toJSON();
                }
                return null;
            };

            // Tìm sản phẩm đã mua (PD_bought)
            const boughtProduct = await findProductByName(PD_bought);

            // Duyệt qua mảng recommendations để tìm các sản phẩm tương ứng
            const recommendedProducts = [];
            for (let recName of recommendations) {
                const product = await findProductByName(recName);
                if (product) {
                    recommendedProducts.push(product);
                }
            }

            return res.status(200).json({
                status: 'success',
                PD_bought: boughtProduct,
                recommendations: recommendedProducts,
            });
        });

        // Ghi dữ liệu JSON và userId vào stdin của quy trình Python
        process.stdin.write(JSON.stringify({userId: req.query.userId, PDs_json: PDs_json, ratings_json: ratings_json}));
        process.stdin.end();

        process.stderr.on('data', (data) => {
            console.error('Python error:', data.toString());
        });
    } catch (error) {
        return res.status(500).send('error: ' + error);
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
        return res.status(500).json({error: 'Internal server error'});
    }
};


const pipeLine = async (req, res) => {
    try {
        const data = await Cooker.find({}); // Truy vấn tất cả các tài liệu từ MongoDB

        const body = data.flatMap(doc => {
            const {_id, ...docWithoutId} = doc.toObject(); // Loại bỏ trường _id
            return [{index: {_index: 'cooker', _type: '_doc', _id: doc._id.toString()}}, docWithoutId];
        });

        const response = await elasticsearchClient.client.bulk({refresh: true, body});
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
            return res.status(500).json({error: 'Internal server error'});
        } else {
            console.log('Bulk operation completed successfully.');
            return res.status(200).json({
                status: 'success',
                data: response.body
            })
        }
    } catch (error) {
        console.error('Error in pipeline:', error);
        return res.status(404).json({error: 'Internal server error'});
    }

}

const data = {
    "from": "2024:06:05 12:00:00",
    "to": "2024:06:05 9:00:00",
    "duration": "3h",
    "sum_passenger": 56413,
    "graph_data": [
        {
            "route": "22",
            "total_passenger": 2652,
            "graph_data": [
                {
                    "time": "2024:06:05 12:00:00",
                    "buses": [
                        {
                            "bus_plate": "29B02201",
                            "passenger_count": 9
                        },
                        {
                            "bus_plate": "29B02202",
                            "passenger_count": 21
                        },
                        {
                            "bus_plate": "29B02203",
                            "passenger_count": 2
                        },
                        {
                            "bus_plate": "29B02204",
                            "passenger_count": 14
                        },
                        {
                            "bus_plate": "29B02205",
                            "passenger_count": 28
                        }
                    ]
                },
                {
                    "time": "2024:06:05 11:55:00",
                    "buses": [
                        {
                            "bus_plate": "29B02201",
                            "passenger_count": 1
                        },
                        {
                            "bus_plate": "29B02202",
                            "passenger_count": 3
                        },
                        {
                            "bus_plate": "29B02203",
                            "passenger_count": 15
                        },
                        {
                            "bus_plate": "29B02204",
                            "passenger_count": 8
                        },
                        {
                            "bus_plate": "29B02205",
                            "passenger_count": 27
                        }
                    ]
                },
                {
                    "time": "2024:06:05 11:50:00",
                    "buses": [
                        {
                            "bus_plate": "29B02201",
                            "passenger_count": 13
                        },
                        {
                            "bus_plate": "29B02202",
                            "passenger_count": 4
                        },
                        {
                            "bus_plate": "29B02203",
                            "passenger_count": 24
                        },
                        {
                            "bus_plate": "29B02204",
                            "passenger_count": 12
                        },
                        {
                            "bus_plate": "29B02205",
                            "passenger_count": 10
                        }
                    ]
                },
                {
                    "time": "2024:06:05 11:45:00",
                    "buses": [
                        {
                            "bus_plate": "29B02201",
                            "passenger_count": 5
                        },
                        {
                            "bus_plate": "29B02202",
                            "passenger_count": 5
                        },
                        {
                            "bus_plate": "29B02203",
                            "passenger_count": 8
                        },
                        {
                            "bus_plate": "29B02204",
                            "passenger_count": 20
                        },
                        {
                            "bus_plate": "29B02205",
                            "passenger_count": 2
                        }
                    ]
                },
                {
                    "time": "2024:06:05 11:40:00",
                    "buses": [
                        {
                            "bus_plate": "29B02201",
                            "passenger_count": 10
                        },
                        {
                            "bus_plate": "29B02202",
                            "passenger_count": 2
                        },
                        {
                            "bus_plate": "29B02203",
                            "passenger_count": 13
                        },
                        {
                            "bus_plate": "29B02204",
                            "passenger_count": 12
                        },
                        {
                            "bus_plate": "29B02205",
                            "passenger_count": 14
                        }
                    ]
                },
                {
                    "time": "2024:06:05 11:35:00",
                    "buses": [
                        {
                            "bus_plate": "29B02201",
                            "passenger_count": 9
                        },
                        {
                            "bus_plate": "29B02202",
                            "passenger_count": 22
                        },
                        {
                            "bus_plate": "29B02203",
                            "passenger_count": 13
                        },
                        {
                            "bus_plate": "29B02204",
                            "passenger_count": 5
                        },
                        {
                            "bus_plate": "29B02205",
                            "passenger_count": 12
                        }
                    ]
                },
                {
                    "time": "2024:06:05 11:30:00",
                    "buses": [
                        {
                            "bus_plate": "29B02201",
                            "passenger_count": 28
                        },
                        {
                            "bus_plate": "29B02202",
                            "passenger_count": 3
                        },
                        {
                            "bus_plate": "29B02203",
                            "passenger_count": 22
                        },
                        {
                            "bus_plate": "29B02204",
                            "passenger_count": 26
                        },
                        {
                            "bus_plate": "29B02205",
                            "passenger_count": 21
                        }
                    ]
                },
                {
                    "time": "2024:06:05 11:25:00",
                    "buses": [
                        {
                            "bus_plate": "29B02201",
                            "passenger_count": 23
                        },
                        {
                            "bus_plate": "29B02202",
                            "passenger_count": 7
                        },
                        {
                            "bus_plate": "29B02203",
                            "passenger_count": 5
                        },
                        {
                            "bus_plate": "29B02204",
                            "passenger_count": 17
                        },
                        {
                            "bus_plate": "29B02205",
                            "passenger_count": 28
                        }
                    ]
                },
                {
                    "time": "2024:06:05 11:20:00",
                    "buses": [
                        {
                            "bus_plate": "29B02201",
                            "passenger_count": 24
                        },
                        {
                            "bus_plate": "29B02202",
                            "passenger_count": 13
                        },
                        {
                            "bus_plate": "29B02203",
                            "passenger_count": 13
                        },
                        {
                            "bus_plate": "29B02204",
                            "passenger_count": 12
                        },
                        {
                            "bus_plate": "29B02205",
                            "passenger_count": 13
                        }
                    ]
                },
                {
                    "time": "2024:06:05 11:15:00",
                    "buses": [
                        {
                            "bus_plate": "29B02201",
                            "passenger_count": 23
                        },
                        {
                            "bus_plate": "29B02202",
                            "passenger_count": 26
                        },
                        {
                            "bus_plate": "29B02203",
                            "passenger_count": 22
                        },
                        {
                            "bus_plate": "29B02204",
                            "passenger_count": 1
                        },
                        {
                            "bus_plate": "29B02205",
                            "passenger_count": 28
                        }
                    ]
                },
                {
                    "time": "2024:06:05 11:10:00",
                    "buses": [
                        {
                            "bus_plate": "29B02201",
                            "passenger_count": 11
                        },
                        {
                            "bus_plate": "29B02202",
                            "passenger_count": 23
                        },
                        {
                            "bus_plate": "29B02203",
                            "passenger_count": 19
                        },
                        {
                            "bus_plate": "29B02204",
                            "passenger_count": 25
                        },
                        {
                            "bus_plate": "29B02205",
                            "passenger_count": 18
                        }
                    ]
                },
                {
                    "time": "2024:06:05 11:05:00",
                    "buses": [
                        {
                            "bus_plate": "29B02201",
                            "passenger_count": 12
                        },
                        {
                            "bus_plate": "29B02202",
                            "passenger_count": 1
                        },
                        {
                            "bus_plate": "29B02203",
                            "passenger_count": 23
                        },
                        {
                            "bus_plate": "29B02204",
                            "passenger_count": 2
                        },
                        {
                            "bus_plate": "29B02205",
                            "passenger_count": 1
                        }
                    ]
                },
                {
                    "time": "2024:06:05 11:00:00",
                    "buses": [
                        {
                            "bus_plate": "29B02201",
                            "passenger_count": 20
                        },
                        {
                            "bus_plate": "29B02202",
                            "passenger_count": 19
                        },
                        {
                            "bus_plate": "29B02203",
                            "passenger_count": 22
                        },
                        {
                            "bus_plate": "29B02204",
                            "passenger_count": 10
                        },
                        {
                            "bus_plate": "29B02205",
                            "passenger_count": 28
                        }
                    ]
                },
                {
                    "time": "2024:06:05 10:55:00",
                    "buses": [
                        {
                            "bus_plate": "29B02201",
                            "passenger_count": 6
                        },
                        {
                            "bus_plate": "29B02202",
                            "passenger_count": 26
                        },
                        {
                            "bus_plate": "29B02203",
                            "passenger_count": 22
                        },
                        {
                            "bus_plate": "29B02204",
                            "passenger_count": 7
                        },
                        {
                            "bus_plate": "29B02205",
                            "passenger_count": 20
                        }
                    ]
                },
                {
                    "time": "2024:06:05 10:50:00",
                    "buses": [
                        {
                            "bus_plate": "29B02201",
                            "passenger_count": 10
                        },
                        {
                            "bus_plate": "29B02202",
                            "passenger_count": 6
                        },
                        {
                            "bus_plate": "29B02203",
                            "passenger_count": 12
                        },
                        {
                            "bus_plate": "29B02204",
                            "passenger_count": 18
                        },
                        {
                            "bus_plate": "29B02205",
                            "passenger_count": 19
                        }
                    ]
                },
                {
                    "time": "2024:06:05 10:45:00",
                    "buses": [
                        {
                            "bus_plate": "29B02201",
                            "passenger_count": 18
                        },
                        {
                            "bus_plate": "29B02202",
                            "passenger_count": 27
                        },
                        {
                            "bus_plate": "29B02203",
                            "passenger_count": 30
                        },
                        {
                            "bus_plate": "29B02204",
                            "passenger_count": 6
                        },
                        {
                            "bus_plate": "29B02205",
                            "passenger_count": 7
                        }
                    ]
                },
                {
                    "time": "2024:06:05 10:40:00",
                    "buses": [
                        {
                            "bus_plate": "29B02201",
                            "passenger_count": 23
                        },
                        {
                            "bus_plate": "29B02202",
                            "passenger_count": 7
                        },
                        {
                            "bus_plate": "29B02203",
                            "passenger_count": 23
                        },
                        {
                            "bus_plate": "29B02204",
                            "passenger_count": 17
                        },
                        {
                            "bus_plate": "29B02205",
                            "passenger_count": 16
                        }
                    ]
                },
                {
                    "time": "2024:06:05 10:35:00",
                    "buses": [
                        {
                            "bus_plate": "29B02201",
                            "passenger_count": 2
                        },
                        {
                            "bus_plate": "29B02202",
                            "passenger_count": 10
                        },
                        {
                            "bus_plate": "29B02203",
                            "passenger_count": 4
                        },
                        {
                            "bus_plate": "29B02204",
                            "passenger_count": 10
                        },
                        {
                            "bus_plate": "29B02205",
                            "passenger_count": 30
                        }
                    ]
                },
                {
                    "time": "2024:06:05 10:30:00",
                    "buses": [
                        {
                            "bus_plate": "29B02201",
                            "passenger_count": 5
                        },
                        {
                            "bus_plate": "29B02202",
                            "passenger_count": 25
                        },
                        {
                            "bus_plate": "29B02203",
                            "passenger_count": 2
                        },
                        {
                            "bus_plate": "29B02204",
                            "passenger_count": 30
                        },
                        {
                            "bus_plate": "29B02205",
                            "passenger_count": 8
                        }
                    ]
                },
                {
                    "time": "2024:06:05 10:25:00",
                    "buses": [
                        {
                            "bus_plate": "29B02201",
                            "passenger_count": 2
                        },
                        {
                            "bus_plate": "29B02202",
                            "passenger_count": 6
                        },
                        {
                            "bus_plate": "29B02203",
                            "passenger_count": 6
                        },
                        {
                            "bus_plate": "29B02204",
                            "passenger_count": 2
                        },
                        {
                            "bus_plate": "29B02205",
                            "passenger_count": 27
                        }
                    ]
                },
                {
                    "time": "2024:06:05 10:20:00",
                    "buses": [
                        {
                            "bus_plate": "29B02201",
                            "passenger_count": 1
                        },
                        {
                            "bus_plate": "29B02202",
                            "passenger_count": 13
                        },
                        {
                            "bus_plate": "29B02203",
                            "passenger_count": 14
                        },
                        {
                            "bus_plate": "29B02204",
                            "passenger_count": 5
                        },
                        {
                            "bus_plate": "29B02205",
                            "passenger_count": 20
                        }
                    ]
                },
                {
                    "time": "2024:06:05 10:15:00",
                    "buses": [
                        {
                            "bus_plate": "29B02201",
                            "passenger_count": 29
                        },
                        {
                            "bus_plate": "29B02202",
                            "passenger_count": 24
                        },
                        {
                            "bus_plate": "29B02203",
                            "passenger_count": 29
                        },
                        {
                            "bus_plate": "29B02204",
                            "passenger_count": 21
                        },
                        {
                            "bus_plate": "29B02205",
                            "passenger_count": 5
                        }
                    ]
                },
                {
                    "time": "2024:06:05 10:10:00",
                    "buses": [
                        {
                            "bus_plate": "29B02201",
                            "passenger_count": 21
                        },
                        {
                            "bus_plate": "29B02202",
                            "passenger_count": 24
                        },
                        {
                            "bus_plate": "29B02203",
                            "passenger_count": 18
                        },
                        {
                            "bus_plate": "29B02204",
                            "passenger_count": 14
                        },
                        {
                            "bus_plate": "29B02205",
                            "passenger_count": 9
                        }
                    ]
                },
                {
                    "time": "2024:06:05 10:05:00",
                    "buses": [
                        {
                            "bus_plate": "29B02201",
                            "passenger_count": 7
                        },
                        {
                            "bus_plate": "29B02202",
                            "passenger_count": 10
                        },
                        {
                            "bus_plate": "29B02203",
                            "passenger_count": 22
                        },
                        {
                            "bus_plate": "29B02204",
                            "passenger_count": 13
                        },
                        {
                            "bus_plate": "29B02205",
                            "passenger_count": 8
                        }
                    ]
                },
                {
                    "time": "2024:06:05 10:00:00",
                    "buses": [
                        {
                            "bus_plate": "29B02201",
                            "passenger_count": 17
                        },
                        {
                            "bus_plate": "29B02202",
                            "passenger_count": 1
                        },
                        {
                            "bus_plate": "29B02203",
                            "passenger_count": 4
                        },
                        {
                            "bus_plate": "29B02204",
                            "passenger_count": 6
                        },
                        {
                            "bus_plate": "29B02205",
                            "passenger_count": 17
                        }
                    ]
                },
                {
                    "time": "2024:06:05 09:55:00",
                    "buses": [
                        {
                            "bus_plate": "29B02201",
                            "passenger_count": 5
                        },
                        {
                            "bus_plate": "29B02202",
                            "passenger_count": 10
                        },
                        {
                            "bus_plate": "29B02203",
                            "passenger_count": 14
                        },
                        {
                            "bus_plate": "29B02204",
                            "passenger_count": 15
                        },
                        {
                            "bus_plate": "29B02205",
                            "passenger_count": 18
                        }
                    ]
                },
                {
                    "time": "2024:06:05 09:50:00",
                    "buses": [
                        {
                            "bus_plate": "29B02201",
                            "passenger_count": 17
                        },
                        {
                            "bus_plate": "29B02202",
                            "passenger_count": 18
                        },
                        {
                            "bus_plate": "29B02203",
                            "passenger_count": 14
                        },
                        {
                            "bus_plate": "29B02204",
                            "passenger_count": 25
                        },
                        {
                            "bus_plate": "29B02205",
                            "passenger_count": 17
                        }
                    ]
                },
                {
                    "time": "2024:06:05 09:45:00",
                    "buses": [
                        {
                            "bus_plate": "29B02201",
                            "passenger_count": 27
                        },
                        {
                            "bus_plate": "29B02202",
                            "passenger_count": 6
                        },
                        {
                            "bus_plate": "29B02203",
                            "passenger_count": 30
                        },
                        {
                            "bus_plate": "29B02204",
                            "passenger_count": 22
                        },
                        {
                            "bus_plate": "29B02205",
                            "passenger_count": 1
                        }
                    ]
                },
                {
                    "time": "2024:06:05 09:40:00",
                    "buses": [
                        {
                            "bus_plate": "29B02201",
                            "passenger_count": 16
                        },
                        {
                            "bus_plate": "29B02202",
                            "passenger_count": 20
                        },
                        {
                            "bus_plate": "29B02203",
                            "passenger_count": 15
                        },
                        {
                            "bus_plate": "29B02204",
                            "passenger_count": 14
                        },
                        {
                            "bus_plate": "29B02205",
                            "passenger_count": 12
                        }
                    ]
                },
                {
                    "time": "2024:06:05 09:35:00",
                    "buses": [
                        {
                            "bus_plate": "29B02201",
                            "passenger_count": 13
                        },
                        {
                            "bus_plate": "29B02202",
                            "passenger_count": 6
                        },
                        {
                            "bus_plate": "29B02203",
                            "passenger_count": 19
                        },
                        {
                            "bus_plate": "29B02204",
                            "passenger_count": 17
                        },
                        {
                            "bus_plate": "29B02205",
                            "passenger_count": 10
                        }
                    ]
                },
                {
                    "time": "2024:06:05 09:30:00",
                    "buses": [
                        {
                            "bus_plate": "29B02201",
                            "passenger_count": 22
                        },
                        {
                            "bus_plate": "29B02202",
                            "passenger_count": 26
                        },
                        {
                            "bus_plate": "29B02203",
                            "passenger_count": 11
                        },
                        {
                            "bus_plate": "29B02204",
                            "passenger_count": 22
                        },
                        {
                            "bus_plate": "29B02205",
                            "passenger_count": 8
                        }
                    ]
                },
                {
                    "time": "2024:06:05 09:25:00",
                    "buses": [
                        {
                            "bus_plate": "29B02201",
                            "passenger_count": 25
                        },
                        {
                            "bus_plate": "29B02202",
                            "passenger_count": 25
                        },
                        {
                            "bus_plate": "29B02203",
                            "passenger_count": 3
                        },
                        {
                            "bus_plate": "29B02204",
                            "passenger_count": 24
                        },
                        {
                            "bus_plate": "29B02205",
                            "passenger_count": 12
                        }
                    ]
                },
                {
                    "time": "2024:06:05 09:20:00",
                    "buses": [
                        {
                            "bus_plate": "29B02201",
                            "passenger_count": 15
                        },
                        {
                            "bus_plate": "29B02202",
                            "passenger_count": 24
                        },
                        {
                            "bus_plate": "29B02203",
                            "passenger_count": 8
                        },
                        {
                            "bus_plate": "29B02204",
                            "passenger_count": 12
                        },
                        {
                            "bus_plate": "29B02205",
                            "passenger_count": 18
                        }
                    ]
                },
                {
                    "time": "2024:06:05 09:15:00",
                    "buses": [
                        {
                            "bus_plate": "29B02201",
                            "passenger_count": 17
                        },
                        {
                            "bus_plate": "29B02202",
                            "passenger_count": 19
                        },
                        {
                            "bus_plate": "29B02203",
                            "passenger_count": 5
                        },
                        {
                            "bus_plate": "29B02204",
                            "passenger_count": 9
                        },
                        {
                            "bus_plate": "29B02205",
                            "passenger_count": 14
                        }
                    ]
                },
                {
                    "time": "2024:06:05 09:10:00",
                    "buses": [
                        {
                            "bus_plate": "29B02201",
                            "passenger_count": 6
                        },
                        {
                            "bus_plate": "29B02202",
                            "passenger_count": 30
                        },
                        {
                            "bus_plate": "29B02203",
                            "passenger_count": 7
                        },
                        {
                            "bus_plate": "29B02204",
                            "passenger_count": 9
                        },
                        {
                            "bus_plate": "29B02205",
                            "passenger_count": 30
                        }
                    ]
                },
                {
                    "time": "2024:06:05 09:05:00",
                    "buses": [
                        {
                            "bus_plate": "29B02201",
                            "passenger_count": 26
                        },
                        {
                            "bus_plate": "29B02202",
                            "passenger_count": 25
                        },
                        {
                            "bus_plate": "29B02203",
                            "passenger_count": 10
                        },
                        {
                            "bus_plate": "29B02204",
                            "passenger_count": 30
                        },
                        {
                            "bus_plate": "29B02205",
                            "passenger_count": 6
                        }
                    ]
                }
            ]
        },
        {
            "route": "23",
            "total_passenger": 2968,
            "graph_data": [
                {
                    "time": "2024:06:05 12:00:00",
                    "buses": [
                        {
                            "bus_plate": "29B02301",
                            "passenger_count": 17
                        },
                        {
                            "bus_plate": "29B02302",
                            "passenger_count": 17
                        },
                        {
                            "bus_plate": "29B02303",
                            "passenger_count": 28
                        },
                        {
                            "bus_plate": "29B02304",
                            "passenger_count": 8
                        },
                        {
                            "bus_plate": "29B02305",
                            "passenger_count": 21
                        }
                    ]
                },
                {
                    "time": "2024:06:05 11:55:00",
                    "buses": [
                        {
                            "bus_plate": "29B02301",
                            "passenger_count": 12
                        },
                        {
                            "bus_plate": "29B02302",
                            "passenger_count": 1
                        },
                        {
                            "bus_plate": "29B02303",
                            "passenger_count": 6
                        },
                        {
                            "bus_plate": "29B02304",
                            "passenger_count": 20
                        },
                        {
                            "bus_plate": "29B02305",
                            "passenger_count": 24
                        }
                    ]
                },
                {
                    "time": "2024:06:05 11:50:00",
                    "buses": [
                        {
                            "bus_plate": "29B02301",
                            "passenger_count": 29
                        },
                        {
                            "bus_plate": "29B02302",
                            "passenger_count": 28
                        },
                        {
                            "bus_plate": "29B02303",
                            "passenger_count": 27
                        },
                        {
                            "bus_plate": "29B02304",
                            "passenger_count": 22
                        },
                        {
                            "bus_plate": "29B02305",
                            "passenger_count": 10
                        }
                    ]
                },
                {
                    "time": "2024:06:05 11:45:00",
                    "buses": [
                        {
                            "bus_plate": "29B02301",
                            "passenger_count": 24
                        },
                        {
                            "bus_plate": "29B02302",
                            "passenger_count": 2
                        },
                        {
                            "bus_plate": "29B02303",
                            "passenger_count": 27
                        },
                        {
                            "bus_plate": "29B02304",
                            "passenger_count": 20
                        },
                        {
                            "bus_plate": "29B02305",
                            "passenger_count": 27
                        }
                    ]
                },
                {
                    "time": "2024:06:05 11:40:00",
                    "buses": [
                        {
                            "bus_plate": "29B02301",
                            "passenger_count": 27
                        },
                        {
                            "bus_plate": "29B02302",
                            "passenger_count": 9
                        },
                        {
                            "bus_plate": "29B02303",
                            "passenger_count": 19
                        },
                        {
                            "bus_plate": "29B02304",
                            "passenger_count": 21
                        },
                        {
                            "bus_plate": "29B02305",
                            "passenger_count": 12
                        }
                    ]
                },
                {
                    "time": "2024:06:05 11:35:00",
                    "buses": [
                        {
                            "bus_plate": "29B02301",
                            "passenger_count": 18
                        },
                        {
                            "bus_plate": "29B02302",
                            "passenger_count": 21
                        },
                        {
                            "bus_plate": "29B02303",
                            "passenger_count": 11
                        },
                        {
                            "bus_plate": "29B02304",
                            "passenger_count": 24
                        },
                        {
                            "bus_plate": "29B02305",
                            "passenger_count": 4
                        }
                    ]
                },
                {
                    "time": "2024:06:05 11:30:00",
                    "buses": [
                        {
                            "bus_plate": "29B02301",
                            "passenger_count": 5
                        },
                        {
                            "bus_plate": "29B02302",
                            "passenger_count": 2
                        },
                        {
                            "bus_plate": "29B02303",
                            "passenger_count": 11
                        },
                        {
                            "bus_plate": "29B02304",
                            "passenger_count": 24
                        },
                        {
                            "bus_plate": "29B02305",
                            "passenger_count": 4
                        }
                    ]
                },
                {
                    "time": "2024:06:05 11:25:00",
                    "buses": [
                        {
                            "bus_plate": "29B02301",
                            "passenger_count": 5
                        },
                        {
                            "bus_plate": "29B02302",
                            "passenger_count": 8
                        },
                        {
                            "bus_plate": "29B02303",
                            "passenger_count": 28
                        },
                        {
                            "bus_plate": "29B02304",
                            "passenger_count": 12
                        },
                        {
                            "bus_plate": "29B02305",
                            "passenger_count": 5
                        }
                    ]
                },
                {
                    "time": "2024:06:05 11:20:00",
                    "buses": [
                        {
                            "bus_plate": "29B02301",
                            "passenger_count": 12
                        },
                        {
                            "bus_plate": "29B02302",
                            "passenger_count": 4
                        },
                        {
                            "bus_plate": "29B02303",
                            "passenger_count": 21
                        },
                        {
                            "bus_plate": "29B02304",
                            "passenger_count": 9
                        },
                        {
                            "bus_plate": "29B02305",
                            "passenger_count": 1
                        }
                    ]
                },
                {
                    "time": "2024:06:05 11:15:00",
                    "buses": [
                        {
                            "bus_plate": "29B02301",
                            "passenger_count": 4
                        },
                        {
                            "bus_plate": "29B02302",
                            "passenger_count": 10
                        },
                        {
                            "bus_plate": "29B02303",
                            "passenger_count": 21
                        },
                        {
                            "bus_plate": "29B02304",
                            "passenger_count": 27
                        },
                        {
                            "bus_plate": "29B02305",
                            "passenger_count": 7
                        }
                    ]
                },
                {
                    "time": "2024:06:05 11:10:00",
                    "buses": [
                        {
                            "bus_plate": "29B02301",
                            "passenger_count": 24
                        },
                        {
                            "bus_plate": "29B02302",
                            "passenger_count": 25
                        },
                        {
                            "bus_plate": "29B02303",
                            "passenger_count": 23
                        },
                        {
                            "bus_plate": "29B02304",
                            "passenger_count": 26
                        },
                        {
                            "bus_plate": "29B02305",
                            "passenger_count": 18
                        }
                    ]
                },
                {
                    "time": "2024:06:05 11:05:00",
                    "buses": [
                        {
                            "bus_plate": "29B02301",
                            "passenger_count": 19
                        },
                        {
                            "bus_plate": "29B02302",
                            "passenger_count": 15
                        },
                        {
                            "bus_plate": "29B02303",
                            "passenger_count": 17
                        },
                        {
                            "bus_plate": "29B02304",
                            "passenger_count": 15
                        },
                        {
                            "bus_plate": "29B02305",
                            "passenger_count": 20
                        }
                    ]
                },
                {
                    "time": "2024:06:05 11:00:00",
                    "buses": [
                        {
                            "bus_plate": "29B02301",
                            "passenger_count": 18
                        },
                        {
                            "bus_plate": "29B02302",
                            "passenger_count": 3
                        },
                        {
                            "bus_plate": "29B02303",
                            "passenger_count": 13
                        },
                        {
                            "bus_plate": "29B02304",
                            "passenger_count": 28
                        },
                        {
                            "bus_plate": "29B02305",
                            "passenger_count": 5
                        }
                    ]
                },
                {
                    "time": "2024:06:05 10:55:00",
                    "buses": [
                        {
                            "bus_plate": "29B02301",
                            "passenger_count": 24
                        },
                        {
                            "bus_plate": "29B02302",
                            "passenger_count": 5
                        },
                        {
                            "bus_plate": "29B02303",
                            "passenger_count": 11
                        },
                        {
                            "bus_plate": "29B02304",
                            "passenger_count": 14
                        },
                        {
                            "bus_plate": "29B02305",
                            "passenger_count": 26
                        }
                    ]
                },
                {
                    "time": "2024:06:05 10:50:00",
                    "buses": [
                        {
                            "bus_plate": "29B02301",
                            "passenger_count": 14
                        },
                        {
                            "bus_plate": "29B02302",
                            "passenger_count": 4
                        },
                        {
                            "bus_plate": "29B02303",
                            "passenger_count": 23
                        },
                        {
                            "bus_plate": "29B02304",
                            "passenger_count": 15
                        },
                        {
                            "bus_plate": "29B02305",
                            "passenger_count": 24
                        }
                    ]
                },
                {
                    "time": "2024:06:05 10:45:00",
                    "buses": [
                        {
                            "bus_plate": "29B02301",
                            "passenger_count": 26
                        },
                        {
                            "bus_plate": "29B02302",
                            "passenger_count": 24
                        },
                        {
                            "bus_plate": "29B02303",
                            "passenger_count": 19
                        },
                        {
                            "bus_plate": "29B02304",
                            "passenger_count": 29
                        },
                        {
                            "bus_plate": "29B02305",
                            "passenger_count": 1
                        }
                    ]
                },
                {
                    "time": "2024:06:05 10:40:00",
                    "buses": [
                        {
                            "bus_plate": "29B02301",
                            "passenger_count": 15
                        },
                        {
                            "bus_plate": "29B02302",
                            "passenger_count": 6
                        },
                        {
                            "bus_plate": "29B02303",
                            "passenger_count": 3
                        },
                        {
                            "bus_plate": "29B02304",
                            "passenger_count": 28
                        },
                        {
                            "bus_plate": "29B02305",
                            "passenger_count": 11
                        }
                    ]
                },
                {
                    "time": "2024:06:05 10:35:00",
                    "buses": [
                        {
                            "bus_plate": "29B02301",
                            "passenger_count": 17
                        },
                        {
                            "bus_plate": "29B02302",
                            "passenger_count": 27
                        },
                        {
                            "bus_plate": "29B02303",
                            "passenger_count": 2
                        },
                        {
                            "bus_plate": "29B02304",
                            "passenger_count": 3
                        },
                        {
                            "bus_plate": "29B02305",
                            "passenger_count": 12
                        }
                    ]
                },
                {
                    "time": "2024:06:05 10:30:00",
                    "buses": [
                        {
                            "bus_plate": "29B02301",
                            "passenger_count": 29
                        },
                        {
                            "bus_plate": "29B02302",
                            "passenger_count": 16
                        },
                        {
                            "bus_plate": "29B02303",
                            "passenger_count": 30
                        },
                        {
                            "bus_plate": "29B02304",
                            "passenger_count": 15
                        },
                        {
                            "bus_plate": "29B02305",
                            "passenger_count": 23
                        }
                    ]
                },
                {
                    "time": "2024:06:05 10:25:00",
                    "buses": [
                        {
                            "bus_plate": "29B02301",
                            "passenger_count": 16
                        },
                        {
                            "bus_plate": "29B02302",
                            "passenger_count": 24
                        },
                        {
                            "bus_plate": "29B02303",
                            "passenger_count": 7
                        },
                        {
                            "bus_plate": "29B02304",
                            "passenger_count": 23
                        },
                        {
                            "bus_plate": "29B02305",
                            "passenger_count": 15
                        }
                    ]
                },
                {
                    "time": "2024:06:05 10:20:00",
                    "buses": [
                        {
                            "bus_plate": "29B02301",
                            "passenger_count": 6
                        },
                        {
                            "bus_plate": "29B02302",
                            "passenger_count": 28
                        },
                        {
                            "bus_plate": "29B02303",
                            "passenger_count": 23
                        },
                        {
                            "bus_plate": "29B02304",
                            "passenger_count": 24
                        },
                        {
                            "bus_plate": "29B02305",
                            "passenger_count": 12
                        }
                    ]
                },
                {
                    "time": "2024:06:05 10:15:00",
                    "buses": [
                        {
                            "bus_plate": "29B02301",
                            "passenger_count": 3
                        },
                        {
                            "bus_plate": "29B02302",
                            "passenger_count": 12
                        },
                        {
                            "bus_plate": "29B02303",
                            "passenger_count": 26
                        },
                        {
                            "bus_plate": "29B02304",
                            "passenger_count": 11
                        },
                        {
                            "bus_plate": "29B02305",
                            "passenger_count": 26
                        }
                    ]
                },
                {
                    "time": "2024:06:05 10:10:00",
                    "buses": [
                        {
                            "bus_plate": "29B02301",
                            "passenger_count": 18
                        },
                        {
                            "bus_plate": "29B02302",
                            "passenger_count": 18
                        },
                        {
                            "bus_plate": "29B02303",
                            "passenger_count": 25
                        },
                        {
                            "bus_plate": "29B02304",
                            "passenger_count": 20
                        },
                        {
                            "bus_plate": "29B02305",
                            "passenger_count": 23
                        }
                    ]
                },
                {
                    "time": "2024:06:05 10:05:00",
                    "buses": [
                        {
                            "bus_plate": "29B02301",
                            "passenger_count": 28
                        },
                        {
                            "bus_plate": "29B02302",
                            "passenger_count": 16
                        },
                        {
                            "bus_plate": "29B02303",
                            "passenger_count": 18
                        },
                        {
                            "bus_plate": "29B02304",
                            "passenger_count": 26
                        },
                        {
                            "bus_plate": "29B02305",
                            "passenger_count": 2
                        }
                    ]
                },
                {
                    "time": "2024:06:05 10:00:00",
                    "buses": [
                        {
                            "bus_plate": "29B02301",
                            "passenger_count": 2
                        },
                        {
                            "bus_plate": "29B02302",
                            "passenger_count": 18
                        },
                        {
                            "bus_plate": "29B02303",
                            "passenger_count": 26
                        },
                        {
                            "bus_plate": "29B02304",
                            "passenger_count": 14
                        },
                        {
                            "bus_plate": "29B02305",
                            "passenger_count": 23
                        }
                    ]
                },
                {
                    "time": "2024:06:05 09:55:00",
                    "buses": [
                        {
                            "bus_plate": "29B02301",
                            "passenger_count": 4
                        },
                        {
                            "bus_plate": "29B02302",
                            "passenger_count": 28
                        },
                        {
                            "bus_plate": "29B02303",
                            "passenger_count": 13
                        },
                        {
                            "bus_plate": "29B02304",
                            "passenger_count": 20
                        },
                        {
                            "bus_plate": "29B02305",
                            "passenger_count": 24
                        }
                    ]
                },
                {
                    "time": "2024:06:05 09:50:00",
                    "buses": [
                        {
                            "bus_plate": "29B02301",
                            "passenger_count": 19
                        },
                        {
                            "bus_plate": "29B02302",
                            "passenger_count": 22
                        },
                        {
                            "bus_plate": "29B02303",
                            "passenger_count": 14
                        },
                        {
                            "bus_plate": "29B02304",
                            "passenger_count": 10
                        },
                        {
                            "bus_plate": "29B02305",
                            "passenger_count": 6
                        }
                    ]
                },
                {
                    "time": "2024:06:05 09:45:00",
                    "buses": [
                        {
                            "bus_plate": "29B02301",
                            "passenger_count": 18
                        },
                        {
                            "bus_plate": "29B02302",
                            "passenger_count": 6
                        },
                        {
                            "bus_plate": "29B02303",
                            "passenger_count": 22
                        },
                        {
                            "bus_plate": "29B02304",
                            "passenger_count": 10
                        },
                        {
                            "bus_plate": "29B02305",
                            "passenger_count": 28
                        }
                    ]
                },
                {
                    "time": "2024:06:05 09:40:00",
                    "buses": [
                        {
                            "bus_plate": "29B02301",
                            "passenger_count": 19
                        },
                        {
                            "bus_plate": "29B02302",
                            "passenger_count": 13
                        },
                        {
                            "bus_plate": "29B02303",
                            "passenger_count": 19
                        },
                        {
                            "bus_plate": "29B02304",
                            "passenger_count": 19
                        },
                        {
                            "bus_plate": "29B02305",
                            "passenger_count": 2
                        }
                    ]
                },
                {
                    "time": "2024:06:05 09:35:00",
                    "buses": [
                        {
                            "bus_plate": "29B02301",
                            "passenger_count": 25
                        },
                        {
                            "bus_plate": "29B02302",
                            "passenger_count": 15
                        },
                        {
                            "bus_plate": "29B02303",
                            "passenger_count": 13
                        },
                        {
                            "bus_plate": "29B02304",
                            "passenger_count": 13
                        },
                        {
                            "bus_plate": "29B02305",
                            "passenger_count": 12
                        }
                    ]
                },
                {
                    "time": "2024:06:05 09:30:00",
                    "buses": [
                        {
                            "bus_plate": "29B02301",
                            "passenger_count": 20
                        },
                        {
                            "bus_plate": "29B02302",
                            "passenger_count": 29
                        },
                        {
                            "bus_plate": "29B02303",
                            "passenger_count": 29
                        },
                        {
                            "bus_plate": "29B02304",
                            "passenger_count": 10
                        },
                        {
                            "bus_plate": "29B02305",
                            "passenger_count": 14
                        }
                    ]
                },
                {
                    "time": "2024:06:05 09:25:00",
                    "buses": [
                        {
                            "bus_plate": "29B02301",
                            "passenger_count": 8
                        },
                        {
                            "bus_plate": "29B02302",
                            "passenger_count": 10
                        },
                        {
                            "bus_plate": "29B02303",
                            "passenger_count": 11
                        },
                        {
                            "bus_plate": "29B02304",
                            "passenger_count": 21
                        },
                        {
                            "bus_plate": "29B02305",
                            "passenger_count": 16
                        }
                    ]
                },
                {
                    "time": "2024:06:05 09:20:00",
                    "buses": [
                        {
                            "bus_plate": "29B02301",
                            "passenger_count": 13
                        },
                        {
                            "bus_plate": "29B02302",
                            "passenger_count": 7
                        },
                        {
                            "bus_plate": "29B02303",
                            "passenger_count": 26
                        },
                        {
                            "bus_plate": "29B02304",
                            "passenger_count": 30
                        },
                        {
                            "bus_plate": "29B02305",
                            "passenger_count": 25
                        }
                    ]
                },
                {
                    "time": "2024:06:05 09:15:00",
                    "buses": [
                        {
                            "bus_plate": "29B02301",
                            "passenger_count": 2
                        },
                        {
                            "bus_plate": "29B02302",
                            "passenger_count": 6
                        },
                        {
                            "bus_plate": "29B02303",
                            "passenger_count": 30
                        },
                        {
                            "bus_plate": "29B02304",
                            "passenger_count": 10
                        },
                        {
                            "bus_plate": "29B02305",
                            "passenger_count": 29
                        }
                    ]
                },
                {
                    "time": "2024:06:05 09:10:00",
                    "buses": [
                        {
                            "bus_plate": "29B02301",
                            "passenger_count": 19
                        },
                        {
                            "bus_plate": "29B02302",
                            "passenger_count": 23
                        },
                        {
                            "bus_plate": "29B02303",
                            "passenger_count": 21
                        },
                        {
                            "bus_plate": "29B02304",
                            "passenger_count": 15
                        },
                        {
                            "bus_plate": "29B02305",
                            "passenger_count": 20
                        }
                    ]
                },
                {
                    "time": "2024:06:05 09:05:00",
                    "buses": [
                        {
                            "bus_plate": "29B02301",
                            "passenger_count": 7
                        },
                        {
                            "bus_plate": "29B02302",
                            "passenger_count": 25
                        },
                        {
                            "bus_plate": "29B02303",
                            "passenger_count": 8
                        },
                        {
                            "bus_plate": "29B02304",
                            "passenger_count": 17
                        },
                        {
                            "bus_plate": "29B02305",
                            "passenger_count": 19
                        }
                    ]
                }
            ]
        },
        {
            "route": "24",
            "total_passenger": 2839,
            "graph_data": [
                {
                    "time": "2024:06:05 12:00:00",
                    "buses": [
                        {
                            "bus_plate": "29B02401",
                            "passenger_count": 4
                        },
                        {
                            "bus_plate": "29B02402",
                            "passenger_count": 5
                        },
                        {
                            "bus_plate": "29B02403",
                            "passenger_count": 28
                        },
                        {
                            "bus_plate": "29B02404",
                            "passenger_count": 24
                        },
                        {
                            "bus_plate": "29B02405",
                            "passenger_count": 3
                        }
                    ]
                },
                {
                    "time": "2024:06:05 11:55:00",
                    "buses": [
                        {
                            "bus_plate": "29B02401",
                            "passenger_count": 5
                        },
                        {
                            "bus_plate": "29B02402",
                            "passenger_count": 30
                        },
                        {
                            "bus_plate": "29B02403",
                            "passenger_count": 11
                        },
                        {
                            "bus_plate": "29B02404",
                            "passenger_count": 15
                        },
                        {
                            "bus_plate": "29B02405",
                            "passenger_count": 2
                        }
                    ]
                },
                {
                    "time": "2024:06:05 11:50:00",
                    "buses": [
                        {
                            "bus_plate": "29B02401",
                            "passenger_count": 22
                        },
                        {
                            "bus_plate": "29B02402",
                            "passenger_count": 30
                        },
                        {
                            "bus_plate": "29B02403",
                            "passenger_count": 11
                        },
                        {
                            "bus_plate": "29B02404",
                            "passenger_count": 9
                        },
                        {
                            "bus_plate": "29B02405",
                            "passenger_count": 12
                        }
                    ]
                },
                {
                    "time": "2024:06:05 11:45:00",
                    "buses": [
                        {
                            "bus_plate": "29B02401",
                            "passenger_count": 1
                        },
                        {
                            "bus_plate": "29B02402",
                            "passenger_count": 1
                        },
                        {
                            "bus_plate": "29B02403",
                            "passenger_count": 9
                        },
                        {
                            "bus_plate": "29B02404",
                            "passenger_count": 4
                        },
                        {
                            "bus_plate": "29B02405",
                            "passenger_count": 6
                        }
                    ]
                },
                {
                    "time": "2024:06:05 11:40:00",
                    "buses": [
                        {
                            "bus_plate": "29B02401",
                            "passenger_count": 11
                        },
                        {
                            "bus_plate": "29B02402",
                            "passenger_count": 30
                        },
                        {
                            "bus_plate": "29B02403",
                            "passenger_count": 3
                        },
                        {
                            "bus_plate": "29B02404",
                            "passenger_count": 24
                        },
                        {
                            "bus_plate": "29B02405",
                            "passenger_count": 22
                        }
                    ]
                },
                {
                    "time": "2024:06:05 11:35:00",
                    "buses": [
                        {
                            "bus_plate": "29B02401",
                            "passenger_count": 29
                        },
                        {
                            "bus_plate": "29B02402",
                            "passenger_count": 23
                        },
                        {
                            "bus_plate": "29B02403",
                            "passenger_count": 13
                        },
                        {
                            "bus_plate": "29B02404",
                            "passenger_count": 13
                        },
                        {
                            "bus_plate": "29B02405",
                            "passenger_count": 11
                        }
                    ]
                },
                {
                    "time": "2024:06:05 11:30:00",
                    "buses": [
                        {
                            "bus_plate": "29B02401",
                            "passenger_count": 29
                        },
                        {
                            "bus_plate": "29B02402",
                            "passenger_count": 13
                        },
                        {
                            "bus_plate": "29B02403",
                            "passenger_count": 16
                        },
                        {
                            "bus_plate": "29B02404",
                            "passenger_count": 16
                        },
                        {
                            "bus_plate": "29B02405",
                            "passenger_count": 29
                        }
                    ]
                },
                {
                    "time": "2024:06:05 11:25:00",
                    "buses": [
                        {
                            "bus_plate": "29B02401",
                            "passenger_count": 30
                        },
                        {
                            "bus_plate": "29B02402",
                            "passenger_count": 28
                        },
                        {
                            "bus_plate": "29B02403",
                            "passenger_count": 15
                        },
                        {
                            "bus_plate": "29B02404",
                            "passenger_count": 4
                        },
                        {
                            "bus_plate": "29B02405",
                            "passenger_count": 3
                        }
                    ]
                },
                {
                    "time": "2024:06:05 11:20:00",
                    "buses": [
                        {
                            "bus_plate": "29B02401",
                            "passenger_count": 14
                        },
                        {
                            "bus_plate": "29B02402",
                            "passenger_count": 10
                        },
                        {
                            "bus_plate": "29B02403",
                            "passenger_count": 29
                        },
                        {
                            "bus_plate": "29B02404",
                            "passenger_count": 9
                        },
                        {
                            "bus_plate": "29B02405",
                            "passenger_count": 2
                        }
                    ]
                },
                {
                    "time": "2024:06:05 11:15:00",
                    "buses": [
                        {
                            "bus_plate": "29B02401",
                            "passenger_count": 6
                        },
                        {
                            "bus_plate": "29B02402",
                            "passenger_count": 27
                        },
                        {
                            "bus_plate": "29B02403",
                            "passenger_count": 5
                        },
                        {
                            "bus_plate": "29B02404",
                            "passenger_count": 23
                        },
                        {
                            "bus_plate": "29B02405",
                            "passenger_count": 22
                        }
                    ]
                },
                {
                    "time": "2024:06:05 11:10:00",
                    "buses": [
                        {
                            "bus_plate": "29B02401",
                            "passenger_count": 13
                        },
                        {
                            "bus_plate": "29B02402",
                            "passenger_count": 29
                        },
                        {
                            "bus_plate": "29B02403",
                            "passenger_count": 24
                        },
                        {
                            "bus_plate": "29B02404",
                            "passenger_count": 7
                        },
                        {
                            "bus_plate": "29B02405",
                            "passenger_count": 8
                        }
                    ]
                },
                {
                    "time": "2024:06:05 11:05:00",
                    "buses": [
                        {
                            "bus_plate": "29B02401",
                            "passenger_count": 12
                        },
                        {
                            "bus_plate": "29B02402",
                            "passenger_count": 7
                        },
                        {
                            "bus_plate": "29B02403",
                            "passenger_count": 30
                        },
                        {
                            "bus_plate": "29B02404",
                            "passenger_count": 30
                        },
                        {
                            "bus_plate": "29B02405",
                            "passenger_count": 1
                        }
                    ]
                },
                {
                    "time": "2024:06:05 11:00:00",
                    "buses": [
                        {
                            "bus_plate": "29B02401",
                            "passenger_count": 14
                        },
                        {
                            "bus_plate": "29B02402",
                            "passenger_count": 14
                        },
                        {
                            "bus_plate": "29B02403",
                            "passenger_count": 7
                        },
                        {
                            "bus_plate": "29B02404",
                            "passenger_count": 8
                        },
                        {
                            "bus_plate": "29B02405",
                            "passenger_count": 24
                        }
                    ]
                },
                {
                    "time": "2024:06:05 10:55:00",
                    "buses": [
                        {
                            "bus_plate": "29B02401",
                            "passenger_count": 17
                        },
                        {
                            "bus_plate": "29B02402",
                            "passenger_count": 29
                        },
                        {
                            "bus_plate": "29B02403",
                            "passenger_count": 20
                        },
                        {
                            "bus_plate": "29B02404",
                            "passenger_count": 10
                        },
                        {
                            "bus_plate": "29B02405",
                            "passenger_count": 1
                        }
                    ]
                },
                {
                    "time": "2024:06:05 10:50:00",
                    "buses": [
                        {
                            "bus_plate": "29B02401",
                            "passenger_count": 1
                        },
                        {
                            "bus_plate": "29B02402",
                            "passenger_count": 3
                        },
                        {
                            "bus_plate": "29B02403",
                            "passenger_count": 23
                        },
                        {
                            "bus_plate": "29B02404",
                            "passenger_count": 15
                        },
                        {
                            "bus_plate": "29B02405",
                            "passenger_count": 25
                        }
                    ]
                },
                {
                    "time": "2024:06:05 10:45:00",
                    "buses": [
                        {
                            "bus_plate": "29B02401",
                            "passenger_count": 11
                        },
                        {
                            "bus_plate": "29B02402",
                            "passenger_count": 20
                        },
                        {
                            "bus_plate": "29B02403",
                            "passenger_count": 29
                        },
                        {
                            "bus_plate": "29B02404",
                            "passenger_count": 30
                        },
                        {
                            "bus_plate": "29B02405",
                            "passenger_count": 10
                        }
                    ]
                },
                {
                    "time": "2024:06:05 10:40:00",
                    "buses": [
                        {
                            "bus_plate": "29B02401",
                            "passenger_count": 10
                        },
                        {
                            "bus_plate": "29B02402",
                            "passenger_count": 5
                        },
                        {
                            "bus_plate": "29B02403",
                            "passenger_count": 13
                        },
                        {
                            "bus_plate": "29B02404",
                            "passenger_count": 19
                        },
                        {
                            "bus_plate": "29B02405",
                            "passenger_count": 21
                        }
                    ]
                },
                {
                    "time": "2024:06:05 10:35:00",
                    "buses": [
                        {
                            "bus_plate": "29B02401",
                            "passenger_count": 15
                        },
                        {
                            "bus_plate": "29B02402",
                            "passenger_count": 15
                        },
                        {
                            "bus_plate": "29B02403",
                            "passenger_count": 11
                        },
                        {
                            "bus_plate": "29B02404",
                            "passenger_count": 13
                        },
                        {
                            "bus_plate": "29B02405",
                            "passenger_count": 30
                        }
                    ]
                },
                {
                    "time": "2024:06:05 10:30:00",
                    "buses": [
                        {
                            "bus_plate": "29B02401",
                            "passenger_count": 4
                        },
                        {
                            "bus_plate": "29B02402",
                            "passenger_count": 3
                        },
                        {
                            "bus_plate": "29B02403",
                            "passenger_count": 14
                        },
                        {
                            "bus_plate": "29B02404",
                            "passenger_count": 28
                        },
                        {
                            "bus_plate": "29B02405",
                            "passenger_count": 16
                        }
                    ]
                },
                {
                    "time": "2024:06:05 10:25:00",
                    "buses": [
                        {
                            "bus_plate": "29B02401",
                            "passenger_count": 19
                        },
                        {
                            "bus_plate": "29B02402",
                            "passenger_count": 17
                        },
                        {
                            "bus_plate": "29B02403",
                            "passenger_count": 29
                        },
                        {
                            "bus_plate": "29B02404",
                            "passenger_count": 1
                        },
                        {
                            "bus_plate": "29B02405",
                            "passenger_count": 9
                        }
                    ]
                },
                {
                    "time": "2024:06:05 10:20:00",
                    "buses": [
                        {
                            "bus_plate": "29B02401",
                            "passenger_count": 17
                        },
                        {
                            "bus_plate": "29B02402",
                            "passenger_count": 24
                        },
                        {
                            "bus_plate": "29B02403",
                            "passenger_count": 21
                        },
                        {
                            "bus_plate": "29B02404",
                            "passenger_count": 25
                        },
                        {
                            "bus_plate": "29B02405",
                            "passenger_count": 15
                        }
                    ]
                },
                {
                    "time": "2024:06:05 10:15:00",
                    "buses": [
                        {
                            "bus_plate": "29B02401",
                            "passenger_count": 24
                        },
                        {
                            "bus_plate": "29B02402",
                            "passenger_count": 5
                        },
                        {
                            "bus_plate": "29B02403",
                            "passenger_count": 26
                        },
                        {
                            "bus_plate": "29B02404",
                            "passenger_count": 5
                        },
                        {
                            "bus_plate": "29B02405",
                            "passenger_count": 1
                        }
                    ]
                },
                {
                    "time": "2024:06:05 10:10:00",
                    "buses": [
                        {
                            "bus_plate": "29B02401",
                            "passenger_count": 8
                        },
                        {
                            "bus_plate": "29B02402",
                            "passenger_count": 16
                        },
                        {
                            "bus_plate": "29B02403",
                            "passenger_count": 25
                        },
                        {
                            "bus_plate": "29B02404",
                            "passenger_count": 27
                        },
                        {
                            "bus_plate": "29B02405",
                            "passenger_count": 29
                        }
                    ]
                },
                {
                    "time": "2024:06:05 10:05:00",
                    "buses": [
                        {
                            "bus_plate": "29B02401",
                            "passenger_count": 8
                        },
                        {
                            "bus_plate": "29B02402",
                            "passenger_count": 7
                        },
                        {
                            "bus_plate": "29B02403",
                            "passenger_count": 30
                        },
                        {
                            "bus_plate": "29B02404",
                            "passenger_count": 25
                        },
                        {
                            "bus_plate": "29B02405",
                            "passenger_count": 12
                        }
                    ]
                },
                {
                    "time": "2024:06:05 10:00:00",
                    "buses": [
                        {
                            "bus_plate": "29B02401",
                            "passenger_count": 7
                        },
                        {
                            "bus_plate": "29B02402",
                            "passenger_count": 25
                        },
                        {
                            "bus_plate": "29B02403",
                            "passenger_count": 11
                        },
                        {
                            "bus_plate": "29B02404",
                            "passenger_count": 8
                        },
                        {
                            "bus_plate": "29B02405",
                            "passenger_count": 22
                        }
                    ]
                },
                {
                    "time": "2024:06:05 09:55:00",
                    "buses": [
                        {
                            "bus_plate": "29B02401",
                            "passenger_count": 19
                        },
                        {
                            "bus_plate": "29B02402",
                            "passenger_count": 27
                        },
                        {
                            "bus_plate": "29B02403",
                            "passenger_count": 5
                        },
                        {
                            "bus_plate": "29B02404",
                            "passenger_count": 23
                        },
                        {
                            "bus_plate": "29B02405",
                            "passenger_count": 30
                        }
                    ]
                },
                {
                    "time": "2024:06:05 09:50:00",
                    "buses": [
                        {
                            "bus_plate": "29B02401",
                            "passenger_count": 18
                        },
                        {
                            "bus_plate": "29B02402",
                            "passenger_count": 19
                        },
                        {
                            "bus_plate": "29B02403",
                            "passenger_count": 23
                        },
                        {
                            "bus_plate": "29B02404",
                            "passenger_count": 11
                        },
                        {
                            "bus_plate": "29B02405",
                            "passenger_count": 19
                        }
                    ]
                },
                {
                    "time": "2024:06:05 09:45:00",
                    "buses": [
                        {
                            "bus_plate": "29B02401",
                            "passenger_count": 9
                        },
                        {
                            "bus_plate": "29B02402",
                            "passenger_count": 18
                        },
                        {
                            "bus_plate": "29B02403",
                            "passenger_count": 8
                        },
                        {
                            "bus_plate": "29B02404",
                            "passenger_count": 13
                        },
                        {
                            "bus_plate": "29B02405",
                            "passenger_count": 13
                        }
                    ]
                },
                {
                    "time": "2024:06:05 09:40:00",
                    "buses": [
                        {
                            "bus_plate": "29B02401",
                            "passenger_count": 22
                        },
                        {
                            "bus_plate": "29B02402",
                            "passenger_count": 2
                        },
                        {
                            "bus_plate": "29B02403",
                            "passenger_count": 28
                        },
                        {
                            "bus_plate": "29B02404",
                            "passenger_count": 19
                        },
                        {
                            "bus_plate": "29B02405",
                            "passenger_count": 6
                        }
                    ]
                },
                {
                    "time": "2024:06:05 09:35:00",
                    "buses": [
                        {
                            "bus_plate": "29B02401",
                            "passenger_count": 8
                        },
                        {
                            "bus_plate": "29B02402",
                            "passenger_count": 13
                        },
                        {
                            "bus_plate": "29B02403",
                            "passenger_count": 29
                        },
                        {
                            "bus_plate": "29B02404",
                            "passenger_count": 29
                        },
                        {
                            "bus_plate": "29B02405",
                            "passenger_count": 10
                        }
                    ]
                },
                {
                    "time": "2024:06:05 09:30:00",
                    "buses": [
                        {
                            "bus_plate": "29B02401",
                            "passenger_count": 22
                        },
                        {
                            "bus_plate": "29B02402",
                            "passenger_count": 28
                        },
                        {
                            "bus_plate": "29B02403",
                            "passenger_count": 4
                        },
                        {
                            "bus_plate": "29B02404",
                            "passenger_count": 8
                        },
                        {
                            "bus_plate": "29B02405",
                            "passenger_count": 6
                        }
                    ]
                },
                {
                    "time": "2024:06:05 09:25:00",
                    "buses": [
                        {
                            "bus_plate": "29B02401",
                            "passenger_count": 23
                        },
                        {
                            "bus_plate": "29B02402",
                            "passenger_count": 1
                        },
                        {
                            "bus_plate": "29B02403",
                            "passenger_count": 12
                        },
                        {
                            "bus_plate": "29B02404",
                            "passenger_count": 12
                        },
                        {
                            "bus_plate": "29B02405",
                            "passenger_count": 27
                        }
                    ]
                },
                {
                    "time": "2024:06:05 09:20:00",
                    "buses": [
                        {
                            "bus_plate": "29B02401",
                            "passenger_count": 19
                        },
                        {
                            "bus_plate": "29B02402",
                            "passenger_count": 12
                        },
                        {
                            "bus_plate": "29B02403",
                            "passenger_count": 19
                        },
                        {
                            "bus_plate": "29B02404",
                            "passenger_count": 18
                        },
                        {
                            "bus_plate": "29B02405",
                            "passenger_count": 25
                        }
                    ]
                },
                {
                    "time": "2024:06:05 09:15:00",
                    "buses": [
                        {
                            "bus_plate": "29B02401",
                            "passenger_count": 20
                        },
                        {
                            "bus_plate": "29B02402",
                            "passenger_count": 9
                        },
                        {
                            "bus_plate": "29B02403",
                            "passenger_count": 3
                        },
                        {
                            "bus_plate": "29B02404",
                            "passenger_count": 21
                        },
                        {
                            "bus_plate": "29B02405",
                            "passenger_count": 17
                        }
                    ]
                },
                {
                    "time": "2024:06:05 09:10:00",
                    "buses": [
                        {
                            "bus_plate": "29B02401",
                            "passenger_count": 13
                        },
                        {
                            "bus_plate": "29B02402",
                            "passenger_count": 30
                        },
                        {
                            "bus_plate": "29B02403",
                            "passenger_count": 6
                        },
                        {
                            "bus_plate": "29B02404",
                            "passenger_count": 26
                        },
                        {
                            "bus_plate": "29B02405",
                            "passenger_count": 25
                        }
                    ]
                },
                {
                    "time": "2024:06:05 09:05:00",
                    "buses": [
                        {
                            "bus_plate": "29B02401",
                            "passenger_count": 19
                        },
                        {
                            "bus_plate": "29B02402",
                            "passenger_count": 20
                        },
                        {
                            "bus_plate": "29B02403",
                            "passenger_count": 25
                        },
                        {
                            "bus_plate": "29B02404",
                            "passenger_count": 15
                        },
                        {
                            "bus_plate": "29B02405",
                            "passenger_count": 5
                        }
                    ]
                }
            ]
        },
        {
            "route": "25",
            "total_passenger": 2607,
            "graph_data": [
                {
                    "time": "2024:06:05 12:00:00",
                    "buses": [
                        {
                            "bus_plate": "29B02501",
                            "passenger_count": 4
                        },
                        {
                            "bus_plate": "29B02502",
                            "passenger_count": 28
                        },
                        {
                            "bus_plate": "29B02503",
                            "passenger_count": 3
                        },
                        {
                            "bus_plate": "29B02504",
                            "passenger_count": 3
                        },
                        {
                            "bus_plate": "29B02505",
                            "passenger_count": 22
                        }
                    ]
                },
                {
                    "time": "2024:06:05 11:55:00",
                    "buses": [
                        {
                            "bus_plate": "29B02501",
                            "passenger_count": 26
                        },
                        {
                            "bus_plate": "29B02502",
                            "passenger_count": 7
                        },
                        {
                            "bus_plate": "29B02503",
                            "passenger_count": 28
                        },
                        {
                            "bus_plate": "29B02504",
                            "passenger_count": 25
                        },
                        {
                            "bus_plate": "29B02505",
                            "passenger_count": 21
                        }
                    ]
                },
                {
                    "time": "2024:06:05 11:50:00",
                    "buses": [
                        {
                            "bus_plate": "29B02501",
                            "passenger_count": 12
                        },
                        {
                            "bus_plate": "29B02502",
                            "passenger_count": 26
                        },
                        {
                            "bus_plate": "29B02503",
                            "passenger_count": 27
                        },
                        {
                            "bus_plate": "29B02504",
                            "passenger_count": 29
                        },
                        {
                            "bus_plate": "29B02505",
                            "passenger_count": 18
                        }
                    ]
                },
                {
                    "time": "2024:06:05 11:45:00",
                    "buses": [
                        {
                            "bus_plate": "29B02501",
                            "passenger_count": 12
                        },
                        {
                            "bus_plate": "29B02502",
                            "passenger_count": 11
                        },
                        {
                            "bus_plate": "29B02503",
                            "passenger_count": 5
                        },
                        {
                            "bus_plate": "29B02504",
                            "passenger_count": 24
                        },
                        {
                            "bus_plate": "29B02505",
                            "passenger_count": 3
                        }
                    ]
                },
                {
                    "time": "2024:06:05 11:40:00",
                    "buses": [
                        {
                            "bus_plate": "29B02501",
                            "passenger_count": 2
                        },
                        {
                            "bus_plate": "29B02502",
                            "passenger_count": 20
                        },
                        {
                            "bus_plate": "29B02503",
                            "passenger_count": 18
                        },
                        {
                            "bus_plate": "29B02504",
                            "passenger_count": 3
                        },
                        {
                            "bus_plate": "29B02505",
                            "passenger_count": 18
                        }
                    ]
                },
                {
                    "time": "2024:06:05 11:35:00",
                    "buses": [
                        {
                            "bus_plate": "29B02501",
                            "passenger_count": 19
                        },
                        {
                            "bus_plate": "29B02502",
                            "passenger_count": 21
                        },
                        {
                            "bus_plate": "29B02503",
                            "passenger_count": 3
                        },
                        {
                            "bus_plate": "29B02504",
                            "passenger_count": 25
                        },
                        {
                            "bus_plate": "29B02505",
                            "passenger_count": 10
                        }
                    ]
                },
                {
                    "time": "2024:06:05 11:30:00",
                    "buses": [
                        {
                            "bus_plate": "29B02501",
                            "passenger_count": 9
                        },
                        {
                            "bus_plate": "29B02502",
                            "passenger_count": 24
                        },
                        {
                            "bus_plate": "29B02503",
                            "passenger_count": 13
                        },
                        {
                            "bus_plate": "29B02504",
                            "passenger_count": 16
                        },
                        {
                            "bus_plate": "29B02505",
                            "passenger_count": 3
                        }
                    ]
                },
                {
                    "time": "2024:06:05 11:25:00",
                    "buses": [
                        {
                            "bus_plate": "29B02501",
                            "passenger_count": 26
                        },
                        {
                            "bus_plate": "29B02502",
                            "passenger_count": 6
                        },
                        {
                            "bus_plate": "29B02503",
                            "passenger_count": 22
                        },
                        {
                            "bus_plate": "29B02504",
                            "passenger_count": 21
                        },
                        {
                            "bus_plate": "29B02505",
                            "passenger_count": 6
                        }
                    ]
                },
                {
                    "time": "2024:06:05 11:20:00",
                    "buses": [
                        {
                            "bus_plate": "29B02501",
                            "passenger_count": 25
                        },
                        {
                            "bus_plate": "29B02502",
                            "passenger_count": 12
                        },
                        {
                            "bus_plate": "29B02503",
                            "passenger_count": 22
                        },
                        {
                            "bus_plate": "29B02504",
                            "passenger_count": 9
                        },
                        {
                            "bus_plate": "29B02505",
                            "passenger_count": 9
                        }
                    ]
                },
                {
                    "time": "2024:06:05 11:15:00",
                    "buses": [
                        {
                            "bus_plate": "29B02501",
                            "passenger_count": 29
                        },
                        {
                            "bus_plate": "29B02502",
                            "passenger_count": 3
                        },
                        {
                            "bus_plate": "29B02503",
                            "passenger_count": 9
                        },
                        {
                            "bus_plate": "29B02504",
                            "passenger_count": 15
                        },
                        {
                            "bus_plate": "29B02505",
                            "passenger_count": 8
                        }
                    ]
                },
                {
                    "time": "2024:06:05 11:10:00",
                    "buses": [
                        {
                            "bus_plate": "29B02501",
                            "passenger_count": 5
                        },
                        {
                            "bus_plate": "29B02502",
                            "passenger_count": 10
                        },
                        {
                            "bus_plate": "29B02503",
                            "passenger_count": 26
                        },
                        {
                            "bus_plate": "29B02504",
                            "passenger_count": 25
                        },
                        {
                            "bus_plate": "29B02505",
                            "passenger_count": 23
                        }
                    ]
                },
                {
                    "time": "2024:06:05 11:05:00",
                    "buses": [
                        {
                            "bus_plate": "29B02501",
                            "passenger_count": 11
                        },
                        {
                            "bus_plate": "29B02502",
                            "passenger_count": 11
                        },
                        {
                            "bus_plate": "29B02503",
                            "passenger_count": 13
                        },
                        {
                            "bus_plate": "29B02504",
                            "passenger_count": 1
                        },
                        {
                            "bus_plate": "29B02505",
                            "passenger_count": 14
                        }
                    ]
                },
                {
                    "time": "2024:06:05 11:00:00",
                    "buses": [
                        {
                            "bus_plate": "29B02501",
                            "passenger_count": 28
                        },
                        {
                            "bus_plate": "29B02502",
                            "passenger_count": 25
                        },
                        {
                            "bus_plate": "29B02503",
                            "passenger_count": 2
                        },
                        {
                            "bus_plate": "29B02504",
                            "passenger_count": 29
                        },
                        {
                            "bus_plate": "29B02505",
                            "passenger_count": 8
                        }
                    ]
                },
                {
                    "time": "2024:06:05 10:55:00",
                    "buses": [
                        {
                            "bus_plate": "29B02501",
                            "passenger_count": 18
                        },
                        {
                            "bus_plate": "29B02502",
                            "passenger_count": 27
                        },
                        {
                            "bus_plate": "29B02503",
                            "passenger_count": 14
                        },
                        {
                            "bus_plate": "29B02504",
                            "passenger_count": 9
                        },
                        {
                            "bus_plate": "29B02505",
                            "passenger_count": 15
                        }
                    ]
                },
                {
                    "time": "2024:06:05 10:50:00",
                    "buses": [
                        {
                            "bus_plate": "29B02501",
                            "passenger_count": 5
                        },
                        {
                            "bus_plate": "29B02502",
                            "passenger_count": 5
                        },
                        {
                            "bus_plate": "29B02503",
                            "passenger_count": 28
                        },
                        {
                            "bus_plate": "29B02504",
                            "passenger_count": 22
                        },
                        {
                            "bus_plate": "29B02505",
                            "passenger_count": 4
                        }
                    ]
                },
                {
                    "time": "2024:06:05 10:45:00",
                    "buses": [
                        {
                            "bus_plate": "29B02501",
                            "passenger_count": 17
                        },
                        {
                            "bus_plate": "29B02502",
                            "passenger_count": 5
                        },
                        {
                            "bus_plate": "29B02503",
                            "passenger_count": 6
                        },
                        {
                            "bus_plate": "29B02504",
                            "passenger_count": 20
                        },
                        {
                            "bus_plate": "29B02505",
                            "passenger_count": 3
                        }
                    ]
                },
                {
                    "time": "2024:06:05 10:40:00",
                    "buses": [
                        {
                            "bus_plate": "29B02501",
                            "passenger_count": 12
                        },
                        {
                            "bus_plate": "29B02502",
                            "passenger_count": 9
                        },
                        {
                            "bus_plate": "29B02503",
                            "passenger_count": 10
                        },
                        {
                            "bus_plate": "29B02504",
                            "passenger_count": 4
                        },
                        {
                            "bus_plate": "29B02505",
                            "passenger_count": 5
                        }
                    ]
                },
                {
                    "time": "2024:06:05 10:35:00",
                    "buses": [
                        {
                            "bus_plate": "29B02501",
                            "passenger_count": 14
                        },
                        {
                            "bus_plate": "29B02502",
                            "passenger_count": 11
                        },
                        {
                            "bus_plate": "29B02503",
                            "passenger_count": 12
                        },
                        {
                            "bus_plate": "29B02504",
                            "passenger_count": 24
                        },
                        {
                            "bus_plate": "29B02505",
                            "passenger_count": 25
                        }
                    ]
                },
                {
                    "time": "2024:06:05 10:30:00",
                    "buses": [
                        {
                            "bus_plate": "29B02501",
                            "passenger_count": 29
                        },
                        {
                            "bus_plate": "29B02502",
                            "passenger_count": 1
                        },
                        {
                            "bus_plate": "29B02503",
                            "passenger_count": 20
                        },
                        {
                            "bus_plate": "29B02504",
                            "passenger_count": 13
                        },
                        {
                            "bus_plate": "29B02505",
                            "passenger_count": 15
                        }
                    ]
                },
                {
                    "time": "2024:06:05 10:25:00",
                    "buses": [
                        {
                            "bus_plate": "29B02501",
                            "passenger_count": 23
                        },
                        {
                            "bus_plate": "29B02502",
                            "passenger_count": 30
                        },
                        {
                            "bus_plate": "29B02503",
                            "passenger_count": 18
                        },
                        {
                            "bus_plate": "29B02504",
                            "passenger_count": 4
                        },
                        {
                            "bus_plate": "29B02505",
                            "passenger_count": 12
                        }
                    ]
                },
                {
                    "time": "2024:06:05 10:20:00",
                    "buses": [
                        {
                            "bus_plate": "29B02501",
                            "passenger_count": 3
                        },
                        {
                            "bus_plate": "29B02502",
                            "passenger_count": 27
                        },
                        {
                            "bus_plate": "29B02503",
                            "passenger_count": 2
                        },
                        {
                            "bus_plate": "29B02504",
                            "passenger_count": 18
                        },
                        {
                            "bus_plate": "29B02505",
                            "passenger_count": 4
                        }
                    ]
                },
                {
                    "time": "2024:06:05 10:15:00",
                    "buses": [
                        {
                            "bus_plate": "29B02501",
                            "passenger_count": 27
                        },
                        {
                            "bus_plate": "29B02502",
                            "passenger_count": 13
                        },
                        {
                            "bus_plate": "29B02503",
                            "passenger_count": 6
                        },
                        {
                            "bus_plate": "29B02504",
                            "passenger_count": 15
                        },
                        {
                            "bus_plate": "29B02505",
                            "passenger_count": 26
                        }
                    ]
                },
                {
                    "time": "2024:06:05 10:10:00",
                    "buses": [
                        {
                            "bus_plate": "29B02501",
                            "passenger_count": 29
                        },
                        {
                            "bus_plate": "29B02502",
                            "passenger_count": 23
                        },
                        {
                            "bus_plate": "29B02503",
                            "passenger_count": 13
                        },
                        {
                            "bus_plate": "29B02504",
                            "passenger_count": 24
                        },
                        {
                            "bus_plate": "29B02505",
                            "passenger_count": 21
                        }
                    ]
                },
                {
                    "time": "2024:06:05 10:05:00",
                    "buses": [
                        {
                            "bus_plate": "29B02501",
                            "passenger_count": 3
                        },
                        {
                            "bus_plate": "29B02502",
                            "passenger_count": 27
                        },
                        {
                            "bus_plate": "29B02503",
                            "passenger_count": 2
                        },
                        {
                            "bus_plate": "29B02504",
                            "passenger_count": 3
                        },
                        {
                            "bus_plate": "29B02505",
                            "passenger_count": 26
                        }
                    ]
                },
                {
                    "time": "2024:06:05 10:00:00",
                    "buses": [
                        {
                            "bus_plate": "29B02501",
                            "passenger_count": 25
                        },
                        {
                            "bus_plate": "29B02502",
                            "passenger_count": 4
                        },
                        {
                            "bus_plate": "29B02503",
                            "passenger_count": 18
                        },
                        {
                            "bus_plate": "29B02504",
                            "passenger_count": 19
                        },
                        {
                            "bus_plate": "29B02505",
                            "passenger_count": 13
                        }
                    ]
                },
                {
                    "time": "2024:06:05 09:55:00",
                    "buses": [
                        {
                            "bus_plate": "29B02501",
                            "passenger_count": 8
                        },
                        {
                            "bus_plate": "29B02502",
                            "passenger_count": 15
                        },
                        {
                            "bus_plate": "29B02503",
                            "passenger_count": 5
                        },
                        {
                            "bus_plate": "29B02504",
                            "passenger_count": 9
                        },
                        {
                            "bus_plate": "29B02505",
                            "passenger_count": 2
                        }
                    ]
                },
                {
                    "time": "2024:06:05 09:50:00",
                    "buses": [
                        {
                            "bus_plate": "29B02501",
                            "passenger_count": 27
                        },
                        {
                            "bus_plate": "29B02502",
                            "passenger_count": 4
                        },
                        {
                            "bus_plate": "29B02503",
                            "passenger_count": 5
                        },
                        {
                            "bus_plate": "29B02504",
                            "passenger_count": 14
                        },
                        {
                            "bus_plate": "29B02505",
                            "passenger_count": 17
                        }
                    ]
                },
                {
                    "time": "2024:06:05 09:45:00",
                    "buses": [
                        {
                            "bus_plate": "29B02501",
                            "passenger_count": 6
                        },
                        {
                            "bus_plate": "29B02502",
                            "passenger_count": 23
                        },
                        {
                            "bus_plate": "29B02503",
                            "passenger_count": 24
                        },
                        {
                            "bus_plate": "29B02504",
                            "passenger_count": 10
                        },
                        {
                            "bus_plate": "29B02505",
                            "passenger_count": 6
                        }
                    ]
                },
                {
                    "time": "2024:06:05 09:40:00",
                    "buses": [
                        {
                            "bus_plate": "29B02501",
                            "passenger_count": 11
                        },
                        {
                            "bus_plate": "29B02502",
                            "passenger_count": 30
                        },
                        {
                            "bus_plate": "29B02503",
                            "passenger_count": 15
                        },
                        {
                            "bus_plate": "29B02504",
                            "passenger_count": 2
                        },
                        {
                            "bus_plate": "29B02505",
                            "passenger_count": 6
                        }
                    ]
                },
                {
                    "time": "2024:06:05 09:35:00",
                    "buses": [
                        {
                            "bus_plate": "29B02501",
                            "passenger_count": 25
                        },
                        {
                            "bus_plate": "29B02502",
                            "passenger_count": 11
                        },
                        {
                            "bus_plate": "29B02503",
                            "passenger_count": 3
                        },
                        {
                            "bus_plate": "29B02504",
                            "passenger_count": 26
                        },
                        {
                            "bus_plate": "29B02505",
                            "passenger_count": 29
                        }
                    ]
                },
                {
                    "time": "2024:06:05 09:30:00",
                    "buses": [
                        {
                            "bus_plate": "29B02501",
                            "passenger_count": 17
                        },
                        {
                            "bus_plate": "29B02502",
                            "passenger_count": 29
                        },
                        {
                            "bus_plate": "29B02503",
                            "passenger_count": 2
                        },
                        {
                            "bus_plate": "29B02504",
                            "passenger_count": 27
                        },
                        {
                            "bus_plate": "29B02505",
                            "passenger_count": 16
                        }
                    ]
                },
                {
                    "time": "2024:06:05 09:25:00",
                    "buses": [
                        {
                            "bus_plate": "29B02501",
                            "passenger_count": 28
                        },
                        {
                            "bus_plate": "29B02502",
                            "passenger_count": 5
                        },
                        {
                            "bus_plate": "29B02503",
                            "passenger_count": 12
                        },
                        {
                            "bus_plate": "29B02504",
                            "passenger_count": 1
                        },
                        {
                            "bus_plate": "29B02505",
                            "passenger_count": 8
                        }
                    ]
                },
                {
                    "time": "2024:06:05 09:20:00",
                    "buses": [
                        {
                            "bus_plate": "29B02501",
                            "passenger_count": 9
                        },
                        {
                            "bus_plate": "29B02502",
                            "passenger_count": 21
                        },
                        {
                            "bus_plate": "29B02503",
                            "passenger_count": 3
                        },
                        {
                            "bus_plate": "29B02504",
                            "passenger_count": 1
                        },
                        {
                            "bus_plate": "29B02505",
                            "passenger_count": 15
                        }
                    ]
                },
                {
                    "time": "2024:06:05 09:15:00",
                    "buses": [
                        {
                            "bus_plate": "29B02501",
                            "passenger_count": 11
                        },
                        {
                            "bus_plate": "29B02502",
                            "passenger_count": 7
                        },
                        {
                            "bus_plate": "29B02503",
                            "passenger_count": 23
                        },
                        {
                            "bus_plate": "29B02504",
                            "passenger_count": 21
                        },
                        {
                            "bus_plate": "29B02505",
                            "passenger_count": 26
                        }
                    ]
                },
                {
                    "time": "2024:06:05 09:10:00",
                    "buses": [
                        {
                            "bus_plate": "29B02501",
                            "passenger_count": 15
                        },
                        {
                            "bus_plate": "29B02502",
                            "passenger_count": 22
                        },
                        {
                            "bus_plate": "29B02503",
                            "passenger_count": 1
                        },
                        {
                            "bus_plate": "29B02504",
                            "passenger_count": 6
                        },
                        {
                            "bus_plate": "29B02505",
                            "passenger_count": 13
                        }
                    ]
                },
                {
                    "time": "2024:06:05 09:05:00",
                    "buses": [
                        {
                            "bus_plate": "29B02501",
                            "passenger_count": 26
                        },
                        {
                            "bus_plate": "29B02502",
                            "passenger_count": 10
                        },
                        {
                            "bus_plate": "29B02503",
                            "passenger_count": 15
                        },
                        {
                            "bus_plate": "29B02504",
                            "passenger_count": 3
                        },
                        {
                            "bus_plate": "29B02505",
                            "passenger_count": 10
                        }
                    ]
                }
            ]
        },
        {
            "route": "26",
            "total_passenger": 2761,
            "graph_data": [
                {
                    "time": "2024:06:05 12:00:00",
                    "buses": [
                        {
                            "bus_plate": "29B02601",
                            "passenger_count": 16
                        },
                        {
                            "bus_plate": "29B02602",
                            "passenger_count": 25
                        },
                        {
                            "bus_plate": "29B02603",
                            "passenger_count": 17
                        },
                        {
                            "bus_plate": "29B02604",
                            "passenger_count": 8
                        },
                        {
                            "bus_plate": "29B02605",
                            "passenger_count": 5
                        }
                    ]
                },
                {
                    "time": "2024:06:05 11:55:00",
                    "buses": [
                        {
                            "bus_plate": "29B02601",
                            "passenger_count": 28
                        },
                        {
                            "bus_plate": "29B02602",
                            "passenger_count": 3
                        },
                        {
                            "bus_plate": "29B02603",
                            "passenger_count": 19
                        },
                        {
                            "bus_plate": "29B02604",
                            "passenger_count": 29
                        },
                        {
                            "bus_plate": "29B02605",
                            "passenger_count": 6
                        }
                    ]
                },
                {
                    "time": "2024:06:05 11:50:00",
                    "buses": [
                        {
                            "bus_plate": "29B02601",
                            "passenger_count": 6
                        },
                        {
                            "bus_plate": "29B02602",
                            "passenger_count": 17
                        },
                        {
                            "bus_plate": "29B02603",
                            "passenger_count": 10
                        },
                        {
                            "bus_plate": "29B02604",
                            "passenger_count": 18
                        },
                        {
                            "bus_plate": "29B02605",
                            "passenger_count": 4
                        }
                    ]
                },
                {
                    "time": "2024:06:05 11:45:00",
                    "buses": [
                        {
                            "bus_plate": "29B02601",
                            "passenger_count": 15
                        },
                        {
                            "bus_plate": "29B02602",
                            "passenger_count": 14
                        },
                        {
                            "bus_plate": "29B02603",
                            "passenger_count": 27
                        },
                        {
                            "bus_plate": "29B02604",
                            "passenger_count": 5
                        },
                        {
                            "bus_plate": "29B02605",
                            "passenger_count": 5
                        }
                    ]
                },
                {
                    "time": "2024:06:05 11:40:00",
                    "buses": [
                        {
                            "bus_plate": "29B02601",
                            "passenger_count": 12
                        },
                        {
                            "bus_plate": "29B02602",
                            "passenger_count": 8
                        },
                        {
                            "bus_plate": "29B02603",
                            "passenger_count": 20
                        },
                        {
                            "bus_plate": "29B02604",
                            "passenger_count": 25
                        },
                        {
                            "bus_plate": "29B02605",
                            "passenger_count": 21
                        }
                    ]
                },
                {
                    "time": "2024:06:05 11:35:00",
                    "buses": [
                        {
                            "bus_plate": "29B02601",
                            "passenger_count": 11
                        },
                        {
                            "bus_plate": "29B02602",
                            "passenger_count": 27
                        },
                        {
                            "bus_plate": "29B02603",
                            "passenger_count": 21
                        },
                        {
                            "bus_plate": "29B02604",
                            "passenger_count": 27
                        },
                        {
                            "bus_plate": "29B02605",
                            "passenger_count": 18
                        }
                    ]
                },
                {
                    "time": "2024:06:05 11:30:00",
                    "buses": [
                        {
                            "bus_plate": "29B02601",
                            "passenger_count": 28
                        },
                        {
                            "bus_plate": "29B02602",
                            "passenger_count": 27
                        },
                        {
                            "bus_plate": "29B02603",
                            "passenger_count": 16
                        },
                        {
                            "bus_plate": "29B02604",
                            "passenger_count": 9
                        },
                        {
                            "bus_plate": "29B02605",
                            "passenger_count": 29
                        }
                    ]
                },
                {
                    "time": "2024:06:05 11:25:00",
                    "buses": [
                        {
                            "bus_plate": "29B02601",
                            "passenger_count": 7
                        },
                        {
                            "bus_plate": "29B02602",
                            "passenger_count": 8
                        },
                        {
                            "bus_plate": "29B02603",
                            "passenger_count": 24
                        },
                        {
                            "bus_plate": "29B02604",
                            "passenger_count": 10
                        },
                        {
                            "bus_plate": "29B02605",
                            "passenger_count": 8
                        }
                    ]
                },
                {
                    "time": "2024:06:05 11:20:00",
                    "buses": [
                        {
                            "bus_plate": "29B02601",
                            "passenger_count": 8
                        },
                        {
                            "bus_plate": "29B02602",
                            "passenger_count": 11
                        },
                        {
                            "bus_plate": "29B02603",
                            "passenger_count": 23
                        },
                        {
                            "bus_plate": "29B02604",
                            "passenger_count": 14
                        },
                        {
                            "bus_plate": "29B02605",
                            "passenger_count": 22
                        }
                    ]
                },
                {
                    "time": "2024:06:05 11:15:00",
                    "buses": [
                        {
                            "bus_plate": "29B02601",
                            "passenger_count": 20
                        },
                        {
                            "bus_plate": "29B02602",
                            "passenger_count": 26
                        },
                        {
                            "bus_plate": "29B02603",
                            "passenger_count": 2
                        },
                        {
                            "bus_plate": "29B02604",
                            "passenger_count": 1
                        },
                        {
                            "bus_plate": "29B02605",
                            "passenger_count": 16
                        }
                    ]
                },
                {
                    "time": "2024:06:05 11:10:00",
                    "buses": [
                        {
                            "bus_plate": "29B02601",
                            "passenger_count": 9
                        },
                        {
                            "bus_plate": "29B02602",
                            "passenger_count": 12
                        },
                        {
                            "bus_plate": "29B02603",
                            "passenger_count": 17
                        },
                        {
                            "bus_plate": "29B02604",
                            "passenger_count": 3
                        },
                        {
                            "bus_plate": "29B02605",
                            "passenger_count": 7
                        }
                    ]
                },
                {
                    "time": "2024:06:05 11:05:00",
                    "buses": [
                        {
                            "bus_plate": "29B02601",
                            "passenger_count": 13
                        },
                        {
                            "bus_plate": "29B02602",
                            "passenger_count": 6
                        },
                        {
                            "bus_plate": "29B02603",
                            "passenger_count": 18
                        },
                        {
                            "bus_plate": "29B02604",
                            "passenger_count": 12
                        },
                        {
                            "bus_plate": "29B02605",
                            "passenger_count": 21
                        }
                    ]
                },
                {
                    "time": "2024:06:05 11:00:00",
                    "buses": [
                        {
                            "bus_plate": "29B02601",
                            "passenger_count": 14
                        },
                        {
                            "bus_plate": "29B02602",
                            "passenger_count": 27
                        },
                        {
                            "bus_plate": "29B02603",
                            "passenger_count": 8
                        },
                        {
                            "bus_plate": "29B02604",
                            "passenger_count": 28
                        },
                        {
                            "bus_plate": "29B02605",
                            "passenger_count": 15
                        }
                    ]
                },
                {
                    "time": "2024:06:05 10:55:00",
                    "buses": [
                        {
                            "bus_plate": "29B02601",
                            "passenger_count": 18
                        },
                        {
                            "bus_plate": "29B02602",
                            "passenger_count": 12
                        },
                        {
                            "bus_plate": "29B02603",
                            "passenger_count": 27
                        },
                        {
                            "bus_plate": "29B02604",
                            "passenger_count": 14
                        },
                        {
                            "bus_plate": "29B02605",
                            "passenger_count": 28
                        }
                    ]
                },
                {
                    "time": "2024:06:05 10:50:00",
                    "buses": [
                        {
                            "bus_plate": "29B02601",
                            "passenger_count": 12
                        },
                        {
                            "bus_plate": "29B02602",
                            "passenger_count": 10
                        },
                        {
                            "bus_plate": "29B02603",
                            "passenger_count": 27
                        },
                        {
                            "bus_plate": "29B02604",
                            "passenger_count": 28
                        },
                        {
                            "bus_plate": "29B02605",
                            "passenger_count": 9
                        }
                    ]
                },
                {
                    "time": "2024:06:05 10:45:00",
                    "buses": [
                        {
                            "bus_plate": "29B02601",
                            "passenger_count": 6
                        },
                        {
                            "bus_plate": "29B02602",
                            "passenger_count": 2
                        },
                        {
                            "bus_plate": "29B02603",
                            "passenger_count": 5
                        },
                        {
                            "bus_plate": "29B02604",
                            "passenger_count": 16
                        },
                        {
                            "bus_plate": "29B02605",
                            "passenger_count": 10
                        }
                    ]
                },
                {
                    "time": "2024:06:05 10:40:00",
                    "buses": [
                        {
                            "bus_plate": "29B02601",
                            "passenger_count": 24
                        },
                        {
                            "bus_plate": "29B02602",
                            "passenger_count": 22
                        },
                        {
                            "bus_plate": "29B02603",
                            "passenger_count": 10
                        },
                        {
                            "bus_plate": "29B02604",
                            "passenger_count": 23
                        },
                        {
                            "bus_plate": "29B02605",
                            "passenger_count": 20
                        }
                    ]
                },
                {
                    "time": "2024:06:05 10:35:00",
                    "buses": [
                        {
                            "bus_plate": "29B02601",
                            "passenger_count": 7
                        },
                        {
                            "bus_plate": "29B02602",
                            "passenger_count": 4
                        },
                        {
                            "bus_plate": "29B02603",
                            "passenger_count": 1
                        },
                        {
                            "bus_plate": "29B02604",
                            "passenger_count": 17
                        },
                        {
                            "bus_plate": "29B02605",
                            "passenger_count": 19
                        }
                    ]
                },
                {
                    "time": "2024:06:05 10:30:00",
                    "buses": [
                        {
                            "bus_plate": "29B02601",
                            "passenger_count": 26
                        },
                        {
                            "bus_plate": "29B02602",
                            "passenger_count": 1
                        },
                        {
                            "bus_plate": "29B02603",
                            "passenger_count": 29
                        },
                        {
                            "bus_plate": "29B02604",
                            "passenger_count": 22
                        },
                        {
                            "bus_plate": "29B02605",
                            "passenger_count": 30
                        }
                    ]
                },
                {
                    "time": "2024:06:05 10:25:00",
                    "buses": [
                        {
                            "bus_plate": "29B02601",
                            "passenger_count": 18
                        },
                        {
                            "bus_plate": "29B02602",
                            "passenger_count": 4
                        },
                        {
                            "bus_plate": "29B02603",
                            "passenger_count": 20
                        },
                        {
                            "bus_plate": "29B02604",
                            "passenger_count": 25
                        },
                        {
                            "bus_plate": "29B02605",
                            "passenger_count": 11
                        }
                    ]
                },
                {
                    "time": "2024:06:05 10:20:00",
                    "buses": [
                        {
                            "bus_plate": "29B02601",
                            "passenger_count": 4
                        },
                        {
                            "bus_plate": "29B02602",
                            "passenger_count": 3
                        },
                        {
                            "bus_plate": "29B02603",
                            "passenger_count": 29
                        },
                        {
                            "bus_plate": "29B02604",
                            "passenger_count": 26
                        },
                        {
                            "bus_plate": "29B02605",
                            "passenger_count": 10
                        }
                    ]
                },
                {
                    "time": "2024:06:05 10:15:00",
                    "buses": [
                        {
                            "bus_plate": "29B02601",
                            "passenger_count": 12
                        },
                        {
                            "bus_plate": "29B02602",
                            "passenger_count": 7
                        },
                        {
                            "bus_plate": "29B02603",
                            "passenger_count": 2
                        },
                        {
                            "bus_plate": "29B02604",
                            "passenger_count": 25
                        },
                        {
                            "bus_plate": "29B02605",
                            "passenger_count": 3
                        }
                    ]
                },
                {
                    "time": "2024:06:05 10:10:00",
                    "buses": [
                        {
                            "bus_plate": "29B02601",
                            "passenger_count": 6
                        },
                        {
                            "bus_plate": "29B02602",
                            "passenger_count": 28
                        },
                        {
                            "bus_plate": "29B02603",
                            "passenger_count": 4
                        },
                        {
                            "bus_plate": "29B02604",
                            "passenger_count": 14
                        },
                        {
                            "bus_plate": "29B02605",
                            "passenger_count": 14
                        }
                    ]
                },
                {
                    "time": "2024:06:05 10:05:00",
                    "buses": [
                        {
                            "bus_plate": "29B02601",
                            "passenger_count": 29
                        },
                        {
                            "bus_plate": "29B02602",
                            "passenger_count": 4
                        },
                        {
                            "bus_plate": "29B02603",
                            "passenger_count": 23
                        },
                        {
                            "bus_plate": "29B02604",
                            "passenger_count": 15
                        },
                        {
                            "bus_plate": "29B02605",
                            "passenger_count": 23
                        }
                    ]
                },
                {
                    "time": "2024:06:05 10:00:00",
                    "buses": [
                        {
                            "bus_plate": "29B02601",
                            "passenger_count": 11
                        },
                        {
                            "bus_plate": "29B02602",
                            "passenger_count": 22
                        },
                        {
                            "bus_plate": "29B02603",
                            "passenger_count": 23
                        },
                        {
                            "bus_plate": "29B02604",
                            "passenger_count": 7
                        },
                        {
                            "bus_plate": "29B02605",
                            "passenger_count": 6
                        }
                    ]
                },
                {
                    "time": "2024:06:05 09:55:00",
                    "buses": [
                        {
                            "bus_plate": "29B02601",
                            "passenger_count": 26
                        },
                        {
                            "bus_plate": "29B02602",
                            "passenger_count": 28
                        },
                        {
                            "bus_plate": "29B02603",
                            "passenger_count": 14
                        },
                        {
                            "bus_plate": "29B02604",
                            "passenger_count": 14
                        },
                        {
                            "bus_plate": "29B02605",
                            "passenger_count": 18
                        }
                    ]
                },
                {
                    "time": "2024:06:05 09:50:00",
                    "buses": [
                        {
                            "bus_plate": "29B02601",
                            "passenger_count": 1
                        },
                        {
                            "bus_plate": "29B02602",
                            "passenger_count": 19
                        },
                        {
                            "bus_plate": "29B02603",
                            "passenger_count": 4
                        },
                        {
                            "bus_plate": "29B02604",
                            "passenger_count": 22
                        },
                        {
                            "bus_plate": "29B02605",
                            "passenger_count": 28
                        }
                    ]
                },
                {
                    "time": "2024:06:05 09:45:00",
                    "buses": [
                        {
                            "bus_plate": "29B02601",
                            "passenger_count": 9
                        },
                        {
                            "bus_plate": "29B02602",
                            "passenger_count": 11
                        },
                        {
                            "bus_plate": "29B02603",
                            "passenger_count": 4
                        },
                        {
                            "bus_plate": "29B02604",
                            "passenger_count": 13
                        },
                        {
                            "bus_plate": "29B02605",
                            "passenger_count": 24
                        }
                    ]
                },
                {
                    "time": "2024:06:05 09:40:00",
                    "buses": [
                        {
                            "bus_plate": "29B02601",
                            "passenger_count": 10
                        },
                        {
                            "bus_plate": "29B02602",
                            "passenger_count": 19
                        },
                        {
                            "bus_plate": "29B02603",
                            "passenger_count": 6
                        },
                        {
                            "bus_plate": "29B02604",
                            "passenger_count": 29
                        },
                        {
                            "bus_plate": "29B02605",
                            "passenger_count": 2
                        }
                    ]
                },
                {
                    "time": "2024:06:05 09:35:00",
                    "buses": [
                        {
                            "bus_plate": "29B02601",
                            "passenger_count": 25
                        },
                        {
                            "bus_plate": "29B02602",
                            "passenger_count": 18
                        },
                        {
                            "bus_plate": "29B02603",
                            "passenger_count": 27
                        },
                        {
                            "bus_plate": "29B02604",
                            "passenger_count": 19
                        },
                        {
                            "bus_plate": "29B02605",
                            "passenger_count": 10
                        }
                    ]
                },
                {
                    "time": "2024:06:05 09:30:00",
                    "buses": [
                        {
                            "bus_plate": "29B02601",
                            "passenger_count": 24
                        },
                        {
                            "bus_plate": "29B02602",
                            "passenger_count": 8
                        },
                        {
                            "bus_plate": "29B02603",
                            "passenger_count": 14
                        },
                        {
                            "bus_plate": "29B02604",
                            "passenger_count": 4
                        },
                        {
                            "bus_plate": "29B02605",
                            "passenger_count": 29
                        }
                    ]
                },
                {
                    "time": "2024:06:05 09:25:00",
                    "buses": [
                        {
                            "bus_plate": "29B02601",
                            "passenger_count": 11
                        },
                        {
                            "bus_plate": "29B02602",
                            "passenger_count": 14
                        },
                        {
                            "bus_plate": "29B02603",
                            "passenger_count": 30
                        },
                        {
                            "bus_plate": "29B02604",
                            "passenger_count": 25
                        },
                        {
                            "bus_plate": "29B02605",
                            "passenger_count": 6
                        }
                    ]
                },
                {
                    "time": "2024:06:05 09:20:00",
                    "buses": [
                        {
                            "bus_plate": "29B02601",
                            "passenger_count": 2
                        },
                        {
                            "bus_plate": "29B02602",
                            "passenger_count": 29
                        },
                        {
                            "bus_plate": "29B02603",
                            "passenger_count": 3
                        },
                        {
                            "bus_plate": "29B02604",
                            "passenger_count": 20
                        },
                        {
                            "bus_plate": "29B02605",
                            "passenger_count": 3
                        }
                    ]
                },
                {
                    "time": "2024:06:05 09:15:00",
                    "buses": [
                        {
                            "bus_plate": "29B02601",
                            "passenger_count": 15
                        },
                        {
                            "bus_plate": "29B02602",
                            "passenger_count": 2
                        },
                        {
                            "bus_plate": "29B02603",
                            "passenger_count": 16
                        },
                        {
                            "bus_plate": "29B02604",
                            "passenger_count": 6
                        },
                        {
                            "bus_plate": "29B02605",
                            "passenger_count": 20
                        }
                    ]
                },
                {
                    "time": "2024:06:05 09:10:00",
                    "buses": [
                        {
                            "bus_plate": "29B02601",
                            "passenger_count": 7
                        },
                        {
                            "bus_plate": "29B02602",
                            "passenger_count": 25
                        },
                        {
                            "bus_plate": "29B02603",
                            "passenger_count": 1
                        },
                        {
                            "bus_plate": "29B02604",
                            "passenger_count": 22
                        },
                        {
                            "bus_plate": "29B02605",
                            "passenger_count": 28
                        }
                    ]
                },
                {
                    "time": "2024:06:05 09:05:00",
                    "buses": [
                        {
                            "bus_plate": "29B02601",
                            "passenger_count": 30
                        },
                        {
                            "bus_plate": "29B02602",
                            "passenger_count": 16
                        },
                        {
                            "bus_plate": "29B02603",
                            "passenger_count": 25
                        },
                        {
                            "bus_plate": "29B02604",
                            "passenger_count": 18
                        },
                        {
                            "bus_plate": "29B02605",
                            "passenger_count": 15
                        }
                    ]
                }
            ]
        },
        {
            "route": "27",
            "total_passenger": 2778,
            "graph_data": [
                {
                    "time": "2024:06:05 12:00:00",
                    "buses": [
                        {
                            "bus_plate": "29B02701",
                            "passenger_count": 23
                        },
                        {
                            "bus_plate": "29B02702",
                            "passenger_count": 16
                        },
                        {
                            "bus_plate": "29B02703",
                            "passenger_count": 19
                        },
                        {
                            "bus_plate": "29B02704",
                            "passenger_count": 9
                        },
                        {
                            "bus_plate": "29B02705",
                            "passenger_count": 18
                        }
                    ]
                },
                {
                    "time": "2024:06:05 11:55:00",
                    "buses": [
                        {
                            "bus_plate": "29B02701",
                            "passenger_count": 27
                        },
                        {
                            "bus_plate": "29B02702",
                            "passenger_count": 23
                        },
                        {
                            "bus_plate": "29B02703",
                            "passenger_count": 17
                        },
                        {
                            "bus_plate": "29B02704",
                            "passenger_count": 13
                        },
                        {
                            "bus_plate": "29B02705",
                            "passenger_count": 11
                        }
                    ]
                },
                {
                    "time": "2024:06:05 11:50:00",
                    "buses": [
                        {
                            "bus_plate": "29B02701",
                            "passenger_count": 6
                        },
                        {
                            "bus_plate": "29B02702",
                            "passenger_count": 6
                        },
                        {
                            "bus_plate": "29B02703",
                            "passenger_count": 11
                        },
                        {
                            "bus_plate": "29B02704",
                            "passenger_count": 18
                        },
                        {
                            "bus_plate": "29B02705",
                            "passenger_count": 9
                        }
                    ]
                },
                {
                    "time": "2024:06:05 11:45:00",
                    "buses": [
                        {
                            "bus_plate": "29B02701",
                            "passenger_count": 3
                        },
                        {
                            "bus_plate": "29B02702",
                            "passenger_count": 30
                        },
                        {
                            "bus_plate": "29B02703",
                            "passenger_count": 20
                        },
                        {
                            "bus_plate": "29B02704",
                            "passenger_count": 20
                        },
                        {
                            "bus_plate": "29B02705",
                            "passenger_count": 28
                        }
                    ]
                },
                {
                    "time": "2024:06:05 11:40:00",
                    "buses": [
                        {
                            "bus_plate": "29B02701",
                            "passenger_count": 27
                        },
                        {
                            "bus_plate": "29B02702",
                            "passenger_count": 14
                        },
                        {
                            "bus_plate": "29B02703",
                            "passenger_count": 5
                        },
                        {
                            "bus_plate": "29B02704",
                            "passenger_count": 4
                        },
                        {
                            "bus_plate": "29B02705",
                            "passenger_count": 11
                        }
                    ]
                },
                {
                    "time": "2024:06:05 11:35:00",
                    "buses": [
                        {
                            "bus_plate": "29B02701",
                            "passenger_count": 18
                        },
                        {
                            "bus_plate": "29B02702",
                            "passenger_count": 17
                        },
                        {
                            "bus_plate": "29B02703",
                            "passenger_count": 27
                        },
                        {
                            "bus_plate": "29B02704",
                            "passenger_count": 3
                        },
                        {
                            "bus_plate": "29B02705",
                            "passenger_count": 16
                        }
                    ]
                },
                {
                    "time": "2024:06:05 11:30:00",
                    "buses": [
                        {
                            "bus_plate": "29B02701",
                            "passenger_count": 26
                        },
                        {
                            "bus_plate": "29B02702",
                            "passenger_count": 23
                        },
                        {
                            "bus_plate": "29B02703",
                            "passenger_count": 21
                        },
                        {
                            "bus_plate": "29B02704",
                            "passenger_count": 12
                        },
                        {
                            "bus_plate": "29B02705",
                            "passenger_count": 9
                        }
                    ]
                },
                {
                    "time": "2024:06:05 11:25:00",
                    "buses": [
                        {
                            "bus_plate": "29B02701",
                            "passenger_count": 21
                        },
                        {
                            "bus_plate": "29B02702",
                            "passenger_count": 30
                        },
                        {
                            "bus_plate": "29B02703",
                            "passenger_count": 28
                        },
                        {
                            "bus_plate": "29B02704",
                            "passenger_count": 24
                        },
                        {
                            "bus_plate": "29B02705",
                            "passenger_count": 18
                        }
                    ]
                },
                {
                    "time": "2024:06:05 11:20:00",
                    "buses": [
                        {
                            "bus_plate": "29B02701",
                            "passenger_count": 30
                        },
                        {
                            "bus_plate": "29B02702",
                            "passenger_count": 4
                        },
                        {
                            "bus_plate": "29B02703",
                            "passenger_count": 19
                        },
                        {
                            "bus_plate": "29B02704",
                            "passenger_count": 26
                        },
                        {
                            "bus_plate": "29B02705",
                            "passenger_count": 26
                        }
                    ]
                },
                {
                    "time": "2024:06:05 11:15:00",
                    "buses": [
                        {
                            "bus_plate": "29B02701",
                            "passenger_count": 8
                        },
                        {
                            "bus_plate": "29B02702",
                            "passenger_count": 14
                        },
                        {
                            "bus_plate": "29B02703",
                            "passenger_count": 8
                        },
                        {
                            "bus_plate": "29B02704",
                            "passenger_count": 17
                        },
                        {
                            "bus_plate": "29B02705",
                            "passenger_count": 12
                        }
                    ]
                },
                {
                    "time": "2024:06:05 11:10:00",
                    "buses": [
                        {
                            "bus_plate": "29B02701",
                            "passenger_count": 6
                        },
                        {
                            "bus_plate": "29B02702",
                            "passenger_count": 15
                        },
                        {
                            "bus_plate": "29B02703",
                            "passenger_count": 28
                        },
                        {
                            "bus_plate": "29B02704",
                            "passenger_count": 6
                        },
                        {
                            "bus_plate": "29B02705",
                            "passenger_count": 17
                        }
                    ]
                },
                {
                    "time": "2024:06:05 11:05:00",
                    "buses": [
                        {
                            "bus_plate": "29B02701",
                            "passenger_count": 11
                        },
                        {
                            "bus_plate": "29B02702",
                            "passenger_count": 6
                        },
                        {
                            "bus_plate": "29B02703",
                            "passenger_count": 23
                        },
                        {
                            "bus_plate": "29B02704",
                            "passenger_count": 21
                        },
                        {
                            "bus_plate": "29B02705",
                            "passenger_count": 23
                        }
                    ]
                },
                {
                    "time": "2024:06:05 11:00:00",
                    "buses": [
                        {
                            "bus_plate": "29B02701",
                            "passenger_count": 5
                        },
                        {
                            "bus_plate": "29B02702",
                            "passenger_count": 2
                        },
                        {
                            "bus_plate": "29B02703",
                            "passenger_count": 5
                        },
                        {
                            "bus_plate": "29B02704",
                            "passenger_count": 16
                        },
                        {
                            "bus_plate": "29B02705",
                            "passenger_count": 27
                        }
                    ]
                },
                {
                    "time": "2024:06:05 10:55:00",
                    "buses": [
                        {
                            "bus_plate": "29B02701",
                            "passenger_count": 6
                        },
                        {
                            "bus_plate": "29B02702",
                            "passenger_count": 28
                        },
                        {
                            "bus_plate": "29B02703",
                            "passenger_count": 8
                        },
                        {
                            "bus_plate": "29B02704",
                            "passenger_count": 13
                        },
                        {
                            "bus_plate": "29B02705",
                            "passenger_count": 24
                        }
                    ]
                },
                {
                    "time": "2024:06:05 10:50:00",
                    "buses": [
                        {
                            "bus_plate": "29B02701",
                            "passenger_count": 12
                        },
                        {
                            "bus_plate": "29B02702",
                            "passenger_count": 15
                        },
                        {
                            "bus_plate": "29B02703",
                            "passenger_count": 19
                        },
                        {
                            "bus_plate": "29B02704",
                            "passenger_count": 11
                        },
                        {
                            "bus_plate": "29B02705",
                            "passenger_count": 3
                        }
                    ]
                },
                {
                    "time": "2024:06:05 10:45:00",
                    "buses": [
                        {
                            "bus_plate": "29B02701",
                            "passenger_count": 22
                        },
                        {
                            "bus_plate": "29B02702",
                            "passenger_count": 13
                        },
                        {
                            "bus_plate": "29B02703",
                            "passenger_count": 29
                        },
                        {
                            "bus_plate": "29B02704",
                            "passenger_count": 7
                        },
                        {
                            "bus_plate": "29B02705",
                            "passenger_count": 21
                        }
                    ]
                },
                {
                    "time": "2024:06:05 10:40:00",
                    "buses": [
                        {
                            "bus_plate": "29B02701",
                            "passenger_count": 17
                        },
                        {
                            "bus_plate": "29B02702",
                            "passenger_count": 9
                        },
                        {
                            "bus_plate": "29B02703",
                            "passenger_count": 17
                        },
                        {
                            "bus_plate": "29B02704",
                            "passenger_count": 3
                        },
                        {
                            "bus_plate": "29B02705",
                            "passenger_count": 28
                        }
                    ]
                },
                {
                    "time": "2024:06:05 10:35:00",
                    "buses": [
                        {
                            "bus_plate": "29B02701",
                            "passenger_count": 10
                        },
                        {
                            "bus_plate": "29B02702",
                            "passenger_count": 6
                        },
                        {
                            "bus_plate": "29B02703",
                            "passenger_count": 20
                        },
                        {
                            "bus_plate": "29B02704",
                            "passenger_count": 8
                        },
                        {
                            "bus_plate": "29B02705",
                            "passenger_count": 9
                        }
                    ]
                },
                {
                    "time": "2024:06:05 10:30:00",
                    "buses": [
                        {
                            "bus_plate": "29B02701",
                            "passenger_count": 5
                        },
                        {
                            "bus_plate": "29B02702",
                            "passenger_count": 19
                        },
                        {
                            "bus_plate": "29B02703",
                            "passenger_count": 11
                        },
                        {
                            "bus_plate": "29B02704",
                            "passenger_count": 19
                        },
                        {
                            "bus_plate": "29B02705",
                            "passenger_count": 10
                        }
                    ]
                },
                {
                    "time": "2024:06:05 10:25:00",
                    "buses": [
                        {
                            "bus_plate": "29B02701",
                            "passenger_count": 19
                        },
                        {
                            "bus_plate": "29B02702",
                            "passenger_count": 9
                        },
                        {
                            "bus_plate": "29B02703",
                            "passenger_count": 29
                        },
                        {
                            "bus_plate": "29B02704",
                            "passenger_count": 7
                        },
                        {
                            "bus_plate": "29B02705",
                            "passenger_count": 3
                        }
                    ]
                },
                {
                    "time": "2024:06:05 10:20:00",
                    "buses": [
                        {
                            "bus_plate": "29B02701",
                            "passenger_count": 24
                        },
                        {
                            "bus_plate": "29B02702",
                            "passenger_count": 18
                        },
                        {
                            "bus_plate": "29B02703",
                            "passenger_count": 25
                        },
                        {
                            "bus_plate": "29B02704",
                            "passenger_count": 29
                        },
                        {
                            "bus_plate": "29B02705",
                            "passenger_count": 13
                        }
                    ]
                },
                {
                    "time": "2024:06:05 10:15:00",
                    "buses": [
                        {
                            "bus_plate": "29B02701",
                            "passenger_count": 19
                        },
                        {
                            "bus_plate": "29B02702",
                            "passenger_count": 12
                        },
                        {
                            "bus_plate": "29B02703",
                            "passenger_count": 19
                        },
                        {
                            "bus_plate": "29B02704",
                            "passenger_count": 7
                        },
                        {
                            "bus_plate": "29B02705",
                            "passenger_count": 25
                        }
                    ]
                },
                {
                    "time": "2024:06:05 10:10:00",
                    "buses": [
                        {
                            "bus_plate": "29B02701",
                            "passenger_count": 8
                        },
                        {
                            "bus_plate": "29B02702",
                            "passenger_count": 18
                        },
                        {
                            "bus_plate": "29B02703",
                            "passenger_count": 20
                        },
                        {
                            "bus_plate": "29B02704",
                            "passenger_count": 5
                        },
                        {
                            "bus_plate": "29B02705",
                            "passenger_count": 27
                        }
                    ]
                },
                {
                    "time": "2024:06:05 10:05:00",
                    "buses": [
                        {
                            "bus_plate": "29B02701",
                            "passenger_count": 14
                        },
                        {
                            "bus_plate": "29B02702",
                            "passenger_count": 23
                        },
                        {
                            "bus_plate": "29B02703",
                            "passenger_count": 27
                        },
                        {
                            "bus_plate": "29B02704",
                            "passenger_count": 26
                        },
                        {
                            "bus_plate": "29B02705",
                            "passenger_count": 15
                        }
                    ]
                },
                {
                    "time": "2024:06:05 10:00:00",
                    "buses": [
                        {
                            "bus_plate": "29B02701",
                            "passenger_count": 30
                        },
                        {
                            "bus_plate": "29B02702",
                            "passenger_count": 2
                        },
                        {
                            "bus_plate": "29B02703",
                            "passenger_count": 9
                        },
                        {
                            "bus_plate": "29B02704",
                            "passenger_count": 9
                        },
                        {
                            "bus_plate": "29B02705",
                            "passenger_count": 12
                        }
                    ]
                },
                {
                    "time": "2024:06:05 09:55:00",
                    "buses": [
                        {
                            "bus_plate": "29B02701",
                            "passenger_count": 6
                        },
                        {
                            "bus_plate": "29B02702",
                            "passenger_count": 6
                        },
                        {
                            "bus_plate": "29B02703",
                            "passenger_count": 14
                        },
                        {
                            "bus_plate": "29B02704",
                            "passenger_count": 21
                        },
                        {
                            "bus_plate": "29B02705",
                            "passenger_count": 13
                        }
                    ]
                },
                {
                    "time": "2024:06:05 09:50:00",
                    "buses": [
                        {
                            "bus_plate": "29B02701",
                            "passenger_count": 22
                        },
                        {
                            "bus_plate": "29B02702",
                            "passenger_count": 9
                        },
                        {
                            "bus_plate": "29B02703",
                            "passenger_count": 7
                        },
                        {
                            "bus_plate": "29B02704",
                            "passenger_count": 26
                        },
                        {
                            "bus_plate": "29B02705",
                            "passenger_count": 2
                        }
                    ]
                },
                {
                    "time": "2024:06:05 09:45:00",
                    "buses": [
                        {
                            "bus_plate": "29B02701",
                            "passenger_count": 10
                        },
                        {
                            "bus_plate": "29B02702",
                            "passenger_count": 19
                        },
                        {
                            "bus_plate": "29B02703",
                            "passenger_count": 28
                        },
                        {
                            "bus_plate": "29B02704",
                            "passenger_count": 21
                        },
                        {
                            "bus_plate": "29B02705",
                            "passenger_count": 20
                        }
                    ]
                },
                {
                    "time": "2024:06:05 09:40:00",
                    "buses": [
                        {
                            "bus_plate": "29B02701",
                            "passenger_count": 8
                        },
                        {
                            "bus_plate": "29B02702",
                            "passenger_count": 29
                        },
                        {
                            "bus_plate": "29B02703",
                            "passenger_count": 3
                        },
                        {
                            "bus_plate": "29B02704",
                            "passenger_count": 7
                        },
                        {
                            "bus_plate": "29B02705",
                            "passenger_count": 15
                        }
                    ]
                },
                {
                    "time": "2024:06:05 09:35:00",
                    "buses": [
                        {
                            "bus_plate": "29B02701",
                            "passenger_count": 14
                        },
                        {
                            "bus_plate": "29B02702",
                            "passenger_count": 10
                        },
                        {
                            "bus_plate": "29B02703",
                            "passenger_count": 26
                        },
                        {
                            "bus_plate": "29B02704",
                            "passenger_count": 12
                        },
                        {
                            "bus_plate": "29B02705",
                            "passenger_count": 8
                        }
                    ]
                },
                {
                    "time": "2024:06:05 09:30:00",
                    "buses": [
                        {
                            "bus_plate": "29B02701",
                            "passenger_count": 1
                        },
                        {
                            "bus_plate": "29B02702",
                            "passenger_count": 30
                        },
                        {
                            "bus_plate": "29B02703",
                            "passenger_count": 16
                        },
                        {
                            "bus_plate": "29B02704",
                            "passenger_count": 3
                        },
                        {
                            "bus_plate": "29B02705",
                            "passenger_count": 17
                        }
                    ]
                },
                {
                    "time": "2024:06:05 09:25:00",
                    "buses": [
                        {
                            "bus_plate": "29B02701",
                            "passenger_count": 2
                        },
                        {
                            "bus_plate": "29B02702",
                            "passenger_count": 5
                        },
                        {
                            "bus_plate": "29B02703",
                            "passenger_count": 22
                        },
                        {
                            "bus_plate": "29B02704",
                            "passenger_count": 25
                        },
                        {
                            "bus_plate": "29B02705",
                            "passenger_count": 18
                        }
                    ]
                },
                {
                    "time": "2024:06:05 09:20:00",
                    "buses": [
                        {
                            "bus_plate": "29B02701",
                            "passenger_count": 10
                        },
                        {
                            "bus_plate": "29B02702",
                            "passenger_count": 29
                        },
                        {
                            "bus_plate": "29B02703",
                            "passenger_count": 9
                        },
                        {
                            "bus_plate": "29B02704",
                            "passenger_count": 22
                        },
                        {
                            "bus_plate": "29B02705",
                            "passenger_count": 7
                        }
                    ]
                },
                {
                    "time": "2024:06:05 09:15:00",
                    "buses": [
                        {
                            "bus_plate": "29B02701",
                            "passenger_count": 25
                        },
                        {
                            "bus_plate": "29B02702",
                            "passenger_count": 6
                        },
                        {
                            "bus_plate": "29B02703",
                            "passenger_count": 21
                        },
                        {
                            "bus_plate": "29B02704",
                            "passenger_count": 15
                        },
                        {
                            "bus_plate": "29B02705",
                            "passenger_count": 8
                        }
                    ]
                },
                {
                    "time": "2024:06:05 09:10:00",
                    "buses": [
                        {
                            "bus_plate": "29B02701",
                            "passenger_count": 2
                        },
                        {
                            "bus_plate": "29B02702",
                            "passenger_count": 27
                        },
                        {
                            "bus_plate": "29B02703",
                            "passenger_count": 11
                        },
                        {
                            "bus_plate": "29B02704",
                            "passenger_count": 21
                        },
                        {
                            "bus_plate": "29B02705",
                            "passenger_count": 29
                        }
                    ]
                },
                {
                    "time": "2024:06:05 09:05:00",
                    "buses": [
                        {
                            "bus_plate": "29B02701",
                            "passenger_count": 10
                        },
                        {
                            "bus_plate": "29B02702",
                            "passenger_count": 8
                        },
                        {
                            "bus_plate": "29B02703",
                            "passenger_count": 3
                        },
                        {
                            "bus_plate": "29B02704",
                            "passenger_count": 10
                        },
                        {
                            "bus_plate": "29B02705",
                            "passenger_count": 29
                        }
                    ]
                }
            ]
        },
        {
            "route": "28",
            "total_passenger": 2590,
            "graph_data": [
                {
                    "time": "2024:06:05 12:00:00",
                    "buses": [
                        {
                            "bus_plate": "29B02801",
                            "passenger_count": 2
                        },
                        {
                            "bus_plate": "29B02802",
                            "passenger_count": 25
                        },
                        {
                            "bus_plate": "29B02803",
                            "passenger_count": 6
                        },
                        {
                            "bus_plate": "29B02804",
                            "passenger_count": 8
                        },
                        {
                            "bus_plate": "29B02805",
                            "passenger_count": 22
                        }
                    ]
                },
                {
                    "time": "2024:06:05 11:55:00",
                    "buses": [
                        {
                            "bus_plate": "29B02801",
                            "passenger_count": 21
                        },
                        {
                            "bus_plate": "29B02802",
                            "passenger_count": 3
                        },
                        {
                            "bus_plate": "29B02803",
                            "passenger_count": 2
                        },
                        {
                            "bus_plate": "29B02804",
                            "passenger_count": 26
                        },
                        {
                            "bus_plate": "29B02805",
                            "passenger_count": 26
                        }
                    ]
                },
                {
                    "time": "2024:06:05 11:50:00",
                    "buses": [
                        {
                            "bus_plate": "29B02801",
                            "passenger_count": 17
                        },
                        {
                            "bus_plate": "29B02802",
                            "passenger_count": 22
                        },
                        {
                            "bus_plate": "29B02803",
                            "passenger_count": 30
                        },
                        {
                            "bus_plate": "29B02804",
                            "passenger_count": 3
                        },
                        {
                            "bus_plate": "29B02805",
                            "passenger_count": 13
                        }
                    ]
                },
                {
                    "time": "2024:06:05 11:45:00",
                    "buses": [
                        {
                            "bus_plate": "29B02801",
                            "passenger_count": 1
                        },
                        {
                            "bus_plate": "29B02802",
                            "passenger_count": 8
                        },
                        {
                            "bus_plate": "29B02803",
                            "passenger_count": 11
                        },
                        {
                            "bus_plate": "29B02804",
                            "passenger_count": 2
                        },
                        {
                            "bus_plate": "29B02805",
                            "passenger_count": 23
                        }
                    ]
                },
                {
                    "time": "2024:06:05 11:40:00",
                    "buses": [
                        {
                            "bus_plate": "29B02801",
                            "passenger_count": 8
                        },
                        {
                            "bus_plate": "29B02802",
                            "passenger_count": 22
                        },
                        {
                            "bus_plate": "29B02803",
                            "passenger_count": 24
                        },
                        {
                            "bus_plate": "29B02804",
                            "passenger_count": 3
                        },
                        {
                            "bus_plate": "29B02805",
                            "passenger_count": 16
                        }
                    ]
                },
                {
                    "time": "2024:06:05 11:35:00",
                    "buses": [
                        {
                            "bus_plate": "29B02801",
                            "passenger_count": 19
                        },
                        {
                            "bus_plate": "29B02802",
                            "passenger_count": 4
                        },
                        {
                            "bus_plate": "29B02803",
                            "passenger_count": 3
                        },
                        {
                            "bus_plate": "29B02804",
                            "passenger_count": 7
                        },
                        {
                            "bus_plate": "29B02805",
                            "passenger_count": 21
                        }
                    ]
                },
                {
                    "time": "2024:06:05 11:30:00",
                    "buses": [
                        {
                            "bus_plate": "29B02801",
                            "passenger_count": 20
                        },
                        {
                            "bus_plate": "29B02802",
                            "passenger_count": 1
                        },
                        {
                            "bus_plate": "29B02803",
                            "passenger_count": 19
                        },
                        {
                            "bus_plate": "29B02804",
                            "passenger_count": 3
                        },
                        {
                            "bus_plate": "29B02805",
                            "passenger_count": 19
                        }
                    ]
                },
                {
                    "time": "2024:06:05 11:25:00",
                    "buses": [
                        {
                            "bus_plate": "29B02801",
                            "passenger_count": 1
                        },
                        {
                            "bus_plate": "29B02802",
                            "passenger_count": 10
                        },
                        {
                            "bus_plate": "29B02803",
                            "passenger_count": 9
                        },
                        {
                            "bus_plate": "29B02804",
                            "passenger_count": 6
                        },
                        {
                            "bus_plate": "29B02805",
                            "passenger_count": 8
                        }
                    ]
                },
                {
                    "time": "2024:06:05 11:20:00",
                    "buses": [
                        {
                            "bus_plate": "29B02801",
                            "passenger_count": 14
                        },
                        {
                            "bus_plate": "29B02802",
                            "passenger_count": 28
                        },
                        {
                            "bus_plate": "29B02803",
                            "passenger_count": 5
                        },
                        {
                            "bus_plate": "29B02804",
                            "passenger_count": 25
                        },
                        {
                            "bus_plate": "29B02805",
                            "passenger_count": 4
                        }
                    ]
                },
                {
                    "time": "2024:06:05 11:15:00",
                    "buses": [
                        {
                            "bus_plate": "29B02801",
                            "passenger_count": 25
                        },
                        {
                            "bus_plate": "29B02802",
                            "passenger_count": 27
                        },
                        {
                            "bus_plate": "29B02803",
                            "passenger_count": 9
                        },
                        {
                            "bus_plate": "29B02804",
                            "passenger_count": 20
                        },
                        {
                            "bus_plate": "29B02805",
                            "passenger_count": 21
                        }
                    ]
                },
                {
                    "time": "2024:06:05 11:10:00",
                    "buses": [
                        {
                            "bus_plate": "29B02801",
                            "passenger_count": 15
                        },
                        {
                            "bus_plate": "29B02802",
                            "passenger_count": 2
                        },
                        {
                            "bus_plate": "29B02803",
                            "passenger_count": 26
                        },
                        {
                            "bus_plate": "29B02804",
                            "passenger_count": 8
                        },
                        {
                            "bus_plate": "29B02805",
                            "passenger_count": 2
                        }
                    ]
                },
                {
                    "time": "2024:06:05 11:05:00",
                    "buses": [
                        {
                            "bus_plate": "29B02801",
                            "passenger_count": 16
                        },
                        {
                            "bus_plate": "29B02802",
                            "passenger_count": 2
                        },
                        {
                            "bus_plate": "29B02803",
                            "passenger_count": 21
                        },
                        {
                            "bus_plate": "29B02804",
                            "passenger_count": 7
                        },
                        {
                            "bus_plate": "29B02805",
                            "passenger_count": 28
                        }
                    ]
                },
                {
                    "time": "2024:06:05 11:00:00",
                    "buses": [
                        {
                            "bus_plate": "29B02801",
                            "passenger_count": 25
                        },
                        {
                            "bus_plate": "29B02802",
                            "passenger_count": 16
                        },
                        {
                            "bus_plate": "29B02803",
                            "passenger_count": 10
                        },
                        {
                            "bus_plate": "29B02804",
                            "passenger_count": 24
                        },
                        {
                            "bus_plate": "29B02805",
                            "passenger_count": 24
                        }
                    ]
                },
                {
                    "time": "2024:06:05 10:55:00",
                    "buses": [
                        {
                            "bus_plate": "29B02801",
                            "passenger_count": 7
                        },
                        {
                            "bus_plate": "29B02802",
                            "passenger_count": 10
                        },
                        {
                            "bus_plate": "29B02803",
                            "passenger_count": 3
                        },
                        {
                            "bus_plate": "29B02804",
                            "passenger_count": 11
                        },
                        {
                            "bus_plate": "29B02805",
                            "passenger_count": 12
                        }
                    ]
                },
                {
                    "time": "2024:06:05 10:50:00",
                    "buses": [
                        {
                            "bus_plate": "29B02801",
                            "passenger_count": 11
                        },
                        {
                            "bus_plate": "29B02802",
                            "passenger_count": 25
                        },
                        {
                            "bus_plate": "29B02803",
                            "passenger_count": 19
                        },
                        {
                            "bus_plate": "29B02804",
                            "passenger_count": 17
                        },
                        {
                            "bus_plate": "29B02805",
                            "passenger_count": 18
                        }
                    ]
                },
                {
                    "time": "2024:06:05 10:45:00",
                    "buses": [
                        {
                            "bus_plate": "29B02801",
                            "passenger_count": 2
                        },
                        {
                            "bus_plate": "29B02802",
                            "passenger_count": 13
                        },
                        {
                            "bus_plate": "29B02803",
                            "passenger_count": 27
                        },
                        {
                            "bus_plate": "29B02804",
                            "passenger_count": 18
                        },
                        {
                            "bus_plate": "29B02805",
                            "passenger_count": 11
                        }
                    ]
                },
                {
                    "time": "2024:06:05 10:40:00",
                    "buses": [
                        {
                            "bus_plate": "29B02801",
                            "passenger_count": 8
                        },
                        {
                            "bus_plate": "29B02802",
                            "passenger_count": 21
                        },
                        {
                            "bus_plate": "29B02803",
                            "passenger_count": 28
                        },
                        {
                            "bus_plate": "29B02804",
                            "passenger_count": 4
                        },
                        {
                            "bus_plate": "29B02805",
                            "passenger_count": 21
                        }
                    ]
                },
                {
                    "time": "2024:06:05 10:35:00",
                    "buses": [
                        {
                            "bus_plate": "29B02801",
                            "passenger_count": 26
                        },
                        {
                            "bus_plate": "29B02802",
                            "passenger_count": 6
                        },
                        {
                            "bus_plate": "29B02803",
                            "passenger_count": 3
                        },
                        {
                            "bus_plate": "29B02804",
                            "passenger_count": 17
                        },
                        {
                            "bus_plate": "29B02805",
                            "passenger_count": 11
                        }
                    ]
                },
                {
                    "time": "2024:06:05 10:30:00",
                    "buses": [
                        {
                            "bus_plate": "29B02801",
                            "passenger_count": 5
                        },
                        {
                            "bus_plate": "29B02802",
                            "passenger_count": 21
                        },
                        {
                            "bus_plate": "29B02803",
                            "passenger_count": 5
                        },
                        {
                            "bus_plate": "29B02804",
                            "passenger_count": 25
                        },
                        {
                            "bus_plate": "29B02805",
                            "passenger_count": 4
                        }
                    ]
                },
                {
                    "time": "2024:06:05 10:25:00",
                    "buses": [
                        {
                            "bus_plate": "29B02801",
                            "passenger_count": 1
                        },
                        {
                            "bus_plate": "29B02802",
                            "passenger_count": 7
                        },
                        {
                            "bus_plate": "29B02803",
                            "passenger_count": 21
                        },
                        {
                            "bus_plate": "29B02804",
                            "passenger_count": 30
                        },
                        {
                            "bus_plate": "29B02805",
                            "passenger_count": 25
                        }
                    ]
                },
                {
                    "time": "2024:06:05 10:20:00",
                    "buses": [
                        {
                            "bus_plate": "29B02801",
                            "passenger_count": 13
                        },
                        {
                            "bus_plate": "29B02802",
                            "passenger_count": 25
                        },
                        {
                            "bus_plate": "29B02803",
                            "passenger_count": 26
                        },
                        {
                            "bus_plate": "29B02804",
                            "passenger_count": 21
                        },
                        {
                            "bus_plate": "29B02805",
                            "passenger_count": 6
                        }
                    ]
                },
                {
                    "time": "2024:06:05 10:15:00",
                    "buses": [
                        {
                            "bus_plate": "29B02801",
                            "passenger_count": 16
                        },
                        {
                            "bus_plate": "29B02802",
                            "passenger_count": 5
                        },
                        {
                            "bus_plate": "29B02803",
                            "passenger_count": 10
                        },
                        {
                            "bus_plate": "29B02804",
                            "passenger_count": 22
                        },
                        {
                            "bus_plate": "29B02805",
                            "passenger_count": 8
                        }
                    ]
                },
                {
                    "time": "2024:06:05 10:10:00",
                    "buses": [
                        {
                            "bus_plate": "29B02801",
                            "passenger_count": 3
                        },
                        {
                            "bus_plate": "29B02802",
                            "passenger_count": 5
                        },
                        {
                            "bus_plate": "29B02803",
                            "passenger_count": 11
                        },
                        {
                            "bus_plate": "29B02804",
                            "passenger_count": 17
                        },
                        {
                            "bus_plate": "29B02805",
                            "passenger_count": 15
                        }
                    ]
                },
                {
                    "time": "2024:06:05 10:05:00",
                    "buses": [
                        {
                            "bus_plate": "29B02801",
                            "passenger_count": 16
                        },
                        {
                            "bus_plate": "29B02802",
                            "passenger_count": 17
                        },
                        {
                            "bus_plate": "29B02803",
                            "passenger_count": 14
                        },
                        {
                            "bus_plate": "29B02804",
                            "passenger_count": 10
                        },
                        {
                            "bus_plate": "29B02805",
                            "passenger_count": 29
                        }
                    ]
                },
                {
                    "time": "2024:06:05 10:00:00",
                    "buses": [
                        {
                            "bus_plate": "29B02801",
                            "passenger_count": 21
                        },
                        {
                            "bus_plate": "29B02802",
                            "passenger_count": 29
                        },
                        {
                            "bus_plate": "29B02803",
                            "passenger_count": 28
                        },
                        {
                            "bus_plate": "29B02804",
                            "passenger_count": 10
                        },
                        {
                            "bus_plate": "29B02805",
                            "passenger_count": 29
                        }
                    ]
                },
                {
                    "time": "2024:06:05 09:55:00",
                    "buses": [
                        {
                            "bus_plate": "29B02801",
                            "passenger_count": 10
                        },
                        {
                            "bus_plate": "29B02802",
                            "passenger_count": 26
                        },
                        {
                            "bus_plate": "29B02803",
                            "passenger_count": 25
                        },
                        {
                            "bus_plate": "29B02804",
                            "passenger_count": 2
                        },
                        {
                            "bus_plate": "29B02805",
                            "passenger_count": 17
                        }
                    ]
                },
                {
                    "time": "2024:06:05 09:50:00",
                    "buses": [
                        {
                            "bus_plate": "29B02801",
                            "passenger_count": 1
                        },
                        {
                            "bus_plate": "29B02802",
                            "passenger_count": 1
                        },
                        {
                            "bus_plate": "29B02803",
                            "passenger_count": 24
                        },
                        {
                            "bus_plate": "29B02804",
                            "passenger_count": 27
                        },
                        {
                            "bus_plate": "29B02805",
                            "passenger_count": 30
                        }
                    ]
                },
                {
                    "time": "2024:06:05 09:45:00",
                    "buses": [
                        {
                            "bus_plate": "29B02801",
                            "passenger_count": 8
                        },
                        {
                            "bus_plate": "29B02802",
                            "passenger_count": 17
                        },
                        {
                            "bus_plate": "29B02803",
                            "passenger_count": 25
                        },
                        {
                            "bus_plate": "29B02804",
                            "passenger_count": 21
                        },
                        {
                            "bus_plate": "29B02805",
                            "passenger_count": 5
                        }
                    ]
                },
                {
                    "time": "2024:06:05 09:40:00",
                    "buses": [
                        {
                            "bus_plate": "29B02801",
                            "passenger_count": 22
                        },
                        {
                            "bus_plate": "29B02802",
                            "passenger_count": 6
                        },
                        {
                            "bus_plate": "29B02803",
                            "passenger_count": 16
                        },
                        {
                            "bus_plate": "29B02804",
                            "passenger_count": 7
                        },
                        {
                            "bus_plate": "29B02805",
                            "passenger_count": 7
                        }
                    ]
                },
                {
                    "time": "2024:06:05 09:35:00",
                    "buses": [
                        {
                            "bus_plate": "29B02801",
                            "passenger_count": 24
                        },
                        {
                            "bus_plate": "29B02802",
                            "passenger_count": 22
                        },
                        {
                            "bus_plate": "29B02803",
                            "passenger_count": 2
                        },
                        {
                            "bus_plate": "29B02804",
                            "passenger_count": 20
                        },
                        {
                            "bus_plate": "29B02805",
                            "passenger_count": 15
                        }
                    ]
                },
                {
                    "time": "2024:06:05 09:30:00",
                    "buses": [
                        {
                            "bus_plate": "29B02801",
                            "passenger_count": 20
                        },
                        {
                            "bus_plate": "29B02802",
                            "passenger_count": 20
                        },
                        {
                            "bus_plate": "29B02803",
                            "passenger_count": 4
                        },
                        {
                            "bus_plate": "29B02804",
                            "passenger_count": 8
                        },
                        {
                            "bus_plate": "29B02805",
                            "passenger_count": 10
                        }
                    ]
                },
                {
                    "time": "2024:06:05 09:25:00",
                    "buses": [
                        {
                            "bus_plate": "29B02801",
                            "passenger_count": 30
                        },
                        {
                            "bus_plate": "29B02802",
                            "passenger_count": 18
                        },
                        {
                            "bus_plate": "29B02803",
                            "passenger_count": 10
                        },
                        {
                            "bus_plate": "29B02804",
                            "passenger_count": 11
                        },
                        {
                            "bus_plate": "29B02805",
                            "passenger_count": 4
                        }
                    ]
                },
                {
                    "time": "2024:06:05 09:20:00",
                    "buses": [
                        {
                            "bus_plate": "29B02801",
                            "passenger_count": 6
                        },
                        {
                            "bus_plate": "29B02802",
                            "passenger_count": 14
                        },
                        {
                            "bus_plate": "29B02803",
                            "passenger_count": 2
                        },
                        {
                            "bus_plate": "29B02804",
                            "passenger_count": 25
                        },
                        {
                            "bus_plate": "29B02805",
                            "passenger_count": 9
                        }
                    ]
                },
                {
                    "time": "2024:06:05 09:15:00",
                    "buses": [
                        {
                            "bus_plate": "29B02801",
                            "passenger_count": 2
                        },
                        {
                            "bus_plate": "29B02802",
                            "passenger_count": 25
                        },
                        {
                            "bus_plate": "29B02803",
                            "passenger_count": 1
                        },
                        {
                            "bus_plate": "29B02804",
                            "passenger_count": 13
                        },
                        {
                            "bus_plate": "29B02805",
                            "passenger_count": 25
                        }
                    ]
                },
                {
                    "time": "2024:06:05 09:10:00",
                    "buses": [
                        {
                            "bus_plate": "29B02801",
                            "passenger_count": 8
                        },
                        {
                            "bus_plate": "29B02802",
                            "passenger_count": 3
                        },
                        {
                            "bus_plate": "29B02803",
                            "passenger_count": 15
                        },
                        {
                            "bus_plate": "29B02804",
                            "passenger_count": 15
                        },
                        {
                            "bus_plate": "29B02805",
                            "passenger_count": 9
                        }
                    ]
                },
                {
                    "time": "2024:06:05 09:05:00",
                    "buses": [
                        {
                            "bus_plate": "29B02801",
                            "passenger_count": 29
                        },
                        {
                            "bus_plate": "29B02802",
                            "passenger_count": 19
                        },
                        {
                            "bus_plate": "29B02803",
                            "passenger_count": 27
                        },
                        {
                            "bus_plate": "29B02804",
                            "passenger_count": 19
                        },
                        {
                            "bus_plate": "29B02805",
                            "passenger_count": 12
                        }
                    ]
                }
            ]
        },
        {
            "route": "29",
            "total_passenger": 3066,
            "graph_data": [
                {
                    "time": "2024:06:05 12:00:00",
                    "buses": [
                        {
                            "bus_plate": "29B02901",
                            "passenger_count": 27
                        },
                        {
                            "bus_plate": "29B02902",
                            "passenger_count": 14
                        },
                        {
                            "bus_plate": "29B02903",
                            "passenger_count": 3
                        },
                        {
                            "bus_plate": "29B02904",
                            "passenger_count": 25
                        },
                        {
                            "bus_plate": "29B02905",
                            "passenger_count": 1
                        }
                    ]
                },
                {
                    "time": "2024:06:05 11:55:00",
                    "buses": [
                        {
                            "bus_plate": "29B02901",
                            "passenger_count": 13
                        },
                        {
                            "bus_plate": "29B02902",
                            "passenger_count": 27
                        },
                        {
                            "bus_plate": "29B02903",
                            "passenger_count": 13
                        },
                        {
                            "bus_plate": "29B02904",
                            "passenger_count": 14
                        },
                        {
                            "bus_plate": "29B02905",
                            "passenger_count": 24
                        }
                    ]
                },
                {
                    "time": "2024:06:05 11:50:00",
                    "buses": [
                        {
                            "bus_plate": "29B02901",
                            "passenger_count": 11
                        },
                        {
                            "bus_plate": "29B02902",
                            "passenger_count": 3
                        },
                        {
                            "bus_plate": "29B02903",
                            "passenger_count": 6
                        },
                        {
                            "bus_plate": "29B02904",
                            "passenger_count": 26
                        },
                        {
                            "bus_plate": "29B02905",
                            "passenger_count": 26
                        }
                    ]
                },
                {
                    "time": "2024:06:05 11:45:00",
                    "buses": [
                        {
                            "bus_plate": "29B02901",
                            "passenger_count": 11
                        },
                        {
                            "bus_plate": "29B02902",
                            "passenger_count": 21
                        },
                        {
                            "bus_plate": "29B02903",
                            "passenger_count": 29
                        },
                        {
                            "bus_plate": "29B02904",
                            "passenger_count": 6
                        },
                        {
                            "bus_plate": "29B02905",
                            "passenger_count": 17
                        }
                    ]
                },
                {
                    "time": "2024:06:05 11:40:00",
                    "buses": [
                        {
                            "bus_plate": "29B02901",
                            "passenger_count": 6
                        },
                        {
                            "bus_plate": "29B02902",
                            "passenger_count": 27
                        },
                        {
                            "bus_plate": "29B02903",
                            "passenger_count": 16
                        },
                        {
                            "bus_plate": "29B02904",
                            "passenger_count": 5
                        },
                        {
                            "bus_plate": "29B02905",
                            "passenger_count": 21
                        }
                    ]
                },
                {
                    "time": "2024:06:05 11:35:00",
                    "buses": [
                        {
                            "bus_plate": "29B02901",
                            "passenger_count": 20
                        },
                        {
                            "bus_plate": "29B02902",
                            "passenger_count": 10
                        },
                        {
                            "bus_plate": "29B02903",
                            "passenger_count": 23
                        },
                        {
                            "bus_plate": "29B02904",
                            "passenger_count": 28
                        },
                        {
                            "bus_plate": "29B02905",
                            "passenger_count": 6
                        }
                    ]
                },
                {
                    "time": "2024:06:05 11:30:00",
                    "buses": [
                        {
                            "bus_plate": "29B02901",
                            "passenger_count": 27
                        },
                        {
                            "bus_plate": "29B02902",
                            "passenger_count": 16
                        },
                        {
                            "bus_plate": "29B02903",
                            "passenger_count": 28
                        },
                        {
                            "bus_plate": "29B02904",
                            "passenger_count": 27
                        },
                        {
                            "bus_plate": "29B02905",
                            "passenger_count": 17
                        }
                    ]
                },
                {
                    "time": "2024:06:05 11:25:00",
                    "buses": [
                        {
                            "bus_plate": "29B02901",
                            "passenger_count": 19
                        },
                        {
                            "bus_plate": "29B02902",
                            "passenger_count": 2
                        },
                        {
                            "bus_plate": "29B02903",
                            "passenger_count": 7
                        },
                        {
                            "bus_plate": "29B02904",
                            "passenger_count": 22
                        },
                        {
                            "bus_plate": "29B02905",
                            "passenger_count": 27
                        }
                    ]
                },
                {
                    "time": "2024:06:05 11:20:00",
                    "buses": [
                        {
                            "bus_plate": "29B02901",
                            "passenger_count": 17
                        },
                        {
                            "bus_plate": "29B02902",
                            "passenger_count": 28
                        },
                        {
                            "bus_plate": "29B02903",
                            "passenger_count": 8
                        },
                        {
                            "bus_plate": "29B02904",
                            "passenger_count": 18
                        },
                        {
                            "bus_plate": "29B02905",
                            "passenger_count": 16
                        }
                    ]
                },
                {
                    "time": "2024:06:05 11:15:00",
                    "buses": [
                        {
                            "bus_plate": "29B02901",
                            "passenger_count": 29
                        },
                        {
                            "bus_plate": "29B02902",
                            "passenger_count": 16
                        },
                        {
                            "bus_plate": "29B02903",
                            "passenger_count": 20
                        },
                        {
                            "bus_plate": "29B02904",
                            "passenger_count": 7
                        },
                        {
                            "bus_plate": "29B02905",
                            "passenger_count": 17
                        }
                    ]
                },
                {
                    "time": "2024:06:05 11:10:00",
                    "buses": [
                        {
                            "bus_plate": "29B02901",
                            "passenger_count": 25
                        },
                        {
                            "bus_plate": "29B02902",
                            "passenger_count": 20
                        },
                        {
                            "bus_plate": "29B02903",
                            "passenger_count": 28
                        },
                        {
                            "bus_plate": "29B02904",
                            "passenger_count": 18
                        },
                        {
                            "bus_plate": "29B02905",
                            "passenger_count": 7
                        }
                    ]
                },
                {
                    "time": "2024:06:05 11:05:00",
                    "buses": [
                        {
                            "bus_plate": "29B02901",
                            "passenger_count": 10
                        },
                        {
                            "bus_plate": "29B02902",
                            "passenger_count": 22
                        },
                        {
                            "bus_plate": "29B02903",
                            "passenger_count": 1
                        },
                        {
                            "bus_plate": "29B02904",
                            "passenger_count": 19
                        },
                        {
                            "bus_plate": "29B02905",
                            "passenger_count": 7
                        }
                    ]
                },
                {
                    "time": "2024:06:05 11:00:00",
                    "buses": [
                        {
                            "bus_plate": "29B02901",
                            "passenger_count": 21
                        },
                        {
                            "bus_plate": "29B02902",
                            "passenger_count": 4
                        },
                        {
                            "bus_plate": "29B02903",
                            "passenger_count": 24
                        },
                        {
                            "bus_plate": "29B02904",
                            "passenger_count": 19
                        },
                        {
                            "bus_plate": "29B02905",
                            "passenger_count": 15
                        }
                    ]
                },
                {
                    "time": "2024:06:05 10:55:00",
                    "buses": [
                        {
                            "bus_plate": "29B02901",
                            "passenger_count": 1
                        },
                        {
                            "bus_plate": "29B02902",
                            "passenger_count": 30
                        },
                        {
                            "bus_plate": "29B02903",
                            "passenger_count": 6
                        },
                        {
                            "bus_plate": "29B02904",
                            "passenger_count": 28
                        },
                        {
                            "bus_plate": "29B02905",
                            "passenger_count": 19
                        }
                    ]
                },
                {
                    "time": "2024:06:05 10:50:00",
                    "buses": [
                        {
                            "bus_plate": "29B02901",
                            "passenger_count": 10
                        },
                        {
                            "bus_plate": "29B02902",
                            "passenger_count": 18
                        },
                        {
                            "bus_plate": "29B02903",
                            "passenger_count": 25
                        },
                        {
                            "bus_plate": "29B02904",
                            "passenger_count": 12
                        },
                        {
                            "bus_plate": "29B02905",
                            "passenger_count": 15
                        }
                    ]
                },
                {
                    "time": "2024:06:05 10:45:00",
                    "buses": [
                        {
                            "bus_plate": "29B02901",
                            "passenger_count": 13
                        },
                        {
                            "bus_plate": "29B02902",
                            "passenger_count": 18
                        },
                        {
                            "bus_plate": "29B02903",
                            "passenger_count": 20
                        },
                        {
                            "bus_plate": "29B02904",
                            "passenger_count": 23
                        },
                        {
                            "bus_plate": "29B02905",
                            "passenger_count": 25
                        }
                    ]
                },
                {
                    "time": "2024:06:05 10:40:00",
                    "buses": [
                        {
                            "bus_plate": "29B02901",
                            "passenger_count": 28
                        },
                        {
                            "bus_plate": "29B02902",
                            "passenger_count": 23
                        },
                        {
                            "bus_plate": "29B02903",
                            "passenger_count": 17
                        },
                        {
                            "bus_plate": "29B02904",
                            "passenger_count": 15
                        },
                        {
                            "bus_plate": "29B02905",
                            "passenger_count": 11
                        }
                    ]
                },
                {
                    "time": "2024:06:05 10:35:00",
                    "buses": [
                        {
                            "bus_plate": "29B02901",
                            "passenger_count": 23
                        },
                        {
                            "bus_plate": "29B02902",
                            "passenger_count": 20
                        },
                        {
                            "bus_plate": "29B02903",
                            "passenger_count": 19
                        },
                        {
                            "bus_plate": "29B02904",
                            "passenger_count": 3
                        },
                        {
                            "bus_plate": "29B02905",
                            "passenger_count": 30
                        }
                    ]
                },
                {
                    "time": "2024:06:05 10:30:00",
                    "buses": [
                        {
                            "bus_plate": "29B02901",
                            "passenger_count": 29
                        },
                        {
                            "bus_plate": "29B02902",
                            "passenger_count": 19
                        },
                        {
                            "bus_plate": "29B02903",
                            "passenger_count": 18
                        },
                        {
                            "bus_plate": "29B02904",
                            "passenger_count": 27
                        },
                        {
                            "bus_plate": "29B02905",
                            "passenger_count": 6
                        }
                    ]
                },
                {
                    "time": "2024:06:05 10:25:00",
                    "buses": [
                        {
                            "bus_plate": "29B02901",
                            "passenger_count": 25
                        },
                        {
                            "bus_plate": "29B02902",
                            "passenger_count": 27
                        },
                        {
                            "bus_plate": "29B02903",
                            "passenger_count": 14
                        },
                        {
                            "bus_plate": "29B02904",
                            "passenger_count": 25
                        },
                        {
                            "bus_plate": "29B02905",
                            "passenger_count": 30
                        }
                    ]
                },
                {
                    "time": "2024:06:05 10:20:00",
                    "buses": [
                        {
                            "bus_plate": "29B02901",
                            "passenger_count": 16
                        },
                        {
                            "bus_plate": "29B02902",
                            "passenger_count": 23
                        },
                        {
                            "bus_plate": "29B02903",
                            "passenger_count": 21
                        },
                        {
                            "bus_plate": "29B02904",
                            "passenger_count": 20
                        },
                        {
                            "bus_plate": "29B02905",
                            "passenger_count": 30
                        }
                    ]
                },
                {
                    "time": "2024:06:05 10:15:00",
                    "buses": [
                        {
                            "bus_plate": "29B02901",
                            "passenger_count": 13
                        },
                        {
                            "bus_plate": "29B02902",
                            "passenger_count": 21
                        },
                        {
                            "bus_plate": "29B02903",
                            "passenger_count": 25
                        },
                        {
                            "bus_plate": "29B02904",
                            "passenger_count": 10
                        },
                        {
                            "bus_plate": "29B02905",
                            "passenger_count": 16
                        }
                    ]
                },
                {
                    "time": "2024:06:05 10:10:00",
                    "buses": [
                        {
                            "bus_plate": "29B02901",
                            "passenger_count": 5
                        },
                        {
                            "bus_plate": "29B02902",
                            "passenger_count": 14
                        },
                        {
                            "bus_plate": "29B02903",
                            "passenger_count": 12
                        },
                        {
                            "bus_plate": "29B02904",
                            "passenger_count": 28
                        },
                        {
                            "bus_plate": "29B02905",
                            "passenger_count": 11
                        }
                    ]
                },
                {
                    "time": "2024:06:05 10:05:00",
                    "buses": [
                        {
                            "bus_plate": "29B02901",
                            "passenger_count": 16
                        },
                        {
                            "bus_plate": "29B02902",
                            "passenger_count": 27
                        },
                        {
                            "bus_plate": "29B02903",
                            "passenger_count": 3
                        },
                        {
                            "bus_plate": "29B02904",
                            "passenger_count": 1
                        },
                        {
                            "bus_plate": "29B02905",
                            "passenger_count": 15
                        }
                    ]
                },
                {
                    "time": "2024:06:05 10:00:00",
                    "buses": [
                        {
                            "bus_plate": "29B02901",
                            "passenger_count": 18
                        },
                        {
                            "bus_plate": "29B02902",
                            "passenger_count": 18
                        },
                        {
                            "bus_plate": "29B02903",
                            "passenger_count": 11
                        },
                        {
                            "bus_plate": "29B02904",
                            "passenger_count": 11
                        },
                        {
                            "bus_plate": "29B02905",
                            "passenger_count": 1
                        }
                    ]
                },
                {
                    "time": "2024:06:05 09:55:00",
                    "buses": [
                        {
                            "bus_plate": "29B02901",
                            "passenger_count": 22
                        },
                        {
                            "bus_plate": "29B02902",
                            "passenger_count": 22
                        },
                        {
                            "bus_plate": "29B02903",
                            "passenger_count": 1
                        },
                        {
                            "bus_plate": "29B02904",
                            "passenger_count": 6
                        },
                        {
                            "bus_plate": "29B02905",
                            "passenger_count": 24
                        }
                    ]
                },
                {
                    "time": "2024:06:05 09:50:00",
                    "buses": [
                        {
                            "bus_plate": "29B02901",
                            "passenger_count": 28
                        },
                        {
                            "bus_plate": "29B02902",
                            "passenger_count": 20
                        },
                        {
                            "bus_plate": "29B02903",
                            "passenger_count": 7
                        },
                        {
                            "bus_plate": "29B02904",
                            "passenger_count": 13
                        },
                        {
                            "bus_plate": "29B02905",
                            "passenger_count": 25
                        }
                    ]
                },
                {
                    "time": "2024:06:05 09:45:00",
                    "buses": [
                        {
                            "bus_plate": "29B02901",
                            "passenger_count": 22
                        },
                        {
                            "bus_plate": "29B02902",
                            "passenger_count": 4
                        },
                        {
                            "bus_plate": "29B02903",
                            "passenger_count": 28
                        },
                        {
                            "bus_plate": "29B02904",
                            "passenger_count": 25
                        },
                        {
                            "bus_plate": "29B02905",
                            "passenger_count": 20
                        }
                    ]
                },
                {
                    "time": "2024:06:05 09:40:00",
                    "buses": [
                        {
                            "bus_plate": "29B02901",
                            "passenger_count": 9
                        },
                        {
                            "bus_plate": "29B02902",
                            "passenger_count": 18
                        },
                        {
                            "bus_plate": "29B02903",
                            "passenger_count": 16
                        },
                        {
                            "bus_plate": "29B02904",
                            "passenger_count": 7
                        },
                        {
                            "bus_plate": "29B02905",
                            "passenger_count": 1
                        }
                    ]
                },
                {
                    "time": "2024:06:05 09:35:00",
                    "buses": [
                        {
                            "bus_plate": "29B02901",
                            "passenger_count": 20
                        },
                        {
                            "bus_plate": "29B02902",
                            "passenger_count": 10
                        },
                        {
                            "bus_plate": "29B02903",
                            "passenger_count": 18
                        },
                        {
                            "bus_plate": "29B02904",
                            "passenger_count": 4
                        },
                        {
                            "bus_plate": "29B02905",
                            "passenger_count": 9
                        }
                    ]
                },
                {
                    "time": "2024:06:05 09:30:00",
                    "buses": [
                        {
                            "bus_plate": "29B02901",
                            "passenger_count": 20
                        },
                        {
                            "bus_plate": "29B02902",
                            "passenger_count": 30
                        },
                        {
                            "bus_plate": "29B02903",
                            "passenger_count": 14
                        },
                        {
                            "bus_plate": "29B02904",
                            "passenger_count": 24
                        },
                        {
                            "bus_plate": "29B02905",
                            "passenger_count": 29
                        }
                    ]
                },
                {
                    "time": "2024:06:05 09:25:00",
                    "buses": [
                        {
                            "bus_plate": "29B02901",
                            "passenger_count": 8
                        },
                        {
                            "bus_plate": "29B02902",
                            "passenger_count": 20
                        },
                        {
                            "bus_plate": "29B02903",
                            "passenger_count": 27
                        },
                        {
                            "bus_plate": "29B02904",
                            "passenger_count": 5
                        },
                        {
                            "bus_plate": "29B02905",
                            "passenger_count": 11
                        }
                    ]
                },
                {
                    "time": "2024:06:05 09:20:00",
                    "buses": [
                        {
                            "bus_plate": "29B02901",
                            "passenger_count": 7
                        },
                        {
                            "bus_plate": "29B02902",
                            "passenger_count": 29
                        },
                        {
                            "bus_plate": "29B02903",
                            "passenger_count": 13
                        },
                        {
                            "bus_plate": "29B02904",
                            "passenger_count": 22
                        },
                        {
                            "bus_plate": "29B02905",
                            "passenger_count": 3
                        }
                    ]
                },
                {
                    "time": "2024:06:05 09:15:00",
                    "buses": [
                        {
                            "bus_plate": "29B02901",
                            "passenger_count": 21
                        },
                        {
                            "bus_plate": "29B02902",
                            "passenger_count": 9
                        },
                        {
                            "bus_plate": "29B02903",
                            "passenger_count": 9
                        },
                        {
                            "bus_plate": "29B02904",
                            "passenger_count": 15
                        },
                        {
                            "bus_plate": "29B02905",
                            "passenger_count": 30
                        }
                    ]
                },
                {
                    "time": "2024:06:05 09:10:00",
                    "buses": [
                        {
                            "bus_plate": "29B02901",
                            "passenger_count": 29
                        },
                        {
                            "bus_plate": "29B02902",
                            "passenger_count": 24
                        },
                        {
                            "bus_plate": "29B02903",
                            "passenger_count": 26
                        },
                        {
                            "bus_plate": "29B02904",
                            "passenger_count": 1
                        },
                        {
                            "bus_plate": "29B02905",
                            "passenger_count": 21
                        }
                    ]
                },
                {
                    "time": "2024:06:05 09:05:00",
                    "buses": [
                        {
                            "bus_plate": "29B02901",
                            "passenger_count": 11
                        },
                        {
                            "bus_plate": "29B02902",
                            "passenger_count": 13
                        },
                        {
                            "bus_plate": "29B02903",
                            "passenger_count": 12
                        },
                        {
                            "bus_plate": "29B02904",
                            "passenger_count": 29
                        },
                        {
                            "bus_plate": "29B02905",
                            "passenger_count": 30
                        }
                    ]
                }
            ]
        },
        {
            "route": "30",
            "total_passenger": 2798,
            "graph_data": [
                {
                    "time": "2024:06:05 12:00:00",
                    "buses": [
                        {
                            "bus_plate": "29B03001",
                            "passenger_count": 12
                        },
                        {
                            "bus_plate": "29B03002",
                            "passenger_count": 22
                        },
                        {
                            "bus_plate": "29B03003",
                            "passenger_count": 14
                        },
                        {
                            "bus_plate": "29B03004",
                            "passenger_count": 12
                        },
                        {
                            "bus_plate": "29B03005",
                            "passenger_count": 22
                        }
                    ]
                },
                {
                    "time": "2024:06:05 11:55:00",
                    "buses": [
                        {
                            "bus_plate": "29B03001",
                            "passenger_count": 12
                        },
                        {
                            "bus_plate": "29B03002",
                            "passenger_count": 2
                        },
                        {
                            "bus_plate": "29B03003",
                            "passenger_count": 5
                        },
                        {
                            "bus_plate": "29B03004",
                            "passenger_count": 1
                        },
                        {
                            "bus_plate": "29B03005",
                            "passenger_count": 9
                        }
                    ]
                },
                {
                    "time": "2024:06:05 11:50:00",
                    "buses": [
                        {
                            "bus_plate": "29B03001",
                            "passenger_count": 1
                        },
                        {
                            "bus_plate": "29B03002",
                            "passenger_count": 13
                        },
                        {
                            "bus_plate": "29B03003",
                            "passenger_count": 9
                        },
                        {
                            "bus_plate": "29B03004",
                            "passenger_count": 4
                        },
                        {
                            "bus_plate": "29B03005",
                            "passenger_count": 4
                        }
                    ]
                },
                {
                    "time": "2024:06:05 11:45:00",
                    "buses": [
                        {
                            "bus_plate": "29B03001",
                            "passenger_count": 5
                        },
                        {
                            "bus_plate": "29B03002",
                            "passenger_count": 6
                        },
                        {
                            "bus_plate": "29B03003",
                            "passenger_count": 19
                        },
                        {
                            "bus_plate": "29B03004",
                            "passenger_count": 18
                        },
                        {
                            "bus_plate": "29B03005",
                            "passenger_count": 20
                        }
                    ]
                },
                {
                    "time": "2024:06:05 11:40:00",
                    "buses": [
                        {
                            "bus_plate": "29B03001",
                            "passenger_count": 29
                        },
                        {
                            "bus_plate": "29B03002",
                            "passenger_count": 30
                        },
                        {
                            "bus_plate": "29B03003",
                            "passenger_count": 9
                        },
                        {
                            "bus_plate": "29B03004",
                            "passenger_count": 7
                        },
                        {
                            "bus_plate": "29B03005",
                            "passenger_count": 25
                        }
                    ]
                },
                {
                    "time": "2024:06:05 11:35:00",
                    "buses": [
                        {
                            "bus_plate": "29B03001",
                            "passenger_count": 19
                        },
                        {
                            "bus_plate": "29B03002",
                            "passenger_count": 5
                        },
                        {
                            "bus_plate": "29B03003",
                            "passenger_count": 23
                        },
                        {
                            "bus_plate": "29B03004",
                            "passenger_count": 29
                        },
                        {
                            "bus_plate": "29B03005",
                            "passenger_count": 24
                        }
                    ]
                },
                {
                    "time": "2024:06:05 11:30:00",
                    "buses": [
                        {
                            "bus_plate": "29B03001",
                            "passenger_count": 11
                        },
                        {
                            "bus_plate": "29B03002",
                            "passenger_count": 14
                        },
                        {
                            "bus_plate": "29B03003",
                            "passenger_count": 27
                        },
                        {
                            "bus_plate": "29B03004",
                            "passenger_count": 16
                        },
                        {
                            "bus_plate": "29B03005",
                            "passenger_count": 16
                        }
                    ]
                },
                {
                    "time": "2024:06:05 11:25:00",
                    "buses": [
                        {
                            "bus_plate": "29B03001",
                            "passenger_count": 9
                        },
                        {
                            "bus_plate": "29B03002",
                            "passenger_count": 16
                        },
                        {
                            "bus_plate": "29B03003",
                            "passenger_count": 16
                        },
                        {
                            "bus_plate": "29B03004",
                            "passenger_count": 5
                        },
                        {
                            "bus_plate": "29B03005",
                            "passenger_count": 10
                        }
                    ]
                },
                {
                    "time": "2024:06:05 11:20:00",
                    "buses": [
                        {
                            "bus_plate": "29B03001",
                            "passenger_count": 20
                        },
                        {
                            "bus_plate": "29B03002",
                            "passenger_count": 15
                        },
                        {
                            "bus_plate": "29B03003",
                            "passenger_count": 11
                        },
                        {
                            "bus_plate": "29B03004",
                            "passenger_count": 20
                        },
                        {
                            "bus_plate": "29B03005",
                            "passenger_count": 24
                        }
                    ]
                },
                {
                    "time": "2024:06:05 11:15:00",
                    "buses": [
                        {
                            "bus_plate": "29B03001",
                            "passenger_count": 28
                        },
                        {
                            "bus_plate": "29B03002",
                            "passenger_count": 24
                        },
                        {
                            "bus_plate": "29B03003",
                            "passenger_count": 8
                        },
                        {
                            "bus_plate": "29B03004",
                            "passenger_count": 21
                        },
                        {
                            "bus_plate": "29B03005",
                            "passenger_count": 7
                        }
                    ]
                },
                {
                    "time": "2024:06:05 11:10:00",
                    "buses": [
                        {
                            "bus_plate": "29B03001",
                            "passenger_count": 5
                        },
                        {
                            "bus_plate": "29B03002",
                            "passenger_count": 10
                        },
                        {
                            "bus_plate": "29B03003",
                            "passenger_count": 10
                        },
                        {
                            "bus_plate": "29B03004",
                            "passenger_count": 25
                        },
                        {
                            "bus_plate": "29B03005",
                            "passenger_count": 28
                        }
                    ]
                },
                {
                    "time": "2024:06:05 11:05:00",
                    "buses": [
                        {
                            "bus_plate": "29B03001",
                            "passenger_count": 16
                        },
                        {
                            "bus_plate": "29B03002",
                            "passenger_count": 17
                        },
                        {
                            "bus_plate": "29B03003",
                            "passenger_count": 18
                        },
                        {
                            "bus_plate": "29B03004",
                            "passenger_count": 23
                        },
                        {
                            "bus_plate": "29B03005",
                            "passenger_count": 19
                        }
                    ]
                },
                {
                    "time": "2024:06:05 11:00:00",
                    "buses": [
                        {
                            "bus_plate": "29B03001",
                            "passenger_count": 16
                        },
                        {
                            "bus_plate": "29B03002",
                            "passenger_count": 3
                        },
                        {
                            "bus_plate": "29B03003",
                            "passenger_count": 17
                        },
                        {
                            "bus_plate": "29B03004",
                            "passenger_count": 15
                        },
                        {
                            "bus_plate": "29B03005",
                            "passenger_count": 3
                        }
                    ]
                },
                {
                    "time": "2024:06:05 10:55:00",
                    "buses": [
                        {
                            "bus_plate": "29B03001",
                            "passenger_count": 5
                        },
                        {
                            "bus_plate": "29B03002",
                            "passenger_count": 27
                        },
                        {
                            "bus_plate": "29B03003",
                            "passenger_count": 4
                        },
                        {
                            "bus_plate": "29B03004",
                            "passenger_count": 7
                        },
                        {
                            "bus_plate": "29B03005",
                            "passenger_count": 14
                        }
                    ]
                },
                {
                    "time": "2024:06:05 10:50:00",
                    "buses": [
                        {
                            "bus_plate": "29B03001",
                            "passenger_count": 23
                        },
                        {
                            "bus_plate": "29B03002",
                            "passenger_count": 12
                        },
                        {
                            "bus_plate": "29B03003",
                            "passenger_count": 20
                        },
                        {
                            "bus_plate": "29B03004",
                            "passenger_count": 29
                        },
                        {
                            "bus_plate": "29B03005",
                            "passenger_count": 19
                        }
                    ]
                },
                {
                    "time": "2024:06:05 10:45:00",
                    "buses": [
                        {
                            "bus_plate": "29B03001",
                            "passenger_count": 6
                        },
                        {
                            "bus_plate": "29B03002",
                            "passenger_count": 7
                        },
                        {
                            "bus_plate": "29B03003",
                            "passenger_count": 28
                        },
                        {
                            "bus_plate": "29B03004",
                            "passenger_count": 13
                        },
                        {
                            "bus_plate": "29B03005",
                            "passenger_count": 30
                        }
                    ]
                },
                {
                    "time": "2024:06:05 10:40:00",
                    "buses": [
                        {
                            "bus_plate": "29B03001",
                            "passenger_count": 1
                        },
                        {
                            "bus_plate": "29B03002",
                            "passenger_count": 16
                        },
                        {
                            "bus_plate": "29B03003",
                            "passenger_count": 6
                        },
                        {
                            "bus_plate": "29B03004",
                            "passenger_count": 3
                        },
                        {
                            "bus_plate": "29B03005",
                            "passenger_count": 3
                        }
                    ]
                },
                {
                    "time": "2024:06:05 10:35:00",
                    "buses": [
                        {
                            "bus_plate": "29B03001",
                            "passenger_count": 2
                        },
                        {
                            "bus_plate": "29B03002",
                            "passenger_count": 29
                        },
                        {
                            "bus_plate": "29B03003",
                            "passenger_count": 25
                        },
                        {
                            "bus_plate": "29B03004",
                            "passenger_count": 8
                        },
                        {
                            "bus_plate": "29B03005",
                            "passenger_count": 19
                        }
                    ]
                },
                {
                    "time": "2024:06:05 10:30:00",
                    "buses": [
                        {
                            "bus_plate": "29B03001",
                            "passenger_count": 30
                        },
                        {
                            "bus_plate": "29B03002",
                            "passenger_count": 29
                        },
                        {
                            "bus_plate": "29B03003",
                            "passenger_count": 25
                        },
                        {
                            "bus_plate": "29B03004",
                            "passenger_count": 11
                        },
                        {
                            "bus_plate": "29B03005",
                            "passenger_count": 12
                        }
                    ]
                },
                {
                    "time": "2024:06:05 10:25:00",
                    "buses": [
                        {
                            "bus_plate": "29B03001",
                            "passenger_count": 30
                        },
                        {
                            "bus_plate": "29B03002",
                            "passenger_count": 15
                        },
                        {
                            "bus_plate": "29B03003",
                            "passenger_count": 5
                        },
                        {
                            "bus_plate": "29B03004",
                            "passenger_count": 2
                        },
                        {
                            "bus_plate": "29B03005",
                            "passenger_count": 16
                        }
                    ]
                },
                {
                    "time": "2024:06:05 10:20:00",
                    "buses": [
                        {
                            "bus_plate": "29B03001",
                            "passenger_count": 5
                        },
                        {
                            "bus_plate": "29B03002",
                            "passenger_count": 27
                        },
                        {
                            "bus_plate": "29B03003",
                            "passenger_count": 24
                        },
                        {
                            "bus_plate": "29B03004",
                            "passenger_count": 22
                        },
                        {
                            "bus_plate": "29B03005",
                            "passenger_count": 17
                        }
                    ]
                },
                {
                    "time": "2024:06:05 10:15:00",
                    "buses": [
                        {
                            "bus_plate": "29B03001",
                            "passenger_count": 30
                        },
                        {
                            "bus_plate": "29B03002",
                            "passenger_count": 18
                        },
                        {
                            "bus_plate": "29B03003",
                            "passenger_count": 13
                        },
                        {
                            "bus_plate": "29B03004",
                            "passenger_count": 17
                        },
                        {
                            "bus_plate": "29B03005",
                            "passenger_count": 20
                        }
                    ]
                },
                {
                    "time": "2024:06:05 10:10:00",
                    "buses": [
                        {
                            "bus_plate": "29B03001",
                            "passenger_count": 30
                        },
                        {
                            "bus_plate": "29B03002",
                            "passenger_count": 24
                        },
                        {
                            "bus_plate": "29B03003",
                            "passenger_count": 2
                        },
                        {
                            "bus_plate": "29B03004",
                            "passenger_count": 5
                        },
                        {
                            "bus_plate": "29B03005",
                            "passenger_count": 30
                        }
                    ]
                },
                {
                    "time": "2024:06:05 10:05:00",
                    "buses": [
                        {
                            "bus_plate": "29B03001",
                            "passenger_count": 19
                        },
                        {
                            "bus_plate": "29B03002",
                            "passenger_count": 26
                        },
                        {
                            "bus_plate": "29B03003",
                            "passenger_count": 19
                        },
                        {
                            "bus_plate": "29B03004",
                            "passenger_count": 19
                        },
                        {
                            "bus_plate": "29B03005",
                            "passenger_count": 19
                        }
                    ]
                },
                {
                    "time": "2024:06:05 10:00:00",
                    "buses": [
                        {
                            "bus_plate": "29B03001",
                            "passenger_count": 15
                        },
                        {
                            "bus_plate": "29B03002",
                            "passenger_count": 27
                        },
                        {
                            "bus_plate": "29B03003",
                            "passenger_count": 12
                        },
                        {
                            "bus_plate": "29B03004",
                            "passenger_count": 4
                        },
                        {
                            "bus_plate": "29B03005",
                            "passenger_count": 19
                        }
                    ]
                },
                {
                    "time": "2024:06:05 09:55:00",
                    "buses": [
                        {
                            "bus_plate": "29B03001",
                            "passenger_count": 29
                        },
                        {
                            "bus_plate": "29B03002",
                            "passenger_count": 18
                        },
                        {
                            "bus_plate": "29B03003",
                            "passenger_count": 16
                        },
                        {
                            "bus_plate": "29B03004",
                            "passenger_count": 11
                        },
                        {
                            "bus_plate": "29B03005",
                            "passenger_count": 13
                        }
                    ]
                },
                {
                    "time": "2024:06:05 09:50:00",
                    "buses": [
                        {
                            "bus_plate": "29B03001",
                            "passenger_count": 29
                        },
                        {
                            "bus_plate": "29B03002",
                            "passenger_count": 18
                        },
                        {
                            "bus_plate": "29B03003",
                            "passenger_count": 8
                        },
                        {
                            "bus_plate": "29B03004",
                            "passenger_count": 16
                        },
                        {
                            "bus_plate": "29B03005",
                            "passenger_count": 30
                        }
                    ]
                },
                {
                    "time": "2024:06:05 09:45:00",
                    "buses": [
                        {
                            "bus_plate": "29B03001",
                            "passenger_count": 12
                        },
                        {
                            "bus_plate": "29B03002",
                            "passenger_count": 21
                        },
                        {
                            "bus_plate": "29B03003",
                            "passenger_count": 13
                        },
                        {
                            "bus_plate": "29B03004",
                            "passenger_count": 22
                        },
                        {
                            "bus_plate": "29B03005",
                            "passenger_count": 10
                        }
                    ]
                },
                {
                    "time": "2024:06:05 09:40:00",
                    "buses": [
                        {
                            "bus_plate": "29B03001",
                            "passenger_count": 23
                        },
                        {
                            "bus_plate": "29B03002",
                            "passenger_count": 2
                        },
                        {
                            "bus_plate": "29B03003",
                            "passenger_count": 3
                        },
                        {
                            "bus_plate": "29B03004",
                            "passenger_count": 9
                        },
                        {
                            "bus_plate": "29B03005",
                            "passenger_count": 14
                        }
                    ]
                },
                {
                    "time": "2024:06:05 09:35:00",
                    "buses": [
                        {
                            "bus_plate": "29B03001",
                            "passenger_count": 14
                        },
                        {
                            "bus_plate": "29B03002",
                            "passenger_count": 7
                        },
                        {
                            "bus_plate": "29B03003",
                            "passenger_count": 19
                        },
                        {
                            "bus_plate": "29B03004",
                            "passenger_count": 14
                        },
                        {
                            "bus_plate": "29B03005",
                            "passenger_count": 16
                        }
                    ]
                },
                {
                    "time": "2024:06:05 09:30:00",
                    "buses": [
                        {
                            "bus_plate": "29B03001",
                            "passenger_count": 1
                        },
                        {
                            "bus_plate": "29B03002",
                            "passenger_count": 19
                        },
                        {
                            "bus_plate": "29B03003",
                            "passenger_count": 11
                        },
                        {
                            "bus_plate": "29B03004",
                            "passenger_count": 28
                        },
                        {
                            "bus_plate": "29B03005",
                            "passenger_count": 27
                        }
                    ]
                },
                {
                    "time": "2024:06:05 09:25:00",
                    "buses": [
                        {
                            "bus_plate": "29B03001",
                            "passenger_count": 23
                        },
                        {
                            "bus_plate": "29B03002",
                            "passenger_count": 16
                        },
                        {
                            "bus_plate": "29B03003",
                            "passenger_count": 17
                        },
                        {
                            "bus_plate": "29B03004",
                            "passenger_count": 5
                        },
                        {
                            "bus_plate": "29B03005",
                            "passenger_count": 13
                        }
                    ]
                },
                {
                    "time": "2024:06:05 09:20:00",
                    "buses": [
                        {
                            "bus_plate": "29B03001",
                            "passenger_count": 12
                        },
                        {
                            "bus_plate": "29B03002",
                            "passenger_count": 7
                        },
                        {
                            "bus_plate": "29B03003",
                            "passenger_count": 5
                        },
                        {
                            "bus_plate": "29B03004",
                            "passenger_count": 18
                        },
                        {
                            "bus_plate": "29B03005",
                            "passenger_count": 17
                        }
                    ]
                },
                {
                    "time": "2024:06:05 09:15:00",
                    "buses": [
                        {
                            "bus_plate": "29B03001",
                            "passenger_count": 29
                        },
                        {
                            "bus_plate": "29B03002",
                            "passenger_count": 16
                        },
                        {
                            "bus_plate": "29B03003",
                            "passenger_count": 12
                        },
                        {
                            "bus_plate": "29B03004",
                            "passenger_count": 2
                        },
                        {
                            "bus_plate": "29B03005",
                            "passenger_count": 21
                        }
                    ]
                },
                {
                    "time": "2024:06:05 09:10:00",
                    "buses": [
                        {
                            "bus_plate": "29B03001",
                            "passenger_count": 23
                        },
                        {
                            "bus_plate": "29B03002",
                            "passenger_count": 17
                        },
                        {
                            "bus_plate": "29B03003",
                            "passenger_count": 24
                        },
                        {
                            "bus_plate": "29B03004",
                            "passenger_count": 26
                        },
                        {
                            "bus_plate": "29B03005",
                            "passenger_count": 8
                        }
                    ]
                },
                {
                    "time": "2024:06:05 09:05:00",
                    "buses": [
                        {
                            "bus_plate": "29B03001",
                            "passenger_count": 9
                        },
                        {
                            "bus_plate": "29B03002",
                            "passenger_count": 15
                        },
                        {
                            "bus_plate": "29B03003",
                            "passenger_count": 6
                        },
                        {
                            "bus_plate": "29B03004",
                            "passenger_count": 9
                        },
                        {
                            "bus_plate": "29B03005",
                            "passenger_count": 28
                        }
                    ]
                }
            ]
        },
        {
            "route": "31",
            "total_passenger": 2890,
            "graph_data": [
                {
                    "time": "2024:06:05 12:00:00",
                    "buses": [
                        {
                            "bus_plate": "29B03101",
                            "passenger_count": 23
                        },
                        {
                            "bus_plate": "29B03102",
                            "passenger_count": 26
                        },
                        {
                            "bus_plate": "29B03103",
                            "passenger_count": 3
                        },
                        {
                            "bus_plate": "29B03104",
                            "passenger_count": 11
                        },
                        {
                            "bus_plate": "29B03105",
                            "passenger_count": 24
                        }
                    ]
                },
                {
                    "time": "2024:06:05 11:55:00",
                    "buses": [
                        {
                            "bus_plate": "29B03101",
                            "passenger_count": 3
                        },
                        {
                            "bus_plate": "29B03102",
                            "passenger_count": 14
                        },
                        {
                            "bus_plate": "29B03103",
                            "passenger_count": 18
                        },
                        {
                            "bus_plate": "29B03104",
                            "passenger_count": 3
                        },
                        {
                            "bus_plate": "29B03105",
                            "passenger_count": 10
                        }
                    ]
                },
                {
                    "time": "2024:06:05 11:50:00",
                    "buses": [
                        {
                            "bus_plate": "29B03101",
                            "passenger_count": 19
                        },
                        {
                            "bus_plate": "29B03102",
                            "passenger_count": 2
                        },
                        {
                            "bus_plate": "29B03103",
                            "passenger_count": 11
                        },
                        {
                            "bus_plate": "29B03104",
                            "passenger_count": 3
                        },
                        {
                            "bus_plate": "29B03105",
                            "passenger_count": 25
                        }
                    ]
                },
                {
                    "time": "2024:06:05 11:45:00",
                    "buses": [
                        {
                            "bus_plate": "29B03101",
                            "passenger_count": 12
                        },
                        {
                            "bus_plate": "29B03102",
                            "passenger_count": 5
                        },
                        {
                            "bus_plate": "29B03103",
                            "passenger_count": 7
                        },
                        {
                            "bus_plate": "29B03104",
                            "passenger_count": 29
                        },
                        {
                            "bus_plate": "29B03105",
                            "passenger_count": 25
                        }
                    ]
                },
                {
                    "time": "2024:06:05 11:40:00",
                    "buses": [
                        {
                            "bus_plate": "29B03101",
                            "passenger_count": 16
                        },
                        {
                            "bus_plate": "29B03102",
                            "passenger_count": 3
                        },
                        {
                            "bus_plate": "29B03103",
                            "passenger_count": 21
                        },
                        {
                            "bus_plate": "29B03104",
                            "passenger_count": 4
                        },
                        {
                            "bus_plate": "29B03105",
                            "passenger_count": 20
                        }
                    ]
                },
                {
                    "time": "2024:06:05 11:35:00",
                    "buses": [
                        {
                            "bus_plate": "29B03101",
                            "passenger_count": 22
                        },
                        {
                            "bus_plate": "29B03102",
                            "passenger_count": 1
                        },
                        {
                            "bus_plate": "29B03103",
                            "passenger_count": 20
                        },
                        {
                            "bus_plate": "29B03104",
                            "passenger_count": 29
                        },
                        {
                            "bus_plate": "29B03105",
                            "passenger_count": 12
                        }
                    ]
                },
                {
                    "time": "2024:06:05 11:30:00",
                    "buses": [
                        {
                            "bus_plate": "29B03101",
                            "passenger_count": 13
                        },
                        {
                            "bus_plate": "29B03102",
                            "passenger_count": 22
                        },
                        {
                            "bus_plate": "29B03103",
                            "passenger_count": 6
                        },
                        {
                            "bus_plate": "29B03104",
                            "passenger_count": 28
                        },
                        {
                            "bus_plate": "29B03105",
                            "passenger_count": 16
                        }
                    ]
                },
                {
                    "time": "2024:06:05 11:25:00",
                    "buses": [
                        {
                            "bus_plate": "29B03101",
                            "passenger_count": 7
                        },
                        {
                            "bus_plate": "29B03102",
                            "passenger_count": 17
                        },
                        {
                            "bus_plate": "29B03103",
                            "passenger_count": 6
                        },
                        {
                            "bus_plate": "29B03104",
                            "passenger_count": 24
                        },
                        {
                            "bus_plate": "29B03105",
                            "passenger_count": 16
                        }
                    ]
                },
                {
                    "time": "2024:06:05 11:20:00",
                    "buses": [
                        {
                            "bus_plate": "29B03101",
                            "passenger_count": 11
                        },
                        {
                            "bus_plate": "29B03102",
                            "passenger_count": 3
                        },
                        {
                            "bus_plate": "29B03103",
                            "passenger_count": 28
                        },
                        {
                            "bus_plate": "29B03104",
                            "passenger_count": 19
                        },
                        {
                            "bus_plate": "29B03105",
                            "passenger_count": 26
                        }
                    ]
                },
                {
                    "time": "2024:06:05 11:15:00",
                    "buses": [
                        {
                            "bus_plate": "29B03101",
                            "passenger_count": 17
                        },
                        {
                            "bus_plate": "29B03102",
                            "passenger_count": 27
                        },
                        {
                            "bus_plate": "29B03103",
                            "passenger_count": 29
                        },
                        {
                            "bus_plate": "29B03104",
                            "passenger_count": 19
                        },
                        {
                            "bus_plate": "29B03105",
                            "passenger_count": 29
                        }
                    ]
                },
                {
                    "time": "2024:06:05 11:10:00",
                    "buses": [
                        {
                            "bus_plate": "29B03101",
                            "passenger_count": 22
                        },
                        {
                            "bus_plate": "29B03102",
                            "passenger_count": 23
                        },
                        {
                            "bus_plate": "29B03103",
                            "passenger_count": 6
                        },
                        {
                            "bus_plate": "29B03104",
                            "passenger_count": 9
                        },
                        {
                            "bus_plate": "29B03105",
                            "passenger_count": 26
                        }
                    ]
                },
                {
                    "time": "2024:06:05 11:05:00",
                    "buses": [
                        {
                            "bus_plate": "29B03101",
                            "passenger_count": 16
                        },
                        {
                            "bus_plate": "29B03102",
                            "passenger_count": 16
                        },
                        {
                            "bus_plate": "29B03103",
                            "passenger_count": 2
                        },
                        {
                            "bus_plate": "29B03104",
                            "passenger_count": 7
                        },
                        {
                            "bus_plate": "29B03105",
                            "passenger_count": 12
                        }
                    ]
                },
                {
                    "time": "2024:06:05 11:00:00",
                    "buses": [
                        {
                            "bus_plate": "29B03101",
                            "passenger_count": 17
                        },
                        {
                            "bus_plate": "29B03102",
                            "passenger_count": 18
                        },
                        {
                            "bus_plate": "29B03103",
                            "passenger_count": 18
                        },
                        {
                            "bus_plate": "29B03104",
                            "passenger_count": 9
                        },
                        {
                            "bus_plate": "29B03105",
                            "passenger_count": 5
                        }
                    ]
                },
                {
                    "time": "2024:06:05 10:55:00",
                    "buses": [
                        {
                            "bus_plate": "29B03101",
                            "passenger_count": 19
                        },
                        {
                            "bus_plate": "29B03102",
                            "passenger_count": 24
                        },
                        {
                            "bus_plate": "29B03103",
                            "passenger_count": 2
                        },
                        {
                            "bus_plate": "29B03104",
                            "passenger_count": 11
                        },
                        {
                            "bus_plate": "29B03105",
                            "passenger_count": 1
                        }
                    ]
                },
                {
                    "time": "2024:06:05 10:50:00",
                    "buses": [
                        {
                            "bus_plate": "29B03101",
                            "passenger_count": 23
                        },
                        {
                            "bus_plate": "29B03102",
                            "passenger_count": 22
                        },
                        {
                            "bus_plate": "29B03103",
                            "passenger_count": 16
                        },
                        {
                            "bus_plate": "29B03104",
                            "passenger_count": 17
                        },
                        {
                            "bus_plate": "29B03105",
                            "passenger_count": 19
                        }
                    ]
                },
                {
                    "time": "2024:06:05 10:45:00",
                    "buses": [
                        {
                            "bus_plate": "29B03101",
                            "passenger_count": 23
                        },
                        {
                            "bus_plate": "29B03102",
                            "passenger_count": 27
                        },
                        {
                            "bus_plate": "29B03103",
                            "passenger_count": 5
                        },
                        {
                            "bus_plate": "29B03104",
                            "passenger_count": 24
                        },
                        {
                            "bus_plate": "29B03105",
                            "passenger_count": 30
                        }
                    ]
                },
                {
                    "time": "2024:06:05 10:40:00",
                    "buses": [
                        {
                            "bus_plate": "29B03101",
                            "passenger_count": 23
                        },
                        {
                            "bus_plate": "29B03102",
                            "passenger_count": 21
                        },
                        {
                            "bus_plate": "29B03103",
                            "passenger_count": 9
                        },
                        {
                            "bus_plate": "29B03104",
                            "passenger_count": 12
                        },
                        {
                            "bus_plate": "29B03105",
                            "passenger_count": 25
                        }
                    ]
                },
                {
                    "time": "2024:06:05 10:35:00",
                    "buses": [
                        {
                            "bus_plate": "29B03101",
                            "passenger_count": 17
                        },
                        {
                            "bus_plate": "29B03102",
                            "passenger_count": 30
                        },
                        {
                            "bus_plate": "29B03103",
                            "passenger_count": 23
                        },
                        {
                            "bus_plate": "29B03104",
                            "passenger_count": 12
                        },
                        {
                            "bus_plate": "29B03105",
                            "passenger_count": 7
                        }
                    ]
                },
                {
                    "time": "2024:06:05 10:30:00",
                    "buses": [
                        {
                            "bus_plate": "29B03101",
                            "passenger_count": 24
                        },
                        {
                            "bus_plate": "29B03102",
                            "passenger_count": 19
                        },
                        {
                            "bus_plate": "29B03103",
                            "passenger_count": 18
                        },
                        {
                            "bus_plate": "29B03104",
                            "passenger_count": 24
                        },
                        {
                            "bus_plate": "29B03105",
                            "passenger_count": 30
                        }
                    ]
                },
                {
                    "time": "2024:06:05 10:25:00",
                    "buses": [
                        {
                            "bus_plate": "29B03101",
                            "passenger_count": 16
                        },
                        {
                            "bus_plate": "29B03102",
                            "passenger_count": 25
                        },
                        {
                            "bus_plate": "29B03103",
                            "passenger_count": 14
                        },
                        {
                            "bus_plate": "29B03104",
                            "passenger_count": 2
                        },
                        {
                            "bus_plate": "29B03105",
                            "passenger_count": 17
                        }
                    ]
                },
                {
                    "time": "2024:06:05 10:20:00",
                    "buses": [
                        {
                            "bus_plate": "29B03101",
                            "passenger_count": 11
                        },
                        {
                            "bus_plate": "29B03102",
                            "passenger_count": 20
                        },
                        {
                            "bus_plate": "29B03103",
                            "passenger_count": 29
                        },
                        {
                            "bus_plate": "29B03104",
                            "passenger_count": 13
                        },
                        {
                            "bus_plate": "29B03105",
                            "passenger_count": 17
                        }
                    ]
                },
                {
                    "time": "2024:06:05 10:15:00",
                    "buses": [
                        {
                            "bus_plate": "29B03101",
                            "passenger_count": 12
                        },
                        {
                            "bus_plate": "29B03102",
                            "passenger_count": 16
                        },
                        {
                            "bus_plate": "29B03103",
                            "passenger_count": 10
                        },
                        {
                            "bus_plate": "29B03104",
                            "passenger_count": 22
                        },
                        {
                            "bus_plate": "29B03105",
                            "passenger_count": 14
                        }
                    ]
                },
                {
                    "time": "2024:06:05 10:10:00",
                    "buses": [
                        {
                            "bus_plate": "29B03101",
                            "passenger_count": 20
                        },
                        {
                            "bus_plate": "29B03102",
                            "passenger_count": 9
                        },
                        {
                            "bus_plate": "29B03103",
                            "passenger_count": 11
                        },
                        {
                            "bus_plate": "29B03104",
                            "passenger_count": 3
                        },
                        {
                            "bus_plate": "29B03105",
                            "passenger_count": 10
                        }
                    ]
                },
                {
                    "time": "2024:06:05 10:05:00",
                    "buses": [
                        {
                            "bus_plate": "29B03101",
                            "passenger_count": 30
                        },
                        {
                            "bus_plate": "29B03102",
                            "passenger_count": 8
                        },
                        {
                            "bus_plate": "29B03103",
                            "passenger_count": 25
                        },
                        {
                            "bus_plate": "29B03104",
                            "passenger_count": 5
                        },
                        {
                            "bus_plate": "29B03105",
                            "passenger_count": 12
                        }
                    ]
                },
                {
                    "time": "2024:06:05 10:00:00",
                    "buses": [
                        {
                            "bus_plate": "29B03101",
                            "passenger_count": 28
                        },
                        {
                            "bus_plate": "29B03102",
                            "passenger_count": 9
                        },
                        {
                            "bus_plate": "29B03103",
                            "passenger_count": 1
                        },
                        {
                            "bus_plate": "29B03104",
                            "passenger_count": 6
                        },
                        {
                            "bus_plate": "29B03105",
                            "passenger_count": 27
                        }
                    ]
                },
                {
                    "time": "2024:06:05 09:55:00",
                    "buses": [
                        {
                            "bus_plate": "29B03101",
                            "passenger_count": 1
                        },
                        {
                            "bus_plate": "29B03102",
                            "passenger_count": 8
                        },
                        {
                            "bus_plate": "29B03103",
                            "passenger_count": 12
                        },
                        {
                            "bus_plate": "29B03104",
                            "passenger_count": 20
                        },
                        {
                            "bus_plate": "29B03105",
                            "passenger_count": 14
                        }
                    ]
                },
                {
                    "time": "2024:06:05 09:50:00",
                    "buses": [
                        {
                            "bus_plate": "29B03101",
                            "passenger_count": 15
                        },
                        {
                            "bus_plate": "29B03102",
                            "passenger_count": 15
                        },
                        {
                            "bus_plate": "29B03103",
                            "passenger_count": 21
                        },
                        {
                            "bus_plate": "29B03104",
                            "passenger_count": 14
                        },
                        {
                            "bus_plate": "29B03105",
                            "passenger_count": 12
                        }
                    ]
                },
                {
                    "time": "2024:06:05 09:45:00",
                    "buses": [
                        {
                            "bus_plate": "29B03101",
                            "passenger_count": 25
                        },
                        {
                            "bus_plate": "29B03102",
                            "passenger_count": 28
                        },
                        {
                            "bus_plate": "29B03103",
                            "passenger_count": 9
                        },
                        {
                            "bus_plate": "29B03104",
                            "passenger_count": 10
                        },
                        {
                            "bus_plate": "29B03105",
                            "passenger_count": 7
                        }
                    ]
                },
                {
                    "time": "2024:06:05 09:40:00",
                    "buses": [
                        {
                            "bus_plate": "29B03101",
                            "passenger_count": 14
                        },
                        {
                            "bus_plate": "29B03102",
                            "passenger_count": 10
                        },
                        {
                            "bus_plate": "29B03103",
                            "passenger_count": 10
                        },
                        {
                            "bus_plate": "29B03104",
                            "passenger_count": 17
                        },
                        {
                            "bus_plate": "29B03105",
                            "passenger_count": 9
                        }
                    ]
                },
                {
                    "time": "2024:06:05 09:35:00",
                    "buses": [
                        {
                            "bus_plate": "29B03101",
                            "passenger_count": 9
                        },
                        {
                            "bus_plate": "29B03102",
                            "passenger_count": 22
                        },
                        {
                            "bus_plate": "29B03103",
                            "passenger_count": 28
                        },
                        {
                            "bus_plate": "29B03104",
                            "passenger_count": 5
                        },
                        {
                            "bus_plate": "29B03105",
                            "passenger_count": 15
                        }
                    ]
                },
                {
                    "time": "2024:06:05 09:30:00",
                    "buses": [
                        {
                            "bus_plate": "29B03101",
                            "passenger_count": 11
                        },
                        {
                            "bus_plate": "29B03102",
                            "passenger_count": 30
                        },
                        {
                            "bus_plate": "29B03103",
                            "passenger_count": 12
                        },
                        {
                            "bus_plate": "29B03104",
                            "passenger_count": 25
                        },
                        {
                            "bus_plate": "29B03105",
                            "passenger_count": 20
                        }
                    ]
                },
                {
                    "time": "2024:06:05 09:25:00",
                    "buses": [
                        {
                            "bus_plate": "29B03101",
                            "passenger_count": 22
                        },
                        {
                            "bus_plate": "29B03102",
                            "passenger_count": 25
                        },
                        {
                            "bus_plate": "29B03103",
                            "passenger_count": 27
                        },
                        {
                            "bus_plate": "29B03104",
                            "passenger_count": 24
                        },
                        {
                            "bus_plate": "29B03105",
                            "passenger_count": 12
                        }
                    ]
                },
                {
                    "time": "2024:06:05 09:20:00",
                    "buses": [
                        {
                            "bus_plate": "29B03101",
                            "passenger_count": 21
                        },
                        {
                            "bus_plate": "29B03102",
                            "passenger_count": 25
                        },
                        {
                            "bus_plate": "29B03103",
                            "passenger_count": 15
                        },
                        {
                            "bus_plate": "29B03104",
                            "passenger_count": 19
                        },
                        {
                            "bus_plate": "29B03105",
                            "passenger_count": 5
                        }
                    ]
                },
                {
                    "time": "2024:06:05 09:15:00",
                    "buses": [
                        {
                            "bus_plate": "29B03101",
                            "passenger_count": 13
                        },
                        {
                            "bus_plate": "29B03102",
                            "passenger_count": 6
                        },
                        {
                            "bus_plate": "29B03103",
                            "passenger_count": 4
                        },
                        {
                            "bus_plate": "29B03104",
                            "passenger_count": 13
                        },
                        {
                            "bus_plate": "29B03105",
                            "passenger_count": 26
                        }
                    ]
                },
                {
                    "time": "2024:06:05 09:10:00",
                    "buses": [
                        {
                            "bus_plate": "29B03101",
                            "passenger_count": 30
                        },
                        {
                            "bus_plate": "29B03102",
                            "passenger_count": 28
                        },
                        {
                            "bus_plate": "29B03103",
                            "passenger_count": 23
                        },
                        {
                            "bus_plate": "29B03104",
                            "passenger_count": 10
                        },
                        {
                            "bus_plate": "29B03105",
                            "passenger_count": 12
                        }
                    ]
                },
                {
                    "time": "2024:06:05 09:05:00",
                    "buses": [
                        {
                            "bus_plate": "29B03101",
                            "passenger_count": 29
                        },
                        {
                            "bus_plate": "29B03102",
                            "passenger_count": 18
                        },
                        {
                            "bus_plate": "29B03103",
                            "passenger_count": 24
                        },
                        {
                            "bus_plate": "29B03104",
                            "passenger_count": 17
                        },
                        {
                            "bus_plate": "29B03105",
                            "passenger_count": 5
                        }
                    ]
                }
            ]
        },
        {
            "route": "32",
            "total_passenger": 3068,
            "graph_data": [
                {
                    "time": "2024:06:05 12:00:00",
                    "buses": [
                        {
                            "bus_plate": "29B03201",
                            "passenger_count": 12
                        },
                        {
                            "bus_plate": "29B03202",
                            "passenger_count": 8
                        },
                        {
                            "bus_plate": "29B03203",
                            "passenger_count": 4
                        },
                        {
                            "bus_plate": "29B03204",
                            "passenger_count": 25
                        },
                        {
                            "bus_plate": "29B03205",
                            "passenger_count": 3
                        }
                    ]
                },
                {
                    "time": "2024:06:05 11:55:00",
                    "buses": [
                        {
                            "bus_plate": "29B03201",
                            "passenger_count": 19
                        },
                        {
                            "bus_plate": "29B03202",
                            "passenger_count": 3
                        },
                        {
                            "bus_plate": "29B03203",
                            "passenger_count": 20
                        },
                        {
                            "bus_plate": "29B03204",
                            "passenger_count": 20
                        },
                        {
                            "bus_plate": "29B03205",
                            "passenger_count": 11
                        }
                    ]
                },
                {
                    "time": "2024:06:05 11:50:00",
                    "buses": [
                        {
                            "bus_plate": "29B03201",
                            "passenger_count": 1
                        },
                        {
                            "bus_plate": "29B03202",
                            "passenger_count": 1
                        },
                        {
                            "bus_plate": "29B03203",
                            "passenger_count": 28
                        },
                        {
                            "bus_plate": "29B03204",
                            "passenger_count": 13
                        },
                        {
                            "bus_plate": "29B03205",
                            "passenger_count": 8
                        }
                    ]
                },
                {
                    "time": "2024:06:05 11:45:00",
                    "buses": [
                        {
                            "bus_plate": "29B03201",
                            "passenger_count": 23
                        },
                        {
                            "bus_plate": "29B03202",
                            "passenger_count": 10
                        },
                        {
                            "bus_plate": "29B03203",
                            "passenger_count": 3
                        },
                        {
                            "bus_plate": "29B03204",
                            "passenger_count": 8
                        },
                        {
                            "bus_plate": "29B03205",
                            "passenger_count": 20
                        }
                    ]
                },
                {
                    "time": "2024:06:05 11:40:00",
                    "buses": [
                        {
                            "bus_plate": "29B03201",
                            "passenger_count": 5
                        },
                        {
                            "bus_plate": "29B03202",
                            "passenger_count": 24
                        },
                        {
                            "bus_plate": "29B03203",
                            "passenger_count": 27
                        },
                        {
                            "bus_plate": "29B03204",
                            "passenger_count": 28
                        },
                        {
                            "bus_plate": "29B03205",
                            "passenger_count": 20
                        }
                    ]
                },
                {
                    "time": "2024:06:05 11:35:00",
                    "buses": [
                        {
                            "bus_plate": "29B03201",
                            "passenger_count": 14
                        },
                        {
                            "bus_plate": "29B03202",
                            "passenger_count": 25
                        },
                        {
                            "bus_plate": "29B03203",
                            "passenger_count": 21
                        },
                        {
                            "bus_plate": "29B03204",
                            "passenger_count": 20
                        },
                        {
                            "bus_plate": "29B03205",
                            "passenger_count": 28
                        }
                    ]
                },
                {
                    "time": "2024:06:05 11:30:00",
                    "buses": [
                        {
                            "bus_plate": "29B03201",
                            "passenger_count": 27
                        },
                        {
                            "bus_plate": "29B03202",
                            "passenger_count": 3
                        },
                        {
                            "bus_plate": "29B03203",
                            "passenger_count": 16
                        },
                        {
                            "bus_plate": "29B03204",
                            "passenger_count": 5
                        },
                        {
                            "bus_plate": "29B03205",
                            "passenger_count": 2
                        }
                    ]
                },
                {
                    "time": "2024:06:05 11:25:00",
                    "buses": [
                        {
                            "bus_plate": "29B03201",
                            "passenger_count": 5
                        },
                        {
                            "bus_plate": "29B03202",
                            "passenger_count": 19
                        },
                        {
                            "bus_plate": "29B03203",
                            "passenger_count": 22
                        },
                        {
                            "bus_plate": "29B03204",
                            "passenger_count": 14
                        },
                        {
                            "bus_plate": "29B03205",
                            "passenger_count": 24
                        }
                    ]
                },
                {
                    "time": "2024:06:05 11:20:00",
                    "buses": [
                        {
                            "bus_plate": "29B03201",
                            "passenger_count": 11
                        },
                        {
                            "bus_plate": "29B03202",
                            "passenger_count": 30
                        },
                        {
                            "bus_plate": "29B03203",
                            "passenger_count": 2
                        },
                        {
                            "bus_plate": "29B03204",
                            "passenger_count": 16
                        },
                        {
                            "bus_plate": "29B03205",
                            "passenger_count": 14
                        }
                    ]
                },
                {
                    "time": "2024:06:05 11:15:00",
                    "buses": [
                        {
                            "bus_plate": "29B03201",
                            "passenger_count": 28
                        },
                        {
                            "bus_plate": "29B03202",
                            "passenger_count": 10
                        },
                        {
                            "bus_plate": "29B03203",
                            "passenger_count": 2
                        },
                        {
                            "bus_plate": "29B03204",
                            "passenger_count": 27
                        },
                        {
                            "bus_plate": "29B03205",
                            "passenger_count": 15
                        }
                    ]
                },
                {
                    "time": "2024:06:05 11:10:00",
                    "buses": [
                        {
                            "bus_plate": "29B03201",
                            "passenger_count": 9
                        },
                        {
                            "bus_plate": "29B03202",
                            "passenger_count": 5
                        },
                        {
                            "bus_plate": "29B03203",
                            "passenger_count": 28
                        },
                        {
                            "bus_plate": "29B03204",
                            "passenger_count": 29
                        },
                        {
                            "bus_plate": "29B03205",
                            "passenger_count": 30
                        }
                    ]
                },
                {
                    "time": "2024:06:05 11:05:00",
                    "buses": [
                        {
                            "bus_plate": "29B03201",
                            "passenger_count": 27
                        },
                        {
                            "bus_plate": "29B03202",
                            "passenger_count": 14
                        },
                        {
                            "bus_plate": "29B03203",
                            "passenger_count": 20
                        },
                        {
                            "bus_plate": "29B03204",
                            "passenger_count": 22
                        },
                        {
                            "bus_plate": "29B03205",
                            "passenger_count": 23
                        }
                    ]
                },
                {
                    "time": "2024:06:05 11:00:00",
                    "buses": [
                        {
                            "bus_plate": "29B03201",
                            "passenger_count": 7
                        },
                        {
                            "bus_plate": "29B03202",
                            "passenger_count": 26
                        },
                        {
                            "bus_plate": "29B03203",
                            "passenger_count": 16
                        },
                        {
                            "bus_plate": "29B03204",
                            "passenger_count": 24
                        },
                        {
                            "bus_plate": "29B03205",
                            "passenger_count": 21
                        }
                    ]
                },
                {
                    "time": "2024:06:05 10:55:00",
                    "buses": [
                        {
                            "bus_plate": "29B03201",
                            "passenger_count": 29
                        },
                        {
                            "bus_plate": "29B03202",
                            "passenger_count": 29
                        },
                        {
                            "bus_plate": "29B03203",
                            "passenger_count": 24
                        },
                        {
                            "bus_plate": "29B03204",
                            "passenger_count": 11
                        },
                        {
                            "bus_plate": "29B03205",
                            "passenger_count": 30
                        }
                    ]
                },
                {
                    "time": "2024:06:05 10:50:00",
                    "buses": [
                        {
                            "bus_plate": "29B03201",
                            "passenger_count": 30
                        },
                        {
                            "bus_plate": "29B03202",
                            "passenger_count": 28
                        },
                        {
                            "bus_plate": "29B03203",
                            "passenger_count": 3
                        },
                        {
                            "bus_plate": "29B03204",
                            "passenger_count": 3
                        },
                        {
                            "bus_plate": "29B03205",
                            "passenger_count": 16
                        }
                    ]
                },
                {
                    "time": "2024:06:05 10:45:00",
                    "buses": [
                        {
                            "bus_plate": "29B03201",
                            "passenger_count": 18
                        },
                        {
                            "bus_plate": "29B03202",
                            "passenger_count": 5
                        },
                        {
                            "bus_plate": "29B03203",
                            "passenger_count": 17
                        },
                        {
                            "bus_plate": "29B03204",
                            "passenger_count": 26
                        },
                        {
                            "bus_plate": "29B03205",
                            "passenger_count": 29
                        }
                    ]
                },
                {
                    "time": "2024:06:05 10:40:00",
                    "buses": [
                        {
                            "bus_plate": "29B03201",
                            "passenger_count": 22
                        },
                        {
                            "bus_plate": "29B03202",
                            "passenger_count": 18
                        },
                        {
                            "bus_plate": "29B03203",
                            "passenger_count": 14
                        },
                        {
                            "bus_plate": "29B03204",
                            "passenger_count": 25
                        },
                        {
                            "bus_plate": "29B03205",
                            "passenger_count": 16
                        }
                    ]
                },
                {
                    "time": "2024:06:05 10:35:00",
                    "buses": [
                        {
                            "bus_plate": "29B03201",
                            "passenger_count": 14
                        },
                        {
                            "bus_plate": "29B03202",
                            "passenger_count": 26
                        },
                        {
                            "bus_plate": "29B03203",
                            "passenger_count": 26
                        },
                        {
                            "bus_plate": "29B03204",
                            "passenger_count": 18
                        },
                        {
                            "bus_plate": "29B03205",
                            "passenger_count": 10
                        }
                    ]
                },
                {
                    "time": "2024:06:05 10:30:00",
                    "buses": [
                        {
                            "bus_plate": "29B03201",
                            "passenger_count": 5
                        },
                        {
                            "bus_plate": "29B03202",
                            "passenger_count": 18
                        },
                        {
                            "bus_plate": "29B03203",
                            "passenger_count": 12
                        },
                        {
                            "bus_plate": "29B03204",
                            "passenger_count": 3
                        },
                        {
                            "bus_plate": "29B03205",
                            "passenger_count": 24
                        }
                    ]
                },
                {
                    "time": "2024:06:05 10:25:00",
                    "buses": [
                        {
                            "bus_plate": "29B03201",
                            "passenger_count": 18
                        },
                        {
                            "bus_plate": "29B03202",
                            "passenger_count": 20
                        },
                        {
                            "bus_plate": "29B03203",
                            "passenger_count": 6
                        },
                        {
                            "bus_plate": "29B03204",
                            "passenger_count": 16
                        },
                        {
                            "bus_plate": "29B03205",
                            "passenger_count": 14
                        }
                    ]
                },
                {
                    "time": "2024:06:05 10:20:00",
                    "buses": [
                        {
                            "bus_plate": "29B03201",
                            "passenger_count": 21
                        },
                        {
                            "bus_plate": "29B03202",
                            "passenger_count": 10
                        },
                        {
                            "bus_plate": "29B03203",
                            "passenger_count": 4
                        },
                        {
                            "bus_plate": "29B03204",
                            "passenger_count": 27
                        },
                        {
                            "bus_plate": "29B03205",
                            "passenger_count": 14
                        }
                    ]
                },
                {
                    "time": "2024:06:05 10:15:00",
                    "buses": [
                        {
                            "bus_plate": "29B03201",
                            "passenger_count": 17
                        },
                        {
                            "bus_plate": "29B03202",
                            "passenger_count": 2
                        },
                        {
                            "bus_plate": "29B03203",
                            "passenger_count": 17
                        },
                        {
                            "bus_plate": "29B03204",
                            "passenger_count": 26
                        },
                        {
                            "bus_plate": "29B03205",
                            "passenger_count": 17
                        }
                    ]
                },
                {
                    "time": "2024:06:05 10:10:00",
                    "buses": [
                        {
                            "bus_plate": "29B03201",
                            "passenger_count": 26
                        },
                        {
                            "bus_plate": "29B03202",
                            "passenger_count": 10
                        },
                        {
                            "bus_plate": "29B03203",
                            "passenger_count": 26
                        },
                        {
                            "bus_plate": "29B03204",
                            "passenger_count": 22
                        },
                        {
                            "bus_plate": "29B03205",
                            "passenger_count": 23
                        }
                    ]
                },
                {
                    "time": "2024:06:05 10:05:00",
                    "buses": [
                        {
                            "bus_plate": "29B03201",
                            "passenger_count": 26
                        },
                        {
                            "bus_plate": "29B03202",
                            "passenger_count": 14
                        },
                        {
                            "bus_plate": "29B03203",
                            "passenger_count": 25
                        },
                        {
                            "bus_plate": "29B03204",
                            "passenger_count": 23
                        },
                        {
                            "bus_plate": "29B03205",
                            "passenger_count": 19
                        }
                    ]
                },
                {
                    "time": "2024:06:05 10:00:00",
                    "buses": [
                        {
                            "bus_plate": "29B03201",
                            "passenger_count": 13
                        },
                        {
                            "bus_plate": "29B03202",
                            "passenger_count": 29
                        },
                        {
                            "bus_plate": "29B03203",
                            "passenger_count": 29
                        },
                        {
                            "bus_plate": "29B03204",
                            "passenger_count": 27
                        },
                        {
                            "bus_plate": "29B03205",
                            "passenger_count": 19
                        }
                    ]
                },
                {
                    "time": "2024:06:05 09:55:00",
                    "buses": [
                        {
                            "bus_plate": "29B03201",
                            "passenger_count": 3
                        },
                        {
                            "bus_plate": "29B03202",
                            "passenger_count": 22
                        },
                        {
                            "bus_plate": "29B03203",
                            "passenger_count": 10
                        },
                        {
                            "bus_plate": "29B03204",
                            "passenger_count": 11
                        },
                        {
                            "bus_plate": "29B03205",
                            "passenger_count": 3
                        }
                    ]
                },
                {
                    "time": "2024:06:05 09:50:00",
                    "buses": [
                        {
                            "bus_plate": "29B03201",
                            "passenger_count": 11
                        },
                        {
                            "bus_plate": "29B03202",
                            "passenger_count": 12
                        },
                        {
                            "bus_plate": "29B03203",
                            "passenger_count": 6
                        },
                        {
                            "bus_plate": "29B03204",
                            "passenger_count": 12
                        },
                        {
                            "bus_plate": "29B03205",
                            "passenger_count": 4
                        }
                    ]
                },
                {
                    "time": "2024:06:05 09:45:00",
                    "buses": [
                        {
                            "bus_plate": "29B03201",
                            "passenger_count": 26
                        },
                        {
                            "bus_plate": "29B03202",
                            "passenger_count": 21
                        },
                        {
                            "bus_plate": "29B03203",
                            "passenger_count": 14
                        },
                        {
                            "bus_plate": "29B03204",
                            "passenger_count": 24
                        },
                        {
                            "bus_plate": "29B03205",
                            "passenger_count": 26
                        }
                    ]
                },
                {
                    "time": "2024:06:05 09:40:00",
                    "buses": [
                        {
                            "bus_plate": "29B03201",
                            "passenger_count": 8
                        },
                        {
                            "bus_plate": "29B03202",
                            "passenger_count": 23
                        },
                        {
                            "bus_plate": "29B03203",
                            "passenger_count": 11
                        },
                        {
                            "bus_plate": "29B03204",
                            "passenger_count": 28
                        },
                        {
                            "bus_plate": "29B03205",
                            "passenger_count": 6
                        }
                    ]
                },
                {
                    "time": "2024:06:05 09:35:00",
                    "buses": [
                        {
                            "bus_plate": "29B03201",
                            "passenger_count": 6
                        },
                        {
                            "bus_plate": "29B03202",
                            "passenger_count": 18
                        },
                        {
                            "bus_plate": "29B03203",
                            "passenger_count": 29
                        },
                        {
                            "bus_plate": "29B03204",
                            "passenger_count": 18
                        },
                        {
                            "bus_plate": "29B03205",
                            "passenger_count": 26
                        }
                    ]
                },
                {
                    "time": "2024:06:05 09:30:00",
                    "buses": [
                        {
                            "bus_plate": "29B03201",
                            "passenger_count": 16
                        },
                        {
                            "bus_plate": "29B03202",
                            "passenger_count": 26
                        },
                        {
                            "bus_plate": "29B03203",
                            "passenger_count": 28
                        },
                        {
                            "bus_plate": "29B03204",
                            "passenger_count": 13
                        },
                        {
                            "bus_plate": "29B03205",
                            "passenger_count": 8
                        }
                    ]
                },
                {
                    "time": "2024:06:05 09:25:00",
                    "buses": [
                        {
                            "bus_plate": "29B03201",
                            "passenger_count": 15
                        },
                        {
                            "bus_plate": "29B03202",
                            "passenger_count": 29
                        },
                        {
                            "bus_plate": "29B03203",
                            "passenger_count": 21
                        },
                        {
                            "bus_plate": "29B03204",
                            "passenger_count": 23
                        },
                        {
                            "bus_plate": "29B03205",
                            "passenger_count": 3
                        }
                    ]
                },
                {
                    "time": "2024:06:05 09:20:00",
                    "buses": [
                        {
                            "bus_plate": "29B03201",
                            "passenger_count": 26
                        },
                        {
                            "bus_plate": "29B03202",
                            "passenger_count": 4
                        },
                        {
                            "bus_plate": "29B03203",
                            "passenger_count": 23
                        },
                        {
                            "bus_plate": "29B03204",
                            "passenger_count": 25
                        },
                        {
                            "bus_plate": "29B03205",
                            "passenger_count": 26
                        }
                    ]
                },
                {
                    "time": "2024:06:05 09:15:00",
                    "buses": [
                        {
                            "bus_plate": "29B03201",
                            "passenger_count": 3
                        },
                        {
                            "bus_plate": "29B03202",
                            "passenger_count": 25
                        },
                        {
                            "bus_plate": "29B03203",
                            "passenger_count": 16
                        },
                        {
                            "bus_plate": "29B03204",
                            "passenger_count": 14
                        },
                        {
                            "bus_plate": "29B03205",
                            "passenger_count": 8
                        }
                    ]
                },
                {
                    "time": "2024:06:05 09:10:00",
                    "buses": [
                        {
                            "bus_plate": "29B03201",
                            "passenger_count": 8
                        },
                        {
                            "bus_plate": "29B03202",
                            "passenger_count": 17
                        },
                        {
                            "bus_plate": "29B03203",
                            "passenger_count": 6
                        },
                        {
                            "bus_plate": "29B03204",
                            "passenger_count": 22
                        },
                        {
                            "bus_plate": "29B03205",
                            "passenger_count": 16
                        }
                    ]
                },
                {
                    "time": "2024:06:05 09:05:00",
                    "buses": [
                        {
                            "bus_plate": "29B03201",
                            "passenger_count": 18
                        },
                        {
                            "bus_plate": "29B03202",
                            "passenger_count": 14
                        },
                        {
                            "bus_plate": "29B03203",
                            "passenger_count": 30
                        },
                        {
                            "bus_plate": "29B03204",
                            "passenger_count": 25
                        },
                        {
                            "bus_plate": "29B03205",
                            "passenger_count": 28
                        }
                    ]
                }
            ]
        },
        {
            "route": "33",
            "total_passenger": 2888,
            "graph_data": [
                {
                    "time": "2024:06:05 12:00:00",
                    "buses": [
                        {
                            "bus_plate": "29B03301",
                            "passenger_count": 22
                        },
                        {
                            "bus_plate": "29B03302",
                            "passenger_count": 2
                        },
                        {
                            "bus_plate": "29B03303",
                            "passenger_count": 4
                        },
                        {
                            "bus_plate": "29B03304",
                            "passenger_count": 1
                        },
                        {
                            "bus_plate": "29B03305",
                            "passenger_count": 18
                        }
                    ]
                },
                {
                    "time": "2024:06:05 11:55:00",
                    "buses": [
                        {
                            "bus_plate": "29B03301",
                            "passenger_count": 29
                        },
                        {
                            "bus_plate": "29B03302",
                            "passenger_count": 27
                        },
                        {
                            "bus_plate": "29B03303",
                            "passenger_count": 13
                        },
                        {
                            "bus_plate": "29B03304",
                            "passenger_count": 29
                        },
                        {
                            "bus_plate": "29B03305",
                            "passenger_count": 7
                        }
                    ]
                },
                {
                    "time": "2024:06:05 11:50:00",
                    "buses": [
                        {
                            "bus_plate": "29B03301",
                            "passenger_count": 20
                        },
                        {
                            "bus_plate": "29B03302",
                            "passenger_count": 15
                        },
                        {
                            "bus_plate": "29B03303",
                            "passenger_count": 3
                        },
                        {
                            "bus_plate": "29B03304",
                            "passenger_count": 12
                        },
                        {
                            "bus_plate": "29B03305",
                            "passenger_count": 7
                        }
                    ]
                },
                {
                    "time": "2024:06:05 11:45:00",
                    "buses": [
                        {
                            "bus_plate": "29B03301",
                            "passenger_count": 15
                        },
                        {
                            "bus_plate": "29B03302",
                            "passenger_count": 13
                        },
                        {
                            "bus_plate": "29B03303",
                            "passenger_count": 13
                        },
                        {
                            "bus_plate": "29B03304",
                            "passenger_count": 21
                        },
                        {
                            "bus_plate": "29B03305",
                            "passenger_count": 5
                        }
                    ]
                },
                {
                    "time": "2024:06:05 11:40:00",
                    "buses": [
                        {
                            "bus_plate": "29B03301",
                            "passenger_count": 9
                        },
                        {
                            "bus_plate": "29B03302",
                            "passenger_count": 21
                        },
                        {
                            "bus_plate": "29B03303",
                            "passenger_count": 20
                        },
                        {
                            "bus_plate": "29B03304",
                            "passenger_count": 28
                        },
                        {
                            "bus_plate": "29B03305",
                            "passenger_count": 5
                        }
                    ]
                },
                {
                    "time": "2024:06:05 11:35:00",
                    "buses": [
                        {
                            "bus_plate": "29B03301",
                            "passenger_count": 8
                        },
                        {
                            "bus_plate": "29B03302",
                            "passenger_count": 30
                        },
                        {
                            "bus_plate": "29B03303",
                            "passenger_count": 12
                        },
                        {
                            "bus_plate": "29B03304",
                            "passenger_count": 11
                        },
                        {
                            "bus_plate": "29B03305",
                            "passenger_count": 6
                        }
                    ]
                },
                {
                    "time": "2024:06:05 11:30:00",
                    "buses": [
                        {
                            "bus_plate": "29B03301",
                            "passenger_count": 11
                        },
                        {
                            "bus_plate": "29B03302",
                            "passenger_count": 10
                        },
                        {
                            "bus_plate": "29B03303",
                            "passenger_count": 29
                        },
                        {
                            "bus_plate": "29B03304",
                            "passenger_count": 17
                        },
                        {
                            "bus_plate": "29B03305",
                            "passenger_count": 15
                        }
                    ]
                },
                {
                    "time": "2024:06:05 11:25:00",
                    "buses": [
                        {
                            "bus_plate": "29B03301",
                            "passenger_count": 9
                        },
                        {
                            "bus_plate": "29B03302",
                            "passenger_count": 27
                        },
                        {
                            "bus_plate": "29B03303",
                            "passenger_count": 10
                        },
                        {
                            "bus_plate": "29B03304",
                            "passenger_count": 16
                        },
                        {
                            "bus_plate": "29B03305",
                            "passenger_count": 3
                        }
                    ]
                },
                {
                    "time": "2024:06:05 11:20:00",
                    "buses": [
                        {
                            "bus_plate": "29B03301",
                            "passenger_count": 10
                        },
                        {
                            "bus_plate": "29B03302",
                            "passenger_count": 8
                        },
                        {
                            "bus_plate": "29B03303",
                            "passenger_count": 2
                        },
                        {
                            "bus_plate": "29B03304",
                            "passenger_count": 29
                        },
                        {
                            "bus_plate": "29B03305",
                            "passenger_count": 4
                        }
                    ]
                },
                {
                    "time": "2024:06:05 11:15:00",
                    "buses": [
                        {
                            "bus_plate": "29B03301",
                            "passenger_count": 7
                        },
                        {
                            "bus_plate": "29B03302",
                            "passenger_count": 9
                        },
                        {
                            "bus_plate": "29B03303",
                            "passenger_count": 20
                        },
                        {
                            "bus_plate": "29B03304",
                            "passenger_count": 23
                        },
                        {
                            "bus_plate": "29B03305",
                            "passenger_count": 5
                        }
                    ]
                },
                {
                    "time": "2024:06:05 11:10:00",
                    "buses": [
                        {
                            "bus_plate": "29B03301",
                            "passenger_count": 21
                        },
                        {
                            "bus_plate": "29B03302",
                            "passenger_count": 18
                        },
                        {
                            "bus_plate": "29B03303",
                            "passenger_count": 10
                        },
                        {
                            "bus_plate": "29B03304",
                            "passenger_count": 17
                        },
                        {
                            "bus_plate": "29B03305",
                            "passenger_count": 1
                        }
                    ]
                },
                {
                    "time": "2024:06:05 11:05:00",
                    "buses": [
                        {
                            "bus_plate": "29B03301",
                            "passenger_count": 18
                        },
                        {
                            "bus_plate": "29B03302",
                            "passenger_count": 20
                        },
                        {
                            "bus_plate": "29B03303",
                            "passenger_count": 12
                        },
                        {
                            "bus_plate": "29B03304",
                            "passenger_count": 11
                        },
                        {
                            "bus_plate": "29B03305",
                            "passenger_count": 6
                        }
                    ]
                },
                {
                    "time": "2024:06:05 11:00:00",
                    "buses": [
                        {
                            "bus_plate": "29B03301",
                            "passenger_count": 24
                        },
                        {
                            "bus_plate": "29B03302",
                            "passenger_count": 23
                        },
                        {
                            "bus_plate": "29B03303",
                            "passenger_count": 19
                        },
                        {
                            "bus_plate": "29B03304",
                            "passenger_count": 7
                        },
                        {
                            "bus_plate": "29B03305",
                            "passenger_count": 27
                        }
                    ]
                },
                {
                    "time": "2024:06:05 10:55:00",
                    "buses": [
                        {
                            "bus_plate": "29B03301",
                            "passenger_count": 4
                        },
                        {
                            "bus_plate": "29B03302",
                            "passenger_count": 13
                        },
                        {
                            "bus_plate": "29B03303",
                            "passenger_count": 5
                        },
                        {
                            "bus_plate": "29B03304",
                            "passenger_count": 20
                        },
                        {
                            "bus_plate": "29B03305",
                            "passenger_count": 27
                        }
                    ]
                },
                {
                    "time": "2024:06:05 10:50:00",
                    "buses": [
                        {
                            "bus_plate": "29B03301",
                            "passenger_count": 9
                        },
                        {
                            "bus_plate": "29B03302",
                            "passenger_count": 4
                        },
                        {
                            "bus_plate": "29B03303",
                            "passenger_count": 30
                        },
                        {
                            "bus_plate": "29B03304",
                            "passenger_count": 22
                        },
                        {
                            "bus_plate": "29B03305",
                            "passenger_count": 14
                        }
                    ]
                },
                {
                    "time": "2024:06:05 10:45:00",
                    "buses": [
                        {
                            "bus_plate": "29B03301",
                            "passenger_count": 30
                        },
                        {
                            "bus_plate": "29B03302",
                            "passenger_count": 3
                        },
                        {
                            "bus_plate": "29B03303",
                            "passenger_count": 5
                        },
                        {
                            "bus_plate": "29B03304",
                            "passenger_count": 30
                        },
                        {
                            "bus_plate": "29B03305",
                            "passenger_count": 20
                        }
                    ]
                },
                {
                    "time": "2024:06:05 10:40:00",
                    "buses": [
                        {
                            "bus_plate": "29B03301",
                            "passenger_count": 15
                        },
                        {
                            "bus_plate": "29B03302",
                            "passenger_count": 13
                        },
                        {
                            "bus_plate": "29B03303",
                            "passenger_count": 17
                        },
                        {
                            "bus_plate": "29B03304",
                            "passenger_count": 13
                        },
                        {
                            "bus_plate": "29B03305",
                            "passenger_count": 30
                        }
                    ]
                },
                {
                    "time": "2024:06:05 10:35:00",
                    "buses": [
                        {
                            "bus_plate": "29B03301",
                            "passenger_count": 12
                        },
                        {
                            "bus_plate": "29B03302",
                            "passenger_count": 11
                        },
                        {
                            "bus_plate": "29B03303",
                            "passenger_count": 15
                        },
                        {
                            "bus_plate": "29B03304",
                            "passenger_count": 7
                        },
                        {
                            "bus_plate": "29B03305",
                            "passenger_count": 22
                        }
                    ]
                },
                {
                    "time": "2024:06:05 10:30:00",
                    "buses": [
                        {
                            "bus_plate": "29B03301",
                            "passenger_count": 28
                        },
                        {
                            "bus_plate": "29B03302",
                            "passenger_count": 29
                        },
                        {
                            "bus_plate": "29B03303",
                            "passenger_count": 3
                        },
                        {
                            "bus_plate": "29B03304",
                            "passenger_count": 17
                        },
                        {
                            "bus_plate": "29B03305",
                            "passenger_count": 23
                        }
                    ]
                },
                {
                    "time": "2024:06:05 10:25:00",
                    "buses": [
                        {
                            "bus_plate": "29B03301",
                            "passenger_count": 29
                        },
                        {
                            "bus_plate": "29B03302",
                            "passenger_count": 2
                        },
                        {
                            "bus_plate": "29B03303",
                            "passenger_count": 13
                        },
                        {
                            "bus_plate": "29B03304",
                            "passenger_count": 12
                        },
                        {
                            "bus_plate": "29B03305",
                            "passenger_count": 18
                        }
                    ]
                },
                {
                    "time": "2024:06:05 10:20:00",
                    "buses": [
                        {
                            "bus_plate": "29B03301",
                            "passenger_count": 16
                        },
                        {
                            "bus_plate": "29B03302",
                            "passenger_count": 30
                        },
                        {
                            "bus_plate": "29B03303",
                            "passenger_count": 13
                        },
                        {
                            "bus_plate": "29B03304",
                            "passenger_count": 13
                        },
                        {
                            "bus_plate": "29B03305",
                            "passenger_count": 22
                        }
                    ]
                },
                {
                    "time": "2024:06:05 10:15:00",
                    "buses": [
                        {
                            "bus_plate": "29B03301",
                            "passenger_count": 17
                        },
                        {
                            "bus_plate": "29B03302",
                            "passenger_count": 23
                        },
                        {
                            "bus_plate": "29B03303",
                            "passenger_count": 29
                        },
                        {
                            "bus_plate": "29B03304",
                            "passenger_count": 8
                        },
                        {
                            "bus_plate": "29B03305",
                            "passenger_count": 22
                        }
                    ]
                },
                {
                    "time": "2024:06:05 10:10:00",
                    "buses": [
                        {
                            "bus_plate": "29B03301",
                            "passenger_count": 12
                        },
                        {
                            "bus_plate": "29B03302",
                            "passenger_count": 28
                        },
                        {
                            "bus_plate": "29B03303",
                            "passenger_count": 13
                        },
                        {
                            "bus_plate": "29B03304",
                            "passenger_count": 15
                        },
                        {
                            "bus_plate": "29B03305",
                            "passenger_count": 6
                        }
                    ]
                },
                {
                    "time": "2024:06:05 10:05:00",
                    "buses": [
                        {
                            "bus_plate": "29B03301",
                            "passenger_count": 12
                        },
                        {
                            "bus_plate": "29B03302",
                            "passenger_count": 20
                        },
                        {
                            "bus_plate": "29B03303",
                            "passenger_count": 5
                        },
                        {
                            "bus_plate": "29B03304",
                            "passenger_count": 13
                        },
                        {
                            "bus_plate": "29B03305",
                            "passenger_count": 26
                        }
                    ]
                },
                {
                    "time": "2024:06:05 10:00:00",
                    "buses": [
                        {
                            "bus_plate": "29B03301",
                            "passenger_count": 22
                        },
                        {
                            "bus_plate": "29B03302",
                            "passenger_count": 17
                        },
                        {
                            "bus_plate": "29B03303",
                            "passenger_count": 9
                        },
                        {
                            "bus_plate": "29B03304",
                            "passenger_count": 19
                        },
                        {
                            "bus_plate": "29B03305",
                            "passenger_count": 23
                        }
                    ]
                },
                {
                    "time": "2024:06:05 09:55:00",
                    "buses": [
                        {
                            "bus_plate": "29B03301",
                            "passenger_count": 8
                        },
                        {
                            "bus_plate": "29B03302",
                            "passenger_count": 24
                        },
                        {
                            "bus_plate": "29B03303",
                            "passenger_count": 26
                        },
                        {
                            "bus_plate": "29B03304",
                            "passenger_count": 29
                        },
                        {
                            "bus_plate": "29B03305",
                            "passenger_count": 8
                        }
                    ]
                },
                {
                    "time": "2024:06:05 09:50:00",
                    "buses": [
                        {
                            "bus_plate": "29B03301",
                            "passenger_count": 4
                        },
                        {
                            "bus_plate": "29B03302",
                            "passenger_count": 23
                        },
                        {
                            "bus_plate": "29B03303",
                            "passenger_count": 21
                        },
                        {
                            "bus_plate": "29B03304",
                            "passenger_count": 7
                        },
                        {
                            "bus_plate": "29B03305",
                            "passenger_count": 7
                        }
                    ]
                },
                {
                    "time": "2024:06:05 09:45:00",
                    "buses": [
                        {
                            "bus_plate": "29B03301",
                            "passenger_count": 28
                        },
                        {
                            "bus_plate": "29B03302",
                            "passenger_count": 29
                        },
                        {
                            "bus_plate": "29B03303",
                            "passenger_count": 27
                        },
                        {
                            "bus_plate": "29B03304",
                            "passenger_count": 8
                        },
                        {
                            "bus_plate": "29B03305",
                            "passenger_count": 26
                        }
                    ]
                },
                {
                    "time": "2024:06:05 09:40:00",
                    "buses": [
                        {
                            "bus_plate": "29B03301",
                            "passenger_count": 18
                        },
                        {
                            "bus_plate": "29B03302",
                            "passenger_count": 25
                        },
                        {
                            "bus_plate": "29B03303",
                            "passenger_count": 20
                        },
                        {
                            "bus_plate": "29B03304",
                            "passenger_count": 13
                        },
                        {
                            "bus_plate": "29B03305",
                            "passenger_count": 21
                        }
                    ]
                },
                {
                    "time": "2024:06:05 09:35:00",
                    "buses": [
                        {
                            "bus_plate": "29B03301",
                            "passenger_count": 5
                        },
                        {
                            "bus_plate": "29B03302",
                            "passenger_count": 12
                        },
                        {
                            "bus_plate": "29B03303",
                            "passenger_count": 30
                        },
                        {
                            "bus_plate": "29B03304",
                            "passenger_count": 12
                        },
                        {
                            "bus_plate": "29B03305",
                            "passenger_count": 29
                        }
                    ]
                },
                {
                    "time": "2024:06:05 09:30:00",
                    "buses": [
                        {
                            "bus_plate": "29B03301",
                            "passenger_count": 17
                        },
                        {
                            "bus_plate": "29B03302",
                            "passenger_count": 8
                        },
                        {
                            "bus_plate": "29B03303",
                            "passenger_count": 26
                        },
                        {
                            "bus_plate": "29B03304",
                            "passenger_count": 23
                        },
                        {
                            "bus_plate": "29B03305",
                            "passenger_count": 29
                        }
                    ]
                },
                {
                    "time": "2024:06:05 09:25:00",
                    "buses": [
                        {
                            "bus_plate": "29B03301",
                            "passenger_count": 2
                        },
                        {
                            "bus_plate": "29B03302",
                            "passenger_count": 14
                        },
                        {
                            "bus_plate": "29B03303",
                            "passenger_count": 16
                        },
                        {
                            "bus_plate": "29B03304",
                            "passenger_count": 14
                        },
                        {
                            "bus_plate": "29B03305",
                            "passenger_count": 14
                        }
                    ]
                },
                {
                    "time": "2024:06:05 09:20:00",
                    "buses": [
                        {
                            "bus_plate": "29B03301",
                            "passenger_count": 9
                        },
                        {
                            "bus_plate": "29B03302",
                            "passenger_count": 23
                        },
                        {
                            "bus_plate": "29B03303",
                            "passenger_count": 19
                        },
                        {
                            "bus_plate": "29B03304",
                            "passenger_count": 1
                        },
                        {
                            "bus_plate": "29B03305",
                            "passenger_count": 23
                        }
                    ]
                },
                {
                    "time": "2024:06:05 09:15:00",
                    "buses": [
                        {
                            "bus_plate": "29B03301",
                            "passenger_count": 3
                        },
                        {
                            "bus_plate": "29B03302",
                            "passenger_count": 17
                        },
                        {
                            "bus_plate": "29B03303",
                            "passenger_count": 28
                        },
                        {
                            "bus_plate": "29B03304",
                            "passenger_count": 29
                        },
                        {
                            "bus_plate": "29B03305",
                            "passenger_count": 5
                        }
                    ]
                },
                {
                    "time": "2024:06:05 09:10:00",
                    "buses": [
                        {
                            "bus_plate": "29B03301",
                            "passenger_count": 24
                        },
                        {
                            "bus_plate": "29B03302",
                            "passenger_count": 15
                        },
                        {
                            "bus_plate": "29B03303",
                            "passenger_count": 10
                        },
                        {
                            "bus_plate": "29B03304",
                            "passenger_count": 2
                        },
                        {
                            "bus_plate": "29B03305",
                            "passenger_count": 27
                        }
                    ]
                },
                {
                    "time": "2024:06:05 09:05:00",
                    "buses": [
                        {
                            "bus_plate": "29B03301",
                            "passenger_count": 19
                        },
                        {
                            "bus_plate": "29B03302",
                            "passenger_count": 21
                        },
                        {
                            "bus_plate": "29B03303",
                            "passenger_count": 25
                        },
                        {
                            "bus_plate": "29B03304",
                            "passenger_count": 20
                        },
                        {
                            "bus_plate": "29B03305",
                            "passenger_count": 23
                        }
                    ]
                }
            ]
        },
        {
            "route": "34",
            "total_passenger": 2810,
            "graph_data": [
                {
                    "time": "2024:06:05 12:00:00",
                    "buses": [
                        {
                            "bus_plate": "29B03401",
                            "passenger_count": 10
                        },
                        {
                            "bus_plate": "29B03402",
                            "passenger_count": 21
                        },
                        {
                            "bus_plate": "29B03403",
                            "passenger_count": 30
                        },
                        {
                            "bus_plate": "29B03404",
                            "passenger_count": 17
                        },
                        {
                            "bus_plate": "29B03405",
                            "passenger_count": 27
                        }
                    ]
                },
                {
                    "time": "2024:06:05 11:55:00",
                    "buses": [
                        {
                            "bus_plate": "29B03401",
                            "passenger_count": 3
                        },
                        {
                            "bus_plate": "29B03402",
                            "passenger_count": 2
                        },
                        {
                            "bus_plate": "29B03403",
                            "passenger_count": 21
                        },
                        {
                            "bus_plate": "29B03404",
                            "passenger_count": 2
                        },
                        {
                            "bus_plate": "29B03405",
                            "passenger_count": 3
                        }
                    ]
                },
                {
                    "time": "2024:06:05 11:50:00",
                    "buses": [
                        {
                            "bus_plate": "29B03401",
                            "passenger_count": 27
                        },
                        {
                            "bus_plate": "29B03402",
                            "passenger_count": 3
                        },
                        {
                            "bus_plate": "29B03403",
                            "passenger_count": 1
                        },
                        {
                            "bus_plate": "29B03404",
                            "passenger_count": 16
                        },
                        {
                            "bus_plate": "29B03405",
                            "passenger_count": 12
                        }
                    ]
                },
                {
                    "time": "2024:06:05 11:45:00",
                    "buses": [
                        {
                            "bus_plate": "29B03401",
                            "passenger_count": 14
                        },
                        {
                            "bus_plate": "29B03402",
                            "passenger_count": 27
                        },
                        {
                            "bus_plate": "29B03403",
                            "passenger_count": 21
                        },
                        {
                            "bus_plate": "29B03404",
                            "passenger_count": 8
                        },
                        {
                            "bus_plate": "29B03405",
                            "passenger_count": 11
                        }
                    ]
                },
                {
                    "time": "2024:06:05 11:40:00",
                    "buses": [
                        {
                            "bus_plate": "29B03401",
                            "passenger_count": 10
                        },
                        {
                            "bus_plate": "29B03402",
                            "passenger_count": 9
                        },
                        {
                            "bus_plate": "29B03403",
                            "passenger_count": 11
                        },
                        {
                            "bus_plate": "29B03404",
                            "passenger_count": 11
                        },
                        {
                            "bus_plate": "29B03405",
                            "passenger_count": 14
                        }
                    ]
                },
                {
                    "time": "2024:06:05 11:35:00",
                    "buses": [
                        {
                            "bus_plate": "29B03401",
                            "passenger_count": 11
                        },
                        {
                            "bus_plate": "29B03402",
                            "passenger_count": 23
                        },
                        {
                            "bus_plate": "29B03403",
                            "passenger_count": 20
                        },
                        {
                            "bus_plate": "29B03404",
                            "passenger_count": 19
                        },
                        {
                            "bus_plate": "29B03405",
                            "passenger_count": 29
                        }
                    ]
                },
                {
                    "time": "2024:06:05 11:30:00",
                    "buses": [
                        {
                            "bus_plate": "29B03401",
                            "passenger_count": 16
                        },
                        {
                            "bus_plate": "29B03402",
                            "passenger_count": 12
                        },
                        {
                            "bus_plate": "29B03403",
                            "passenger_count": 23
                        },
                        {
                            "bus_plate": "29B03404",
                            "passenger_count": 24
                        },
                        {
                            "bus_plate": "29B03405",
                            "passenger_count": 20
                        }
                    ]
                },
                {
                    "time": "2024:06:05 11:25:00",
                    "buses": [
                        {
                            "bus_plate": "29B03401",
                            "passenger_count": 28
                        },
                        {
                            "bus_plate": "29B03402",
                            "passenger_count": 29
                        },
                        {
                            "bus_plate": "29B03403",
                            "passenger_count": 3
                        },
                        {
                            "bus_plate": "29B03404",
                            "passenger_count": 17
                        },
                        {
                            "bus_plate": "29B03405",
                            "passenger_count": 27
                        }
                    ]
                },
                {
                    "time": "2024:06:05 11:20:00",
                    "buses": [
                        {
                            "bus_plate": "29B03401",
                            "passenger_count": 1
                        },
                        {
                            "bus_plate": "29B03402",
                            "passenger_count": 23
                        },
                        {
                            "bus_plate": "29B03403",
                            "passenger_count": 2
                        },
                        {
                            "bus_plate": "29B03404",
                            "passenger_count": 29
                        },
                        {
                            "bus_plate": "29B03405",
                            "passenger_count": 16
                        }
                    ]
                },
                {
                    "time": "2024:06:05 11:15:00",
                    "buses": [
                        {
                            "bus_plate": "29B03401",
                            "passenger_count": 25
                        },
                        {
                            "bus_plate": "29B03402",
                            "passenger_count": 18
                        },
                        {
                            "bus_plate": "29B03403",
                            "passenger_count": 16
                        },
                        {
                            "bus_plate": "29B03404",
                            "passenger_count": 6
                        },
                        {
                            "bus_plate": "29B03405",
                            "passenger_count": 18
                        }
                    ]
                },
                {
                    "time": "2024:06:05 11:10:00",
                    "buses": [
                        {
                            "bus_plate": "29B03401",
                            "passenger_count": 16
                        },
                        {
                            "bus_plate": "29B03402",
                            "passenger_count": 14
                        },
                        {
                            "bus_plate": "29B03403",
                            "passenger_count": 23
                        },
                        {
                            "bus_plate": "29B03404",
                            "passenger_count": 6
                        },
                        {
                            "bus_plate": "29B03405",
                            "passenger_count": 25
                        }
                    ]
                },
                {
                    "time": "2024:06:05 11:05:00",
                    "buses": [
                        {
                            "bus_plate": "29B03401",
                            "passenger_count": 25
                        },
                        {
                            "bus_plate": "29B03402",
                            "passenger_count": 10
                        },
                        {
                            "bus_plate": "29B03403",
                            "passenger_count": 12
                        },
                        {
                            "bus_plate": "29B03404",
                            "passenger_count": 13
                        },
                        {
                            "bus_plate": "29B03405",
                            "passenger_count": 26
                        }
                    ]
                },
                {
                    "time": "2024:06:05 11:00:00",
                    "buses": [
                        {
                            "bus_plate": "29B03401",
                            "passenger_count": 22
                        },
                        {
                            "bus_plate": "29B03402",
                            "passenger_count": 6
                        },
                        {
                            "bus_plate": "29B03403",
                            "passenger_count": 23
                        },
                        {
                            "bus_plate": "29B03404",
                            "passenger_count": 4
                        },
                        {
                            "bus_plate": "29B03405",
                            "passenger_count": 6
                        }
                    ]
                },
                {
                    "time": "2024:06:05 10:55:00",
                    "buses": [
                        {
                            "bus_plate": "29B03401",
                            "passenger_count": 19
                        },
                        {
                            "bus_plate": "29B03402",
                            "passenger_count": 22
                        },
                        {
                            "bus_plate": "29B03403",
                            "passenger_count": 15
                        },
                        {
                            "bus_plate": "29B03404",
                            "passenger_count": 20
                        },
                        {
                            "bus_plate": "29B03405",
                            "passenger_count": 22
                        }
                    ]
                },
                {
                    "time": "2024:06:05 10:50:00",
                    "buses": [
                        {
                            "bus_plate": "29B03401",
                            "passenger_count": 4
                        },
                        {
                            "bus_plate": "29B03402",
                            "passenger_count": 7
                        },
                        {
                            "bus_plate": "29B03403",
                            "passenger_count": 19
                        },
                        {
                            "bus_plate": "29B03404",
                            "passenger_count": 8
                        },
                        {
                            "bus_plate": "29B03405",
                            "passenger_count": 19
                        }
                    ]
                },
                {
                    "time": "2024:06:05 10:45:00",
                    "buses": [
                        {
                            "bus_plate": "29B03401",
                            "passenger_count": 13
                        },
                        {
                            "bus_plate": "29B03402",
                            "passenger_count": 23
                        },
                        {
                            "bus_plate": "29B03403",
                            "passenger_count": 20
                        },
                        {
                            "bus_plate": "29B03404",
                            "passenger_count": 25
                        },
                        {
                            "bus_plate": "29B03405",
                            "passenger_count": 3
                        }
                    ]
                },
                {
                    "time": "2024:06:05 10:40:00",
                    "buses": [
                        {
                            "bus_plate": "29B03401",
                            "passenger_count": 8
                        },
                        {
                            "bus_plate": "29B03402",
                            "passenger_count": 14
                        },
                        {
                            "bus_plate": "29B03403",
                            "passenger_count": 6
                        },
                        {
                            "bus_plate": "29B03404",
                            "passenger_count": 11
                        },
                        {
                            "bus_plate": "29B03405",
                            "passenger_count": 26
                        }
                    ]
                },
                {
                    "time": "2024:06:05 10:35:00",
                    "buses": [
                        {
                            "bus_plate": "29B03401",
                            "passenger_count": 10
                        },
                        {
                            "bus_plate": "29B03402",
                            "passenger_count": 2
                        },
                        {
                            "bus_plate": "29B03403",
                            "passenger_count": 18
                        },
                        {
                            "bus_plate": "29B03404",
                            "passenger_count": 18
                        },
                        {
                            "bus_plate": "29B03405",
                            "passenger_count": 16
                        }
                    ]
                },
                {
                    "time": "2024:06:05 10:30:00",
                    "buses": [
                        {
                            "bus_plate": "29B03401",
                            "passenger_count": 20
                        },
                        {
                            "bus_plate": "29B03402",
                            "passenger_count": 14
                        },
                        {
                            "bus_plate": "29B03403",
                            "passenger_count": 16
                        },
                        {
                            "bus_plate": "29B03404",
                            "passenger_count": 7
                        },
                        {
                            "bus_plate": "29B03405",
                            "passenger_count": 9
                        }
                    ]
                },
                {
                    "time": "2024:06:05 10:25:00",
                    "buses": [
                        {
                            "bus_plate": "29B03401",
                            "passenger_count": 10
                        },
                        {
                            "bus_plate": "29B03402",
                            "passenger_count": 12
                        },
                        {
                            "bus_plate": "29B03403",
                            "passenger_count": 9
                        },
                        {
                            "bus_plate": "29B03404",
                            "passenger_count": 30
                        },
                        {
                            "bus_plate": "29B03405",
                            "passenger_count": 21
                        }
                    ]
                },
                {
                    "time": "2024:06:05 10:20:00",
                    "buses": [
                        {
                            "bus_plate": "29B03401",
                            "passenger_count": 15
                        },
                        {
                            "bus_plate": "29B03402",
                            "passenger_count": 20
                        },
                        {
                            "bus_plate": "29B03403",
                            "passenger_count": 24
                        },
                        {
                            "bus_plate": "29B03404",
                            "passenger_count": 29
                        },
                        {
                            "bus_plate": "29B03405",
                            "passenger_count": 23
                        }
                    ]
                },
                {
                    "time": "2024:06:05 10:15:00",
                    "buses": [
                        {
                            "bus_plate": "29B03401",
                            "passenger_count": 13
                        },
                        {
                            "bus_plate": "29B03402",
                            "passenger_count": 13
                        },
                        {
                            "bus_plate": "29B03403",
                            "passenger_count": 25
                        },
                        {
                            "bus_plate": "29B03404",
                            "passenger_count": 13
                        },
                        {
                            "bus_plate": "29B03405",
                            "passenger_count": 15
                        }
                    ]
                },
                {
                    "time": "2024:06:05 10:10:00",
                    "buses": [
                        {
                            "bus_plate": "29B03401",
                            "passenger_count": 27
                        },
                        {
                            "bus_plate": "29B03402",
                            "passenger_count": 26
                        },
                        {
                            "bus_plate": "29B03403",
                            "passenger_count": 29
                        },
                        {
                            "bus_plate": "29B03404",
                            "passenger_count": 8
                        },
                        {
                            "bus_plate": "29B03405",
                            "passenger_count": 11
                        }
                    ]
                },
                {
                    "time": "2024:06:05 10:05:00",
                    "buses": [
                        {
                            "bus_plate": "29B03401",
                            "passenger_count": 14
                        },
                        {
                            "bus_plate": "29B03402",
                            "passenger_count": 16
                        },
                        {
                            "bus_plate": "29B03403",
                            "passenger_count": 16
                        },
                        {
                            "bus_plate": "29B03404",
                            "passenger_count": 4
                        },
                        {
                            "bus_plate": "29B03405",
                            "passenger_count": 17
                        }
                    ]
                },
                {
                    "time": "2024:06:05 10:00:00",
                    "buses": [
                        {
                            "bus_plate": "29B03401",
                            "passenger_count": 28
                        },
                        {
                            "bus_plate": "29B03402",
                            "passenger_count": 28
                        },
                        {
                            "bus_plate": "29B03403",
                            "passenger_count": 18
                        },
                        {
                            "bus_plate": "29B03404",
                            "passenger_count": 21
                        },
                        {
                            "bus_plate": "29B03405",
                            "passenger_count": 6
                        }
                    ]
                },
                {
                    "time": "2024:06:05 09:55:00",
                    "buses": [
                        {
                            "bus_plate": "29B03401",
                            "passenger_count": 3
                        },
                        {
                            "bus_plate": "29B03402",
                            "passenger_count": 16
                        },
                        {
                            "bus_plate": "29B03403",
                            "passenger_count": 22
                        },
                        {
                            "bus_plate": "29B03404",
                            "passenger_count": 21
                        },
                        {
                            "bus_plate": "29B03405",
                            "passenger_count": 6
                        }
                    ]
                },
                {
                    "time": "2024:06:05 09:50:00",
                    "buses": [
                        {
                            "bus_plate": "29B03401",
                            "passenger_count": 30
                        },
                        {
                            "bus_plate": "29B03402",
                            "passenger_count": 21
                        },
                        {
                            "bus_plate": "29B03403",
                            "passenger_count": 15
                        },
                        {
                            "bus_plate": "29B03404",
                            "passenger_count": 4
                        },
                        {
                            "bus_plate": "29B03405",
                            "passenger_count": 6
                        }
                    ]
                },
                {
                    "time": "2024:06:05 09:45:00",
                    "buses": [
                        {
                            "bus_plate": "29B03401",
                            "passenger_count": 12
                        },
                        {
                            "bus_plate": "29B03402",
                            "passenger_count": 3
                        },
                        {
                            "bus_plate": "29B03403",
                            "passenger_count": 15
                        },
                        {
                            "bus_plate": "29B03404",
                            "passenger_count": 7
                        },
                        {
                            "bus_plate": "29B03405",
                            "passenger_count": 16
                        }
                    ]
                },
                {
                    "time": "2024:06:05 09:40:00",
                    "buses": [
                        {
                            "bus_plate": "29B03401",
                            "passenger_count": 2
                        },
                        {
                            "bus_plate": "29B03402",
                            "passenger_count": 25
                        },
                        {
                            "bus_plate": "29B03403",
                            "passenger_count": 13
                        },
                        {
                            "bus_plate": "29B03404",
                            "passenger_count": 1
                        },
                        {
                            "bus_plate": "29B03405",
                            "passenger_count": 13
                        }
                    ]
                },
                {
                    "time": "2024:06:05 09:35:00",
                    "buses": [
                        {
                            "bus_plate": "29B03401",
                            "passenger_count": 18
                        },
                        {
                            "bus_plate": "29B03402",
                            "passenger_count": 16
                        },
                        {
                            "bus_plate": "29B03403",
                            "passenger_count": 14
                        },
                        {
                            "bus_plate": "29B03404",
                            "passenger_count": 24
                        },
                        {
                            "bus_plate": "29B03405",
                            "passenger_count": 12
                        }
                    ]
                },
                {
                    "time": "2024:06:05 09:30:00",
                    "buses": [
                        {
                            "bus_plate": "29B03401",
                            "passenger_count": 29
                        },
                        {
                            "bus_plate": "29B03402",
                            "passenger_count": 4
                        },
                        {
                            "bus_plate": "29B03403",
                            "passenger_count": 23
                        },
                        {
                            "bus_plate": "29B03404",
                            "passenger_count": 29
                        },
                        {
                            "bus_plate": "29B03405",
                            "passenger_count": 24
                        }
                    ]
                },
                {
                    "time": "2024:06:05 09:25:00",
                    "buses": [
                        {
                            "bus_plate": "29B03401",
                            "passenger_count": 3
                        },
                        {
                            "bus_plate": "29B03402",
                            "passenger_count": 20
                        },
                        {
                            "bus_plate": "29B03403",
                            "passenger_count": 6
                        },
                        {
                            "bus_plate": "29B03404",
                            "passenger_count": 22
                        },
                        {
                            "bus_plate": "29B03405",
                            "passenger_count": 30
                        }
                    ]
                },
                {
                    "time": "2024:06:05 09:20:00",
                    "buses": [
                        {
                            "bus_plate": "29B03401",
                            "passenger_count": 9
                        },
                        {
                            "bus_plate": "29B03402",
                            "passenger_count": 13
                        },
                        {
                            "bus_plate": "29B03403",
                            "passenger_count": 12
                        },
                        {
                            "bus_plate": "29B03404",
                            "passenger_count": 14
                        },
                        {
                            "bus_plate": "29B03405",
                            "passenger_count": 5
                        }
                    ]
                },
                {
                    "time": "2024:06:05 09:15:00",
                    "buses": [
                        {
                            "bus_plate": "29B03401",
                            "passenger_count": 27
                        },
                        {
                            "bus_plate": "29B03402",
                            "passenger_count": 29
                        },
                        {
                            "bus_plate": "29B03403",
                            "passenger_count": 24
                        },
                        {
                            "bus_plate": "29B03404",
                            "passenger_count": 11
                        },
                        {
                            "bus_plate": "29B03405",
                            "passenger_count": 1
                        }
                    ]
                },
                {
                    "time": "2024:06:05 09:10:00",
                    "buses": [
                        {
                            "bus_plate": "29B03401",
                            "passenger_count": 2
                        },
                        {
                            "bus_plate": "29B03402",
                            "passenger_count": 23
                        },
                        {
                            "bus_plate": "29B03403",
                            "passenger_count": 30
                        },
                        {
                            "bus_plate": "29B03404",
                            "passenger_count": 13
                        },
                        {
                            "bus_plate": "29B03405",
                            "passenger_count": 23
                        }
                    ]
                },
                {
                    "time": "2024:06:05 09:05:00",
                    "buses": [
                        {
                            "bus_plate": "29B03401",
                            "passenger_count": 3
                        },
                        {
                            "bus_plate": "29B03402",
                            "passenger_count": 21
                        },
                        {
                            "bus_plate": "29B03403",
                            "passenger_count": 27
                        },
                        {
                            "bus_plate": "29B03404",
                            "passenger_count": 5
                        },
                        {
                            "bus_plate": "29B03405",
                            "passenger_count": 1
                        }
                    ]
                }
            ]
        },
        {
            "route": "35",
            "total_passenger": 2979,
            "graph_data": [
                {
                    "time": "2024:06:05 12:00:00",
                    "buses": [
                        {
                            "bus_plate": "29B03501",
                            "passenger_count": 11
                        },
                        {
                            "bus_plate": "29B03502",
                            "passenger_count": 11
                        },
                        {
                            "bus_plate": "29B03503",
                            "passenger_count": 17
                        },
                        {
                            "bus_plate": "29B03504",
                            "passenger_count": 15
                        },
                        {
                            "bus_plate": "29B03505",
                            "passenger_count": 16
                        }
                    ]
                },
                {
                    "time": "2024:06:05 11:55:00",
                    "buses": [
                        {
                            "bus_plate": "29B03501",
                            "passenger_count": 5
                        },
                        {
                            "bus_plate": "29B03502",
                            "passenger_count": 18
                        },
                        {
                            "bus_plate": "29B03503",
                            "passenger_count": 2
                        },
                        {
                            "bus_plate": "29B03504",
                            "passenger_count": 22
                        },
                        {
                            "bus_plate": "29B03505",
                            "passenger_count": 7
                        }
                    ]
                },
                {
                    "time": "2024:06:05 11:50:00",
                    "buses": [
                        {
                            "bus_plate": "29B03501",
                            "passenger_count": 13
                        },
                        {
                            "bus_plate": "29B03502",
                            "passenger_count": 26
                        },
                        {
                            "bus_plate": "29B03503",
                            "passenger_count": 29
                        },
                        {
                            "bus_plate": "29B03504",
                            "passenger_count": 22
                        },
                        {
                            "bus_plate": "29B03505",
                            "passenger_count": 21
                        }
                    ]
                },
                {
                    "time": "2024:06:05 11:45:00",
                    "buses": [
                        {
                            "bus_plate": "29B03501",
                            "passenger_count": 14
                        },
                        {
                            "bus_plate": "29B03502",
                            "passenger_count": 23
                        },
                        {
                            "bus_plate": "29B03503",
                            "passenger_count": 14
                        },
                        {
                            "bus_plate": "29B03504",
                            "passenger_count": 7
                        },
                        {
                            "bus_plate": "29B03505",
                            "passenger_count": 26
                        }
                    ]
                },
                {
                    "time": "2024:06:05 11:40:00",
                    "buses": [
                        {
                            "bus_plate": "29B03501",
                            "passenger_count": 21
                        },
                        {
                            "bus_plate": "29B03502",
                            "passenger_count": 5
                        },
                        {
                            "bus_plate": "29B03503",
                            "passenger_count": 7
                        },
                        {
                            "bus_plate": "29B03504",
                            "passenger_count": 30
                        },
                        {
                            "bus_plate": "29B03505",
                            "passenger_count": 30
                        }
                    ]
                },
                {
                    "time": "2024:06:05 11:35:00",
                    "buses": [
                        {
                            "bus_plate": "29B03501",
                            "passenger_count": 24
                        },
                        {
                            "bus_plate": "29B03502",
                            "passenger_count": 15
                        },
                        {
                            "bus_plate": "29B03503",
                            "passenger_count": 27
                        },
                        {
                            "bus_plate": "29B03504",
                            "passenger_count": 27
                        },
                        {
                            "bus_plate": "29B03505",
                            "passenger_count": 12
                        }
                    ]
                },
                {
                    "time": "2024:06:05 11:30:00",
                    "buses": [
                        {
                            "bus_plate": "29B03501",
                            "passenger_count": 21
                        },
                        {
                            "bus_plate": "29B03502",
                            "passenger_count": 15
                        },
                        {
                            "bus_plate": "29B03503",
                            "passenger_count": 9
                        },
                        {
                            "bus_plate": "29B03504",
                            "passenger_count": 21
                        },
                        {
                            "bus_plate": "29B03505",
                            "passenger_count": 30
                        }
                    ]
                },
                {
                    "time": "2024:06:05 11:25:00",
                    "buses": [
                        {
                            "bus_plate": "29B03501",
                            "passenger_count": 15
                        },
                        {
                            "bus_plate": "29B03502",
                            "passenger_count": 9
                        },
                        {
                            "bus_plate": "29B03503",
                            "passenger_count": 24
                        },
                        {
                            "bus_plate": "29B03504",
                            "passenger_count": 14
                        },
                        {
                            "bus_plate": "29B03505",
                            "passenger_count": 18
                        }
                    ]
                },
                {
                    "time": "2024:06:05 11:20:00",
                    "buses": [
                        {
                            "bus_plate": "29B03501",
                            "passenger_count": 13
                        },
                        {
                            "bus_plate": "29B03502",
                            "passenger_count": 20
                        },
                        {
                            "bus_plate": "29B03503",
                            "passenger_count": 24
                        },
                        {
                            "bus_plate": "29B03504",
                            "passenger_count": 21
                        },
                        {
                            "bus_plate": "29B03505",
                            "passenger_count": 14
                        }
                    ]
                },
                {
                    "time": "2024:06:05 11:15:00",
                    "buses": [
                        {
                            "bus_plate": "29B03501",
                            "passenger_count": 22
                        },
                        {
                            "bus_plate": "29B03502",
                            "passenger_count": 13
                        },
                        {
                            "bus_plate": "29B03503",
                            "passenger_count": 18
                        },
                        {
                            "bus_plate": "29B03504",
                            "passenger_count": 20
                        },
                        {
                            "bus_plate": "29B03505",
                            "passenger_count": 19
                        }
                    ]
                },
                {
                    "time": "2024:06:05 11:10:00",
                    "buses": [
                        {
                            "bus_plate": "29B03501",
                            "passenger_count": 10
                        },
                        {
                            "bus_plate": "29B03502",
                            "passenger_count": 23
                        },
                        {
                            "bus_plate": "29B03503",
                            "passenger_count": 3
                        },
                        {
                            "bus_plate": "29B03504",
                            "passenger_count": 16
                        },
                        {
                            "bus_plate": "29B03505",
                            "passenger_count": 19
                        }
                    ]
                },
                {
                    "time": "2024:06:05 11:05:00",
                    "buses": [
                        {
                            "bus_plate": "29B03501",
                            "passenger_count": 9
                        },
                        {
                            "bus_plate": "29B03502",
                            "passenger_count": 21
                        },
                        {
                            "bus_plate": "29B03503",
                            "passenger_count": 16
                        },
                        {
                            "bus_plate": "29B03504",
                            "passenger_count": 28
                        },
                        {
                            "bus_plate": "29B03505",
                            "passenger_count": 8
                        }
                    ]
                },
                {
                    "time": "2024:06:05 11:00:00",
                    "buses": [
                        {
                            "bus_plate": "29B03501",
                            "passenger_count": 29
                        },
                        {
                            "bus_plate": "29B03502",
                            "passenger_count": 24
                        },
                        {
                            "bus_plate": "29B03503",
                            "passenger_count": 19
                        },
                        {
                            "bus_plate": "29B03504",
                            "passenger_count": 7
                        },
                        {
                            "bus_plate": "29B03505",
                            "passenger_count": 23
                        }
                    ]
                },
                {
                    "time": "2024:06:05 10:55:00",
                    "buses": [
                        {
                            "bus_plate": "29B03501",
                            "passenger_count": 29
                        },
                        {
                            "bus_plate": "29B03502",
                            "passenger_count": 16
                        },
                        {
                            "bus_plate": "29B03503",
                            "passenger_count": 19
                        },
                        {
                            "bus_plate": "29B03504",
                            "passenger_count": 4
                        },
                        {
                            "bus_plate": "29B03505",
                            "passenger_count": 12
                        }
                    ]
                },
                {
                    "time": "2024:06:05 10:50:00",
                    "buses": [
                        {
                            "bus_plate": "29B03501",
                            "passenger_count": 30
                        },
                        {
                            "bus_plate": "29B03502",
                            "passenger_count": 26
                        },
                        {
                            "bus_plate": "29B03503",
                            "passenger_count": 7
                        },
                        {
                            "bus_plate": "29B03504",
                            "passenger_count": 6
                        },
                        {
                            "bus_plate": "29B03505",
                            "passenger_count": 3
                        }
                    ]
                },
                {
                    "time": "2024:06:05 10:45:00",
                    "buses": [
                        {
                            "bus_plate": "29B03501",
                            "passenger_count": 26
                        },
                        {
                            "bus_plate": "29B03502",
                            "passenger_count": 29
                        },
                        {
                            "bus_plate": "29B03503",
                            "passenger_count": 15
                        },
                        {
                            "bus_plate": "29B03504",
                            "passenger_count": 21
                        },
                        {
                            "bus_plate": "29B03505",
                            "passenger_count": 6
                        }
                    ]
                },
                {
                    "time": "2024:06:05 10:40:00",
                    "buses": [
                        {
                            "bus_plate": "29B03501",
                            "passenger_count": 9
                        },
                        {
                            "bus_plate": "29B03502",
                            "passenger_count": 26
                        },
                        {
                            "bus_plate": "29B03503",
                            "passenger_count": 5
                        },
                        {
                            "bus_plate": "29B03504",
                            "passenger_count": 8
                        },
                        {
                            "bus_plate": "29B03505",
                            "passenger_count": 3
                        }
                    ]
                },
                {
                    "time": "2024:06:05 10:35:00",
                    "buses": [
                        {
                            "bus_plate": "29B03501",
                            "passenger_count": 1
                        },
                        {
                            "bus_plate": "29B03502",
                            "passenger_count": 21
                        },
                        {
                            "bus_plate": "29B03503",
                            "passenger_count": 29
                        },
                        {
                            "bus_plate": "29B03504",
                            "passenger_count": 5
                        },
                        {
                            "bus_plate": "29B03505",
                            "passenger_count": 14
                        }
                    ]
                },
                {
                    "time": "2024:06:05 10:30:00",
                    "buses": [
                        {
                            "bus_plate": "29B03501",
                            "passenger_count": 11
                        },
                        {
                            "bus_plate": "29B03502",
                            "passenger_count": 22
                        },
                        {
                            "bus_plate": "29B03503",
                            "passenger_count": 3
                        },
                        {
                            "bus_plate": "29B03504",
                            "passenger_count": 4
                        },
                        {
                            "bus_plate": "29B03505",
                            "passenger_count": 21
                        }
                    ]
                },
                {
                    "time": "2024:06:05 10:25:00",
                    "buses": [
                        {
                            "bus_plate": "29B03501",
                            "passenger_count": 26
                        },
                        {
                            "bus_plate": "29B03502",
                            "passenger_count": 24
                        },
                        {
                            "bus_plate": "29B03503",
                            "passenger_count": 16
                        },
                        {
                            "bus_plate": "29B03504",
                            "passenger_count": 7
                        },
                        {
                            "bus_plate": "29B03505",
                            "passenger_count": 30
                        }
                    ]
                },
                {
                    "time": "2024:06:05 10:20:00",
                    "buses": [
                        {
                            "bus_plate": "29B03501",
                            "passenger_count": 17
                        },
                        {
                            "bus_plate": "29B03502",
                            "passenger_count": 19
                        },
                        {
                            "bus_plate": "29B03503",
                            "passenger_count": 18
                        },
                        {
                            "bus_plate": "29B03504",
                            "passenger_count": 30
                        },
                        {
                            "bus_plate": "29B03505",
                            "passenger_count": 8
                        }
                    ]
                },
                {
                    "time": "2024:06:05 10:15:00",
                    "buses": [
                        {
                            "bus_plate": "29B03501",
                            "passenger_count": 23
                        },
                        {
                            "bus_plate": "29B03502",
                            "passenger_count": 24
                        },
                        {
                            "bus_plate": "29B03503",
                            "passenger_count": 17
                        },
                        {
                            "bus_plate": "29B03504",
                            "passenger_count": 16
                        },
                        {
                            "bus_plate": "29B03505",
                            "passenger_count": 23
                        }
                    ]
                },
                {
                    "time": "2024:06:05 10:10:00",
                    "buses": [
                        {
                            "bus_plate": "29B03501",
                            "passenger_count": 11
                        },
                        {
                            "bus_plate": "29B03502",
                            "passenger_count": 4
                        },
                        {
                            "bus_plate": "29B03503",
                            "passenger_count": 8
                        },
                        {
                            "bus_plate": "29B03504",
                            "passenger_count": 24
                        },
                        {
                            "bus_plate": "29B03505",
                            "passenger_count": 8
                        }
                    ]
                },
                {
                    "time": "2024:06:05 10:05:00",
                    "buses": [
                        {
                            "bus_plate": "29B03501",
                            "passenger_count": 11
                        },
                        {
                            "bus_plate": "29B03502",
                            "passenger_count": 19
                        },
                        {
                            "bus_plate": "29B03503",
                            "passenger_count": 22
                        },
                        {
                            "bus_plate": "29B03504",
                            "passenger_count": 23
                        },
                        {
                            "bus_plate": "29B03505",
                            "passenger_count": 17
                        }
                    ]
                },
                {
                    "time": "2024:06:05 10:00:00",
                    "buses": [
                        {
                            "bus_plate": "29B03501",
                            "passenger_count": 10
                        },
                        {
                            "bus_plate": "29B03502",
                            "passenger_count": 21
                        },
                        {
                            "bus_plate": "29B03503",
                            "passenger_count": 25
                        },
                        {
                            "bus_plate": "29B03504",
                            "passenger_count": 23
                        },
                        {
                            "bus_plate": "29B03505",
                            "passenger_count": 23
                        }
                    ]
                },
                {
                    "time": "2024:06:05 09:55:00",
                    "buses": [
                        {
                            "bus_plate": "29B03501",
                            "passenger_count": 24
                        },
                        {
                            "bus_plate": "29B03502",
                            "passenger_count": 8
                        },
                        {
                            "bus_plate": "29B03503",
                            "passenger_count": 5
                        },
                        {
                            "bus_plate": "29B03504",
                            "passenger_count": 2
                        },
                        {
                            "bus_plate": "29B03505",
                            "passenger_count": 29
                        }
                    ]
                },
                {
                    "time": "2024:06:05 09:50:00",
                    "buses": [
                        {
                            "bus_plate": "29B03501",
                            "passenger_count": 15
                        },
                        {
                            "bus_plate": "29B03502",
                            "passenger_count": 17
                        },
                        {
                            "bus_plate": "29B03503",
                            "passenger_count": 4
                        },
                        {
                            "bus_plate": "29B03504",
                            "passenger_count": 24
                        },
                        {
                            "bus_plate": "29B03505",
                            "passenger_count": 25
                        }
                    ]
                },
                {
                    "time": "2024:06:05 09:45:00",
                    "buses": [
                        {
                            "bus_plate": "29B03501",
                            "passenger_count": 3
                        },
                        {
                            "bus_plate": "29B03502",
                            "passenger_count": 13
                        },
                        {
                            "bus_plate": "29B03503",
                            "passenger_count": 28
                        },
                        {
                            "bus_plate": "29B03504",
                            "passenger_count": 30
                        },
                        {
                            "bus_plate": "29B03505",
                            "passenger_count": 1
                        }
                    ]
                },
                {
                    "time": "2024:06:05 09:40:00",
                    "buses": [
                        {
                            "bus_plate": "29B03501",
                            "passenger_count": 23
                        },
                        {
                            "bus_plate": "29B03502",
                            "passenger_count": 12
                        },
                        {
                            "bus_plate": "29B03503",
                            "passenger_count": 24
                        },
                        {
                            "bus_plate": "29B03504",
                            "passenger_count": 6
                        },
                        {
                            "bus_plate": "29B03505",
                            "passenger_count": 14
                        }
                    ]
                },
                {
                    "time": "2024:06:05 09:35:00",
                    "buses": [
                        {
                            "bus_plate": "29B03501",
                            "passenger_count": 7
                        },
                        {
                            "bus_plate": "29B03502",
                            "passenger_count": 27
                        },
                        {
                            "bus_plate": "29B03503",
                            "passenger_count": 5
                        },
                        {
                            "bus_plate": "29B03504",
                            "passenger_count": 17
                        },
                        {
                            "bus_plate": "29B03505",
                            "passenger_count": 15
                        }
                    ]
                },
                {
                    "time": "2024:06:05 09:30:00",
                    "buses": [
                        {
                            "bus_plate": "29B03501",
                            "passenger_count": 3
                        },
                        {
                            "bus_plate": "29B03502",
                            "passenger_count": 29
                        },
                        {
                            "bus_plate": "29B03503",
                            "passenger_count": 26
                        },
                        {
                            "bus_plate": "29B03504",
                            "passenger_count": 6
                        },
                        {
                            "bus_plate": "29B03505",
                            "passenger_count": 13
                        }
                    ]
                },
                {
                    "time": "2024:06:05 09:25:00",
                    "buses": [
                        {
                            "bus_plate": "29B03501",
                            "passenger_count": 1
                        },
                        {
                            "bus_plate": "29B03502",
                            "passenger_count": 12
                        },
                        {
                            "bus_plate": "29B03503",
                            "passenger_count": 28
                        },
                        {
                            "bus_plate": "29B03504",
                            "passenger_count": 16
                        },
                        {
                            "bus_plate": "29B03505",
                            "passenger_count": 23
                        }
                    ]
                },
                {
                    "time": "2024:06:05 09:20:00",
                    "buses": [
                        {
                            "bus_plate": "29B03501",
                            "passenger_count": 24
                        },
                        {
                            "bus_plate": "29B03502",
                            "passenger_count": 9
                        },
                        {
                            "bus_plate": "29B03503",
                            "passenger_count": 30
                        },
                        {
                            "bus_plate": "29B03504",
                            "passenger_count": 20
                        },
                        {
                            "bus_plate": "29B03505",
                            "passenger_count": 28
                        }
                    ]
                },
                {
                    "time": "2024:06:05 09:15:00",
                    "buses": [
                        {
                            "bus_plate": "29B03501",
                            "passenger_count": 27
                        },
                        {
                            "bus_plate": "29B03502",
                            "passenger_count": 4
                        },
                        {
                            "bus_plate": "29B03503",
                            "passenger_count": 14
                        },
                        {
                            "bus_plate": "29B03504",
                            "passenger_count": 8
                        },
                        {
                            "bus_plate": "29B03505",
                            "passenger_count": 24
                        }
                    ]
                },
                {
                    "time": "2024:06:05 09:10:00",
                    "buses": [
                        {
                            "bus_plate": "29B03501",
                            "passenger_count": 22
                        },
                        {
                            "bus_plate": "29B03502",
                            "passenger_count": 9
                        },
                        {
                            "bus_plate": "29B03503",
                            "passenger_count": 19
                        },
                        {
                            "bus_plate": "29B03504",
                            "passenger_count": 15
                        },
                        {
                            "bus_plate": "29B03505",
                            "passenger_count": 11
                        }
                    ]
                },
                {
                    "time": "2024:06:05 09:05:00",
                    "buses": [
                        {
                            "bus_plate": "29B03501",
                            "passenger_count": 7
                        },
                        {
                            "bus_plate": "29B03502",
                            "passenger_count": 15
                        },
                        {
                            "bus_plate": "29B03503",
                            "passenger_count": 10
                        },
                        {
                            "bus_plate": "29B03504",
                            "passenger_count": 21
                        },
                        {
                            "bus_plate": "29B03505",
                            "passenger_count": 17
                        }
                    ]
                }
            ]
        },
        {
            "route": "36",
            "total_passenger": 2783,
            "graph_data": [
                {
                    "time": "2024:06:05 12:00:00",
                    "buses": [
                        {
                            "bus_plate": "29B03601",
                            "passenger_count": 5
                        },
                        {
                            "bus_plate": "29B03602",
                            "passenger_count": 12
                        },
                        {
                            "bus_plate": "29B03603",
                            "passenger_count": 29
                        },
                        {
                            "bus_plate": "29B03604",
                            "passenger_count": 19
                        },
                        {
                            "bus_plate": "29B03605",
                            "passenger_count": 1
                        }
                    ]
                },
                {
                    "time": "2024:06:05 11:55:00",
                    "buses": [
                        {
                            "bus_plate": "29B03601",
                            "passenger_count": 7
                        },
                        {
                            "bus_plate": "29B03602",
                            "passenger_count": 30
                        },
                        {
                            "bus_plate": "29B03603",
                            "passenger_count": 29
                        },
                        {
                            "bus_plate": "29B03604",
                            "passenger_count": 22
                        },
                        {
                            "bus_plate": "29B03605",
                            "passenger_count": 20
                        }
                    ]
                },
                {
                    "time": "2024:06:05 11:50:00",
                    "buses": [
                        {
                            "bus_plate": "29B03601",
                            "passenger_count": 10
                        },
                        {
                            "bus_plate": "29B03602",
                            "passenger_count": 12
                        },
                        {
                            "bus_plate": "29B03603",
                            "passenger_count": 10
                        },
                        {
                            "bus_plate": "29B03604",
                            "passenger_count": 6
                        },
                        {
                            "bus_plate": "29B03605",
                            "passenger_count": 18
                        }
                    ]
                },
                {
                    "time": "2024:06:05 11:45:00",
                    "buses": [
                        {
                            "bus_plate": "29B03601",
                            "passenger_count": 21
                        },
                        {
                            "bus_plate": "29B03602",
                            "passenger_count": 16
                        },
                        {
                            "bus_plate": "29B03603",
                            "passenger_count": 2
                        },
                        {
                            "bus_plate": "29B03604",
                            "passenger_count": 12
                        },
                        {
                            "bus_plate": "29B03605",
                            "passenger_count": 4
                        }
                    ]
                },
                {
                    "time": "2024:06:05 11:40:00",
                    "buses": [
                        {
                            "bus_plate": "29B03601",
                            "passenger_count": 27
                        },
                        {
                            "bus_plate": "29B03602",
                            "passenger_count": 24
                        },
                        {
                            "bus_plate": "29B03603",
                            "passenger_count": 25
                        },
                        {
                            "bus_plate": "29B03604",
                            "passenger_count": 27
                        },
                        {
                            "bus_plate": "29B03605",
                            "passenger_count": 1
                        }
                    ]
                },
                {
                    "time": "2024:06:05 11:35:00",
                    "buses": [
                        {
                            "bus_plate": "29B03601",
                            "passenger_count": 7
                        },
                        {
                            "bus_plate": "29B03602",
                            "passenger_count": 2
                        },
                        {
                            "bus_plate": "29B03603",
                            "passenger_count": 28
                        },
                        {
                            "bus_plate": "29B03604",
                            "passenger_count": 20
                        },
                        {
                            "bus_plate": "29B03605",
                            "passenger_count": 15
                        }
                    ]
                },
                {
                    "time": "2024:06:05 11:30:00",
                    "buses": [
                        {
                            "bus_plate": "29B03601",
                            "passenger_count": 22
                        },
                        {
                            "bus_plate": "29B03602",
                            "passenger_count": 21
                        },
                        {
                            "bus_plate": "29B03603",
                            "passenger_count": 1
                        },
                        {
                            "bus_plate": "29B03604",
                            "passenger_count": 28
                        },
                        {
                            "bus_plate": "29B03605",
                            "passenger_count": 8
                        }
                    ]
                },
                {
                    "time": "2024:06:05 11:25:00",
                    "buses": [
                        {
                            "bus_plate": "29B03601",
                            "passenger_count": 8
                        },
                        {
                            "bus_plate": "29B03602",
                            "passenger_count": 18
                        },
                        {
                            "bus_plate": "29B03603",
                            "passenger_count": 9
                        },
                        {
                            "bus_plate": "29B03604",
                            "passenger_count": 7
                        },
                        {
                            "bus_plate": "29B03605",
                            "passenger_count": 11
                        }
                    ]
                },
                {
                    "time": "2024:06:05 11:20:00",
                    "buses": [
                        {
                            "bus_plate": "29B03601",
                            "passenger_count": 22
                        },
                        {
                            "bus_plate": "29B03602",
                            "passenger_count": 13
                        },
                        {
                            "bus_plate": "29B03603",
                            "passenger_count": 4
                        },
                        {
                            "bus_plate": "29B03604",
                            "passenger_count": 17
                        },
                        {
                            "bus_plate": "29B03605",
                            "passenger_count": 1
                        }
                    ]
                },
                {
                    "time": "2024:06:05 11:15:00",
                    "buses": [
                        {
                            "bus_plate": "29B03601",
                            "passenger_count": 18
                        },
                        {
                            "bus_plate": "29B03602",
                            "passenger_count": 6
                        },
                        {
                            "bus_plate": "29B03603",
                            "passenger_count": 17
                        },
                        {
                            "bus_plate": "29B03604",
                            "passenger_count": 22
                        },
                        {
                            "bus_plate": "29B03605",
                            "passenger_count": 25
                        }
                    ]
                },
                {
                    "time": "2024:06:05 11:10:00",
                    "buses": [
                        {
                            "bus_plate": "29B03601",
                            "passenger_count": 14
                        },
                        {
                            "bus_plate": "29B03602",
                            "passenger_count": 21
                        },
                        {
                            "bus_plate": "29B03603",
                            "passenger_count": 13
                        },
                        {
                            "bus_plate": "29B03604",
                            "passenger_count": 20
                        },
                        {
                            "bus_plate": "29B03605",
                            "passenger_count": 15
                        }
                    ]
                },
                {
                    "time": "2024:06:05 11:05:00",
                    "buses": [
                        {
                            "bus_plate": "29B03601",
                            "passenger_count": 1
                        },
                        {
                            "bus_plate": "29B03602",
                            "passenger_count": 9
                        },
                        {
                            "bus_plate": "29B03603",
                            "passenger_count": 22
                        },
                        {
                            "bus_plate": "29B03604",
                            "passenger_count": 7
                        },
                        {
                            "bus_plate": "29B03605",
                            "passenger_count": 22
                        }
                    ]
                },
                {
                    "time": "2024:06:05 11:00:00",
                    "buses": [
                        {
                            "bus_plate": "29B03601",
                            "passenger_count": 20
                        },
                        {
                            "bus_plate": "29B03602",
                            "passenger_count": 15
                        },
                        {
                            "bus_plate": "29B03603",
                            "passenger_count": 7
                        },
                        {
                            "bus_plate": "29B03604",
                            "passenger_count": 21
                        },
                        {
                            "bus_plate": "29B03605",
                            "passenger_count": 5
                        }
                    ]
                },
                {
                    "time": "2024:06:05 10:55:00",
                    "buses": [
                        {
                            "bus_plate": "29B03601",
                            "passenger_count": 11
                        },
                        {
                            "bus_plate": "29B03602",
                            "passenger_count": 4
                        },
                        {
                            "bus_plate": "29B03603",
                            "passenger_count": 13
                        },
                        {
                            "bus_plate": "29B03604",
                            "passenger_count": 24
                        },
                        {
                            "bus_plate": "29B03605",
                            "passenger_count": 3
                        }
                    ]
                },
                {
                    "time": "2024:06:05 10:50:00",
                    "buses": [
                        {
                            "bus_plate": "29B03601",
                            "passenger_count": 10
                        },
                        {
                            "bus_plate": "29B03602",
                            "passenger_count": 27
                        },
                        {
                            "bus_plate": "29B03603",
                            "passenger_count": 14
                        },
                        {
                            "bus_plate": "29B03604",
                            "passenger_count": 11
                        },
                        {
                            "bus_plate": "29B03605",
                            "passenger_count": 26
                        }
                    ]
                },
                {
                    "time": "2024:06:05 10:45:00",
                    "buses": [
                        {
                            "bus_plate": "29B03601",
                            "passenger_count": 29
                        },
                        {
                            "bus_plate": "29B03602",
                            "passenger_count": 1
                        },
                        {
                            "bus_plate": "29B03603",
                            "passenger_count": 24
                        },
                        {
                            "bus_plate": "29B03604",
                            "passenger_count": 11
                        },
                        {
                            "bus_plate": "29B03605",
                            "passenger_count": 1
                        }
                    ]
                },
                {
                    "time": "2024:06:05 10:40:00",
                    "buses": [
                        {
                            "bus_plate": "29B03601",
                            "passenger_count": 14
                        },
                        {
                            "bus_plate": "29B03602",
                            "passenger_count": 9
                        },
                        {
                            "bus_plate": "29B03603",
                            "passenger_count": 18
                        },
                        {
                            "bus_plate": "29B03604",
                            "passenger_count": 28
                        },
                        {
                            "bus_plate": "29B03605",
                            "passenger_count": 3
                        }
                    ]
                },
                {
                    "time": "2024:06:05 10:35:00",
                    "buses": [
                        {
                            "bus_plate": "29B03601",
                            "passenger_count": 14
                        },
                        {
                            "bus_plate": "29B03602",
                            "passenger_count": 10
                        },
                        {
                            "bus_plate": "29B03603",
                            "passenger_count": 17
                        },
                        {
                            "bus_plate": "29B03604",
                            "passenger_count": 13
                        },
                        {
                            "bus_plate": "29B03605",
                            "passenger_count": 17
                        }
                    ]
                },
                {
                    "time": "2024:06:05 10:30:00",
                    "buses": [
                        {
                            "bus_plate": "29B03601",
                            "passenger_count": 21
                        },
                        {
                            "bus_plate": "29B03602",
                            "passenger_count": 6
                        },
                        {
                            "bus_plate": "29B03603",
                            "passenger_count": 9
                        },
                        {
                            "bus_plate": "29B03604",
                            "passenger_count": 18
                        },
                        {
                            "bus_plate": "29B03605",
                            "passenger_count": 21
                        }
                    ]
                },
                {
                    "time": "2024:06:05 10:25:00",
                    "buses": [
                        {
                            "bus_plate": "29B03601",
                            "passenger_count": 21
                        },
                        {
                            "bus_plate": "29B03602",
                            "passenger_count": 18
                        },
                        {
                            "bus_plate": "29B03603",
                            "passenger_count": 8
                        },
                        {
                            "bus_plate": "29B03604",
                            "passenger_count": 24
                        },
                        {
                            "bus_plate": "29B03605",
                            "passenger_count": 22
                        }
                    ]
                },
                {
                    "time": "2024:06:05 10:20:00",
                    "buses": [
                        {
                            "bus_plate": "29B03601",
                            "passenger_count": 20
                        },
                        {
                            "bus_plate": "29B03602",
                            "passenger_count": 27
                        },
                        {
                            "bus_plate": "29B03603",
                            "passenger_count": 20
                        },
                        {
                            "bus_plate": "29B03604",
                            "passenger_count": 21
                        },
                        {
                            "bus_plate": "29B03605",
                            "passenger_count": 6
                        }
                    ]
                },
                {
                    "time": "2024:06:05 10:15:00",
                    "buses": [
                        {
                            "bus_plate": "29B03601",
                            "passenger_count": 11
                        },
                        {
                            "bus_plate": "29B03602",
                            "passenger_count": 21
                        },
                        {
                            "bus_plate": "29B03603",
                            "passenger_count": 21
                        },
                        {
                            "bus_plate": "29B03604",
                            "passenger_count": 20
                        },
                        {
                            "bus_plate": "29B03605",
                            "passenger_count": 9
                        }
                    ]
                },
                {
                    "time": "2024:06:05 10:10:00",
                    "buses": [
                        {
                            "bus_plate": "29B03601",
                            "passenger_count": 28
                        },
                        {
                            "bus_plate": "29B03602",
                            "passenger_count": 1
                        },
                        {
                            "bus_plate": "29B03603",
                            "passenger_count": 2
                        },
                        {
                            "bus_plate": "29B03604",
                            "passenger_count": 22
                        },
                        {
                            "bus_plate": "29B03605",
                            "passenger_count": 29
                        }
                    ]
                },
                {
                    "time": "2024:06:05 10:05:00",
                    "buses": [
                        {
                            "bus_plate": "29B03601",
                            "passenger_count": 14
                        },
                        {
                            "bus_plate": "29B03602",
                            "passenger_count": 2
                        },
                        {
                            "bus_plate": "29B03603",
                            "passenger_count": 12
                        },
                        {
                            "bus_plate": "29B03604",
                            "passenger_count": 21
                        },
                        {
                            "bus_plate": "29B03605",
                            "passenger_count": 12
                        }
                    ]
                },
                {
                    "time": "2024:06:05 10:00:00",
                    "buses": [
                        {
                            "bus_plate": "29B03601",
                            "passenger_count": 21
                        },
                        {
                            "bus_plate": "29B03602",
                            "passenger_count": 13
                        },
                        {
                            "bus_plate": "29B03603",
                            "passenger_count": 25
                        },
                        {
                            "bus_plate": "29B03604",
                            "passenger_count": 25
                        },
                        {
                            "bus_plate": "29B03605",
                            "passenger_count": 27
                        }
                    ]
                },
                {
                    "time": "2024:06:05 09:55:00",
                    "buses": [
                        {
                            "bus_plate": "29B03601",
                            "passenger_count": 12
                        },
                        {
                            "bus_plate": "29B03602",
                            "passenger_count": 20
                        },
                        {
                            "bus_plate": "29B03603",
                            "passenger_count": 29
                        },
                        {
                            "bus_plate": "29B03604",
                            "passenger_count": 16
                        },
                        {
                            "bus_plate": "29B03605",
                            "passenger_count": 18
                        }
                    ]
                },
                {
                    "time": "2024:06:05 09:50:00",
                    "buses": [
                        {
                            "bus_plate": "29B03601",
                            "passenger_count": 15
                        },
                        {
                            "bus_plate": "29B03602",
                            "passenger_count": 1
                        },
                        {
                            "bus_plate": "29B03603",
                            "passenger_count": 22
                        },
                        {
                            "bus_plate": "29B03604",
                            "passenger_count": 25
                        },
                        {
                            "bus_plate": "29B03605",
                            "passenger_count": 18
                        }
                    ]
                },
                {
                    "time": "2024:06:05 09:45:00",
                    "buses": [
                        {
                            "bus_plate": "29B03601",
                            "passenger_count": 3
                        },
                        {
                            "bus_plate": "29B03602",
                            "passenger_count": 4
                        },
                        {
                            "bus_plate": "29B03603",
                            "passenger_count": 23
                        },
                        {
                            "bus_plate": "29B03604",
                            "passenger_count": 15
                        },
                        {
                            "bus_plate": "29B03605",
                            "passenger_count": 23
                        }
                    ]
                },
                {
                    "time": "2024:06:05 09:40:00",
                    "buses": [
                        {
                            "bus_plate": "29B03601",
                            "passenger_count": 6
                        },
                        {
                            "bus_plate": "29B03602",
                            "passenger_count": 12
                        },
                        {
                            "bus_plate": "29B03603",
                            "passenger_count": 30
                        },
                        {
                            "bus_plate": "29B03604",
                            "passenger_count": 14
                        },
                        {
                            "bus_plate": "29B03605",
                            "passenger_count": 26
                        }
                    ]
                },
                {
                    "time": "2024:06:05 09:35:00",
                    "buses": [
                        {
                            "bus_plate": "29B03601",
                            "passenger_count": 27
                        },
                        {
                            "bus_plate": "29B03602",
                            "passenger_count": 12
                        },
                        {
                            "bus_plate": "29B03603",
                            "passenger_count": 6
                        },
                        {
                            "bus_plate": "29B03604",
                            "passenger_count": 4
                        },
                        {
                            "bus_plate": "29B03605",
                            "passenger_count": 27
                        }
                    ]
                },
                {
                    "time": "2024:06:05 09:30:00",
                    "buses": [
                        {
                            "bus_plate": "29B03601",
                            "passenger_count": 14
                        },
                        {
                            "bus_plate": "29B03602",
                            "passenger_count": 13
                        },
                        {
                            "bus_plate": "29B03603",
                            "passenger_count": 13
                        },
                        {
                            "bus_plate": "29B03604",
                            "passenger_count": 16
                        },
                        {
                            "bus_plate": "29B03605",
                            "passenger_count": 8
                        }
                    ]
                },
                {
                    "time": "2024:06:05 09:25:00",
                    "buses": [
                        {
                            "bus_plate": "29B03601",
                            "passenger_count": 15
                        },
                        {
                            "bus_plate": "29B03602",
                            "passenger_count": 23
                        },
                        {
                            "bus_plate": "29B03603",
                            "passenger_count": 26
                        },
                        {
                            "bus_plate": "29B03604",
                            "passenger_count": 6
                        },
                        {
                            "bus_plate": "29B03605",
                            "passenger_count": 18
                        }
                    ]
                },
                {
                    "time": "2024:06:05 09:20:00",
                    "buses": [
                        {
                            "bus_plate": "29B03601",
                            "passenger_count": 4
                        },
                        {
                            "bus_plate": "29B03602",
                            "passenger_count": 14
                        },
                        {
                            "bus_plate": "29B03603",
                            "passenger_count": 13
                        },
                        {
                            "bus_plate": "29B03604",
                            "passenger_count": 27
                        },
                        {
                            "bus_plate": "29B03605",
                            "passenger_count": 28
                        }
                    ]
                },
                {
                    "time": "2024:06:05 09:15:00",
                    "buses": [
                        {
                            "bus_plate": "29B03601",
                            "passenger_count": 19
                        },
                        {
                            "bus_plate": "29B03602",
                            "passenger_count": 29
                        },
                        {
                            "bus_plate": "29B03603",
                            "passenger_count": 15
                        },
                        {
                            "bus_plate": "29B03604",
                            "passenger_count": 18
                        },
                        {
                            "bus_plate": "29B03605",
                            "passenger_count": 23
                        }
                    ]
                },
                {
                    "time": "2024:06:05 09:10:00",
                    "buses": [
                        {
                            "bus_plate": "29B03601",
                            "passenger_count": 3
                        },
                        {
                            "bus_plate": "29B03602",
                            "passenger_count": 22
                        },
                        {
                            "bus_plate": "29B03603",
                            "passenger_count": 20
                        },
                        {
                            "bus_plate": "29B03604",
                            "passenger_count": 4
                        },
                        {
                            "bus_plate": "29B03605",
                            "passenger_count": 3
                        }
                    ]
                },
                {
                    "time": "2024:06:05 09:05:00",
                    "buses": [
                        {
                            "bus_plate": "29B03601",
                            "passenger_count": 23
                        },
                        {
                            "bus_plate": "29B03602",
                            "passenger_count": 10
                        },
                        {
                            "bus_plate": "29B03603",
                            "passenger_count": 7
                        },
                        {
                            "bus_plate": "29B03604",
                            "passenger_count": 28
                        },
                        {
                            "bus_plate": "29B03605",
                            "passenger_count": 12
                        }
                    ]
                }
            ]
        },
        {
            "route": "37",
            "total_passenger": 2668,
            "graph_data": [
                {
                    "time": "2024:06:05 12:00:00",
                    "buses": [
                        {
                            "bus_plate": "29B03701",
                            "passenger_count": 22
                        },
                        {
                            "bus_plate": "29B03702",
                            "passenger_count": 27
                        },
                        {
                            "bus_plate": "29B03703",
                            "passenger_count": 21
                        },
                        {
                            "bus_plate": "29B03704",
                            "passenger_count": 16
                        },
                        {
                            "bus_plate": "29B03705",
                            "passenger_count": 10
                        }
                    ]
                },
                {
                    "time": "2024:06:05 11:55:00",
                    "buses": [
                        {
                            "bus_plate": "29B03701",
                            "passenger_count": 1
                        },
                        {
                            "bus_plate": "29B03702",
                            "passenger_count": 1
                        },
                        {
                            "bus_plate": "29B03703",
                            "passenger_count": 11
                        },
                        {
                            "bus_plate": "29B03704",
                            "passenger_count": 1
                        },
                        {
                            "bus_plate": "29B03705",
                            "passenger_count": 17
                        }
                    ]
                },
                {
                    "time": "2024:06:05 11:50:00",
                    "buses": [
                        {
                            "bus_plate": "29B03701",
                            "passenger_count": 25
                        },
                        {
                            "bus_plate": "29B03702",
                            "passenger_count": 7
                        },
                        {
                            "bus_plate": "29B03703",
                            "passenger_count": 18
                        },
                        {
                            "bus_plate": "29B03704",
                            "passenger_count": 10
                        },
                        {
                            "bus_plate": "29B03705",
                            "passenger_count": 26
                        }
                    ]
                },
                {
                    "time": "2024:06:05 11:45:00",
                    "buses": [
                        {
                            "bus_plate": "29B03701",
                            "passenger_count": 1
                        },
                        {
                            "bus_plate": "29B03702",
                            "passenger_count": 5
                        },
                        {
                            "bus_plate": "29B03703",
                            "passenger_count": 4
                        },
                        {
                            "bus_plate": "29B03704",
                            "passenger_count": 10
                        },
                        {
                            "bus_plate": "29B03705",
                            "passenger_count": 12
                        }
                    ]
                },
                {
                    "time": "2024:06:05 11:40:00",
                    "buses": [
                        {
                            "bus_plate": "29B03701",
                            "passenger_count": 12
                        },
                        {
                            "bus_plate": "29B03702",
                            "passenger_count": 15
                        },
                        {
                            "bus_plate": "29B03703",
                            "passenger_count": 21
                        },
                        {
                            "bus_plate": "29B03704",
                            "passenger_count": 30
                        },
                        {
                            "bus_plate": "29B03705",
                            "passenger_count": 22
                        }
                    ]
                },
                {
                    "time": "2024:06:05 11:35:00",
                    "buses": [
                        {
                            "bus_plate": "29B03701",
                            "passenger_count": 10
                        },
                        {
                            "bus_plate": "29B03702",
                            "passenger_count": 18
                        },
                        {
                            "bus_plate": "29B03703",
                            "passenger_count": 6
                        },
                        {
                            "bus_plate": "29B03704",
                            "passenger_count": 26
                        },
                        {
                            "bus_plate": "29B03705",
                            "passenger_count": 4
                        }
                    ]
                },
                {
                    "time": "2024:06:05 11:30:00",
                    "buses": [
                        {
                            "bus_plate": "29B03701",
                            "passenger_count": 4
                        },
                        {
                            "bus_plate": "29B03702",
                            "passenger_count": 10
                        },
                        {
                            "bus_plate": "29B03703",
                            "passenger_count": 14
                        },
                        {
                            "bus_plate": "29B03704",
                            "passenger_count": 3
                        },
                        {
                            "bus_plate": "29B03705",
                            "passenger_count": 2
                        }
                    ]
                },
                {
                    "time": "2024:06:05 11:25:00",
                    "buses": [
                        {
                            "bus_plate": "29B03701",
                            "passenger_count": 15
                        },
                        {
                            "bus_plate": "29B03702",
                            "passenger_count": 18
                        },
                        {
                            "bus_plate": "29B03703",
                            "passenger_count": 20
                        },
                        {
                            "bus_plate": "29B03704",
                            "passenger_count": 2
                        },
                        {
                            "bus_plate": "29B03705",
                            "passenger_count": 8
                        }
                    ]
                },
                {
                    "time": "2024:06:05 11:20:00",
                    "buses": [
                        {
                            "bus_plate": "29B03701",
                            "passenger_count": 20
                        },
                        {
                            "bus_plate": "29B03702",
                            "passenger_count": 24
                        },
                        {
                            "bus_plate": "29B03703",
                            "passenger_count": 24
                        },
                        {
                            "bus_plate": "29B03704",
                            "passenger_count": 18
                        },
                        {
                            "bus_plate": "29B03705",
                            "passenger_count": 5
                        }
                    ]
                },
                {
                    "time": "2024:06:05 11:15:00",
                    "buses": [
                        {
                            "bus_plate": "29B03701",
                            "passenger_count": 1
                        },
                        {
                            "bus_plate": "29B03702",
                            "passenger_count": 1
                        },
                        {
                            "bus_plate": "29B03703",
                            "passenger_count": 20
                        },
                        {
                            "bus_plate": "29B03704",
                            "passenger_count": 5
                        },
                        {
                            "bus_plate": "29B03705",
                            "passenger_count": 23
                        }
                    ]
                },
                {
                    "time": "2024:06:05 11:10:00",
                    "buses": [
                        {
                            "bus_plate": "29B03701",
                            "passenger_count": 25
                        },
                        {
                            "bus_plate": "29B03702",
                            "passenger_count": 2
                        },
                        {
                            "bus_plate": "29B03703",
                            "passenger_count": 7
                        },
                        {
                            "bus_plate": "29B03704",
                            "passenger_count": 23
                        },
                        {
                            "bus_plate": "29B03705",
                            "passenger_count": 1
                        }
                    ]
                },
                {
                    "time": "2024:06:05 11:05:00",
                    "buses": [
                        {
                            "bus_plate": "29B03701",
                            "passenger_count": 6
                        },
                        {
                            "bus_plate": "29B03702",
                            "passenger_count": 29
                        },
                        {
                            "bus_plate": "29B03703",
                            "passenger_count": 21
                        },
                        {
                            "bus_plate": "29B03704",
                            "passenger_count": 27
                        },
                        {
                            "bus_plate": "29B03705",
                            "passenger_count": 16
                        }
                    ]
                },
                {
                    "time": "2024:06:05 11:00:00",
                    "buses": [
                        {
                            "bus_plate": "29B03701",
                            "passenger_count": 21
                        },
                        {
                            "bus_plate": "29B03702",
                            "passenger_count": 3
                        },
                        {
                            "bus_plate": "29B03703",
                            "passenger_count": 9
                        },
                        {
                            "bus_plate": "29B03704",
                            "passenger_count": 27
                        },
                        {
                            "bus_plate": "29B03705",
                            "passenger_count": 22
                        }
                    ]
                },
                {
                    "time": "2024:06:05 10:55:00",
                    "buses": [
                        {
                            "bus_plate": "29B03701",
                            "passenger_count": 5
                        },
                        {
                            "bus_plate": "29B03702",
                            "passenger_count": 27
                        },
                        {
                            "bus_plate": "29B03703",
                            "passenger_count": 28
                        },
                        {
                            "bus_plate": "29B03704",
                            "passenger_count": 7
                        },
                        {
                            "bus_plate": "29B03705",
                            "passenger_count": 20
                        }
                    ]
                },
                {
                    "time": "2024:06:05 10:50:00",
                    "buses": [
                        {
                            "bus_plate": "29B03701",
                            "passenger_count": 7
                        },
                        {
                            "bus_plate": "29B03702",
                            "passenger_count": 18
                        },
                        {
                            "bus_plate": "29B03703",
                            "passenger_count": 8
                        },
                        {
                            "bus_plate": "29B03704",
                            "passenger_count": 1
                        },
                        {
                            "bus_plate": "29B03705",
                            "passenger_count": 19
                        }
                    ]
                },
                {
                    "time": "2024:06:05 10:45:00",
                    "buses": [
                        {
                            "bus_plate": "29B03701",
                            "passenger_count": 3
                        },
                        {
                            "bus_plate": "29B03702",
                            "passenger_count": 17
                        },
                        {
                            "bus_plate": "29B03703",
                            "passenger_count": 30
                        },
                        {
                            "bus_plate": "29B03704",
                            "passenger_count": 18
                        },
                        {
                            "bus_plate": "29B03705",
                            "passenger_count": 1
                        }
                    ]
                },
                {
                    "time": "2024:06:05 10:40:00",
                    "buses": [
                        {
                            "bus_plate": "29B03701",
                            "passenger_count": 20
                        },
                        {
                            "bus_plate": "29B03702",
                            "passenger_count": 12
                        },
                        {
                            "bus_plate": "29B03703",
                            "passenger_count": 6
                        },
                        {
                            "bus_plate": "29B03704",
                            "passenger_count": 20
                        },
                        {
                            "bus_plate": "29B03705",
                            "passenger_count": 15
                        }
                    ]
                },
                {
                    "time": "2024:06:05 10:35:00",
                    "buses": [
                        {
                            "bus_plate": "29B03701",
                            "passenger_count": 24
                        },
                        {
                            "bus_plate": "29B03702",
                            "passenger_count": 9
                        },
                        {
                            "bus_plate": "29B03703",
                            "passenger_count": 7
                        },
                        {
                            "bus_plate": "29B03704",
                            "passenger_count": 13
                        },
                        {
                            "bus_plate": "29B03705",
                            "passenger_count": 13
                        }
                    ]
                },
                {
                    "time": "2024:06:05 10:30:00",
                    "buses": [
                        {
                            "bus_plate": "29B03701",
                            "passenger_count": 7
                        },
                        {
                            "bus_plate": "29B03702",
                            "passenger_count": 11
                        },
                        {
                            "bus_plate": "29B03703",
                            "passenger_count": 17
                        },
                        {
                            "bus_plate": "29B03704",
                            "passenger_count": 4
                        },
                        {
                            "bus_plate": "29B03705",
                            "passenger_count": 22
                        }
                    ]
                },
                {
                    "time": "2024:06:05 10:25:00",
                    "buses": [
                        {
                            "bus_plate": "29B03701",
                            "passenger_count": 25
                        },
                        {
                            "bus_plate": "29B03702",
                            "passenger_count": 23
                        },
                        {
                            "bus_plate": "29B03703",
                            "passenger_count": 3
                        },
                        {
                            "bus_plate": "29B03704",
                            "passenger_count": 20
                        },
                        {
                            "bus_plate": "29B03705",
                            "passenger_count": 30
                        }
                    ]
                },
                {
                    "time": "2024:06:05 10:20:00",
                    "buses": [
                        {
                            "bus_plate": "29B03701",
                            "passenger_count": 13
                        },
                        {
                            "bus_plate": "29B03702",
                            "passenger_count": 9
                        },
                        {
                            "bus_plate": "29B03703",
                            "passenger_count": 28
                        },
                        {
                            "bus_plate": "29B03704",
                            "passenger_count": 7
                        },
                        {
                            "bus_plate": "29B03705",
                            "passenger_count": 17
                        }
                    ]
                },
                {
                    "time": "2024:06:05 10:15:00",
                    "buses": [
                        {
                            "bus_plate": "29B03701",
                            "passenger_count": 4
                        },
                        {
                            "bus_plate": "29B03702",
                            "passenger_count": 22
                        },
                        {
                            "bus_plate": "29B03703",
                            "passenger_count": 3
                        },
                        {
                            "bus_plate": "29B03704",
                            "passenger_count": 21
                        },
                        {
                            "bus_plate": "29B03705",
                            "passenger_count": 11
                        }
                    ]
                },
                {
                    "time": "2024:06:05 10:10:00",
                    "buses": [
                        {
                            "bus_plate": "29B03701",
                            "passenger_count": 18
                        },
                        {
                            "bus_plate": "29B03702",
                            "passenger_count": 23
                        },
                        {
                            "bus_plate": "29B03703",
                            "passenger_count": 23
                        },
                        {
                            "bus_plate": "29B03704",
                            "passenger_count": 8
                        },
                        {
                            "bus_plate": "29B03705",
                            "passenger_count": 23
                        }
                    ]
                },
                {
                    "time": "2024:06:05 10:05:00",
                    "buses": [
                        {
                            "bus_plate": "29B03701",
                            "passenger_count": 18
                        },
                        {
                            "bus_plate": "29B03702",
                            "passenger_count": 13
                        },
                        {
                            "bus_plate": "29B03703",
                            "passenger_count": 21
                        },
                        {
                            "bus_plate": "29B03704",
                            "passenger_count": 9
                        },
                        {
                            "bus_plate": "29B03705",
                            "passenger_count": 27
                        }
                    ]
                },
                {
                    "time": "2024:06:05 10:00:00",
                    "buses": [
                        {
                            "bus_plate": "29B03701",
                            "passenger_count": 23
                        },
                        {
                            "bus_plate": "29B03702",
                            "passenger_count": 10
                        },
                        {
                            "bus_plate": "29B03703",
                            "passenger_count": 30
                        },
                        {
                            "bus_plate": "29B03704",
                            "passenger_count": 7
                        },
                        {
                            "bus_plate": "29B03705",
                            "passenger_count": 7
                        }
                    ]
                },
                {
                    "time": "2024:06:05 09:55:00",
                    "buses": [
                        {
                            "bus_plate": "29B03701",
                            "passenger_count": 19
                        },
                        {
                            "bus_plate": "29B03702",
                            "passenger_count": 21
                        },
                        {
                            "bus_plate": "29B03703",
                            "passenger_count": 5
                        },
                        {
                            "bus_plate": "29B03704",
                            "passenger_count": 25
                        },
                        {
                            "bus_plate": "29B03705",
                            "passenger_count": 16
                        }
                    ]
                },
                {
                    "time": "2024:06:05 09:50:00",
                    "buses": [
                        {
                            "bus_plate": "29B03701",
                            "passenger_count": 7
                        },
                        {
                            "bus_plate": "29B03702",
                            "passenger_count": 15
                        },
                        {
                            "bus_plate": "29B03703",
                            "passenger_count": 24
                        },
                        {
                            "bus_plate": "29B03704",
                            "passenger_count": 27
                        },
                        {
                            "bus_plate": "29B03705",
                            "passenger_count": 11
                        }
                    ]
                },
                {
                    "time": "2024:06:05 09:45:00",
                    "buses": [
                        {
                            "bus_plate": "29B03701",
                            "passenger_count": 6
                        },
                        {
                            "bus_plate": "29B03702",
                            "passenger_count": 8
                        },
                        {
                            "bus_plate": "29B03703",
                            "passenger_count": 20
                        },
                        {
                            "bus_plate": "29B03704",
                            "passenger_count": 19
                        },
                        {
                            "bus_plate": "29B03705",
                            "passenger_count": 15
                        }
                    ]
                },
                {
                    "time": "2024:06:05 09:40:00",
                    "buses": [
                        {
                            "bus_plate": "29B03701",
                            "passenger_count": 24
                        },
                        {
                            "bus_plate": "29B03702",
                            "passenger_count": 8
                        },
                        {
                            "bus_plate": "29B03703",
                            "passenger_count": 6
                        },
                        {
                            "bus_plate": "29B03704",
                            "passenger_count": 3
                        },
                        {
                            "bus_plate": "29B03705",
                            "passenger_count": 11
                        }
                    ]
                },
                {
                    "time": "2024:06:05 09:35:00",
                    "buses": [
                        {
                            "bus_plate": "29B03701",
                            "passenger_count": 14
                        },
                        {
                            "bus_plate": "29B03702",
                            "passenger_count": 30
                        },
                        {
                            "bus_plate": "29B03703",
                            "passenger_count": 5
                        },
                        {
                            "bus_plate": "29B03704",
                            "passenger_count": 9
                        },
                        {
                            "bus_plate": "29B03705",
                            "passenger_count": 10
                        }
                    ]
                },
                {
                    "time": "2024:06:05 09:30:00",
                    "buses": [
                        {
                            "bus_plate": "29B03701",
                            "passenger_count": 11
                        },
                        {
                            "bus_plate": "29B03702",
                            "passenger_count": 17
                        },
                        {
                            "bus_plate": "29B03703",
                            "passenger_count": 11
                        },
                        {
                            "bus_plate": "29B03704",
                            "passenger_count": 20
                        },
                        {
                            "bus_plate": "29B03705",
                            "passenger_count": 25
                        }
                    ]
                },
                {
                    "time": "2024:06:05 09:25:00",
                    "buses": [
                        {
                            "bus_plate": "29B03701",
                            "passenger_count": 26
                        },
                        {
                            "bus_plate": "29B03702",
                            "passenger_count": 23
                        },
                        {
                            "bus_plate": "29B03703",
                            "passenger_count": 2
                        },
                        {
                            "bus_plate": "29B03704",
                            "passenger_count": 29
                        },
                        {
                            "bus_plate": "29B03705",
                            "passenger_count": 15
                        }
                    ]
                },
                {
                    "time": "2024:06:05 09:20:00",
                    "buses": [
                        {
                            "bus_plate": "29B03701",
                            "passenger_count": 23
                        },
                        {
                            "bus_plate": "29B03702",
                            "passenger_count": 22
                        },
                        {
                            "bus_plate": "29B03703",
                            "passenger_count": 29
                        },
                        {
                            "bus_plate": "29B03704",
                            "passenger_count": 23
                        },
                        {
                            "bus_plate": "29B03705",
                            "passenger_count": 14
                        }
                    ]
                },
                {
                    "time": "2024:06:05 09:15:00",
                    "buses": [
                        {
                            "bus_plate": "29B03701",
                            "passenger_count": 7
                        },
                        {
                            "bus_plate": "29B03702",
                            "passenger_count": 30
                        },
                        {
                            "bus_plate": "29B03703",
                            "passenger_count": 20
                        },
                        {
                            "bus_plate": "29B03704",
                            "passenger_count": 5
                        },
                        {
                            "bus_plate": "29B03705",
                            "passenger_count": 6
                        }
                    ]
                },
                {
                    "time": "2024:06:05 09:10:00",
                    "buses": [
                        {
                            "bus_plate": "29B03701",
                            "passenger_count": 19
                        },
                        {
                            "bus_plate": "29B03702",
                            "passenger_count": 8
                        },
                        {
                            "bus_plate": "29B03703",
                            "passenger_count": 5
                        },
                        {
                            "bus_plate": "29B03704",
                            "passenger_count": 20
                        },
                        {
                            "bus_plate": "29B03705",
                            "passenger_count": 4
                        }
                    ]
                },
                {
                    "time": "2024:06:05 09:05:00",
                    "buses": [
                        {
                            "bus_plate": "29B03701",
                            "passenger_count": 29
                        },
                        {
                            "bus_plate": "29B03702",
                            "passenger_count": 20
                        },
                        {
                            "bus_plate": "29B03703",
                            "passenger_count": 10
                        },
                        {
                            "bus_plate": "29B03704",
                            "passenger_count": 17
                        },
                        {
                            "bus_plate": "29B03705",
                            "passenger_count": 30
                        }
                    ]
                }
            ]
        },
        {
            "route": "38",
            "total_passenger": 2769,
            "graph_data": [
                {
                    "time": "2024:06:05 12:00:00",
                    "buses": [
                        {
                            "bus_plate": "29B03801",
                            "passenger_count": 7
                        },
                        {
                            "bus_plate": "29B03802",
                            "passenger_count": 23
                        },
                        {
                            "bus_plate": "29B03803",
                            "passenger_count": 20
                        },
                        {
                            "bus_plate": "29B03804",
                            "passenger_count": 24
                        },
                        {
                            "bus_plate": "29B03805",
                            "passenger_count": 23
                        }
                    ]
                },
                {
                    "time": "2024:06:05 11:55:00",
                    "buses": [
                        {
                            "bus_plate": "29B03801",
                            "passenger_count": 2
                        },
                        {
                            "bus_plate": "29B03802",
                            "passenger_count": 9
                        },
                        {
                            "bus_plate": "29B03803",
                            "passenger_count": 1
                        },
                        {
                            "bus_plate": "29B03804",
                            "passenger_count": 19
                        },
                        {
                            "bus_plate": "29B03805",
                            "passenger_count": 20
                        }
                    ]
                },
                {
                    "time": "2024:06:05 11:50:00",
                    "buses": [
                        {
                            "bus_plate": "29B03801",
                            "passenger_count": 7
                        },
                        {
                            "bus_plate": "29B03802",
                            "passenger_count": 4
                        },
                        {
                            "bus_plate": "29B03803",
                            "passenger_count": 7
                        },
                        {
                            "bus_plate": "29B03804",
                            "passenger_count": 28
                        },
                        {
                            "bus_plate": "29B03805",
                            "passenger_count": 2
                        }
                    ]
                },
                {
                    "time": "2024:06:05 11:45:00",
                    "buses": [
                        {
                            "bus_plate": "29B03801",
                            "passenger_count": 22
                        },
                        {
                            "bus_plate": "29B03802",
                            "passenger_count": 4
                        },
                        {
                            "bus_plate": "29B03803",
                            "passenger_count": 4
                        },
                        {
                            "bus_plate": "29B03804",
                            "passenger_count": 15
                        },
                        {
                            "bus_plate": "29B03805",
                            "passenger_count": 12
                        }
                    ]
                },
                {
                    "time": "2024:06:05 11:40:00",
                    "buses": [
                        {
                            "bus_plate": "29B03801",
                            "passenger_count": 18
                        },
                        {
                            "bus_plate": "29B03802",
                            "passenger_count": 4
                        },
                        {
                            "bus_plate": "29B03803",
                            "passenger_count": 12
                        },
                        {
                            "bus_plate": "29B03804",
                            "passenger_count": 4
                        },
                        {
                            "bus_plate": "29B03805",
                            "passenger_count": 29
                        }
                    ]
                },
                {
                    "time": "2024:06:05 11:35:00",
                    "buses": [
                        {
                            "bus_plate": "29B03801",
                            "passenger_count": 17
                        },
                        {
                            "bus_plate": "29B03802",
                            "passenger_count": 8
                        },
                        {
                            "bus_plate": "29B03803",
                            "passenger_count": 2
                        },
                        {
                            "bus_plate": "29B03804",
                            "passenger_count": 29
                        },
                        {
                            "bus_plate": "29B03805",
                            "passenger_count": 13
                        }
                    ]
                },
                {
                    "time": "2024:06:05 11:30:00",
                    "buses": [
                        {
                            "bus_plate": "29B03801",
                            "passenger_count": 8
                        },
                        {
                            "bus_plate": "29B03802",
                            "passenger_count": 10
                        },
                        {
                            "bus_plate": "29B03803",
                            "passenger_count": 16
                        },
                        {
                            "bus_plate": "29B03804",
                            "passenger_count": 29
                        },
                        {
                            "bus_plate": "29B03805",
                            "passenger_count": 26
                        }
                    ]
                },
                {
                    "time": "2024:06:05 11:25:00",
                    "buses": [
                        {
                            "bus_plate": "29B03801",
                            "passenger_count": 21
                        },
                        {
                            "bus_plate": "29B03802",
                            "passenger_count": 8
                        },
                        {
                            "bus_plate": "29B03803",
                            "passenger_count": 22
                        },
                        {
                            "bus_plate": "29B03804",
                            "passenger_count": 30
                        },
                        {
                            "bus_plate": "29B03805",
                            "passenger_count": 8
                        }
                    ]
                },
                {
                    "time": "2024:06:05 11:20:00",
                    "buses": [
                        {
                            "bus_plate": "29B03801",
                            "passenger_count": 30
                        },
                        {
                            "bus_plate": "29B03802",
                            "passenger_count": 5
                        },
                        {
                            "bus_plate": "29B03803",
                            "passenger_count": 8
                        },
                        {
                            "bus_plate": "29B03804",
                            "passenger_count": 3
                        },
                        {
                            "bus_plate": "29B03805",
                            "passenger_count": 16
                        }
                    ]
                },
                {
                    "time": "2024:06:05 11:15:00",
                    "buses": [
                        {
                            "bus_plate": "29B03801",
                            "passenger_count": 19
                        },
                        {
                            "bus_plate": "29B03802",
                            "passenger_count": 30
                        },
                        {
                            "bus_plate": "29B03803",
                            "passenger_count": 24
                        },
                        {
                            "bus_plate": "29B03804",
                            "passenger_count": 10
                        },
                        {
                            "bus_plate": "29B03805",
                            "passenger_count": 19
                        }
                    ]
                },
                {
                    "time": "2024:06:05 11:10:00",
                    "buses": [
                        {
                            "bus_plate": "29B03801",
                            "passenger_count": 2
                        },
                        {
                            "bus_plate": "29B03802",
                            "passenger_count": 21
                        },
                        {
                            "bus_plate": "29B03803",
                            "passenger_count": 7
                        },
                        {
                            "bus_plate": "29B03804",
                            "passenger_count": 12
                        },
                        {
                            "bus_plate": "29B03805",
                            "passenger_count": 6
                        }
                    ]
                },
                {
                    "time": "2024:06:05 11:05:00",
                    "buses": [
                        {
                            "bus_plate": "29B03801",
                            "passenger_count": 26
                        },
                        {
                            "bus_plate": "29B03802",
                            "passenger_count": 10
                        },
                        {
                            "bus_plate": "29B03803",
                            "passenger_count": 12
                        },
                        {
                            "bus_plate": "29B03804",
                            "passenger_count": 1
                        },
                        {
                            "bus_plate": "29B03805",
                            "passenger_count": 26
                        }
                    ]
                },
                {
                    "time": "2024:06:05 11:00:00",
                    "buses": [
                        {
                            "bus_plate": "29B03801",
                            "passenger_count": 6
                        },
                        {
                            "bus_plate": "29B03802",
                            "passenger_count": 28
                        },
                        {
                            "bus_plate": "29B03803",
                            "passenger_count": 23
                        },
                        {
                            "bus_plate": "29B03804",
                            "passenger_count": 22
                        },
                        {
                            "bus_plate": "29B03805",
                            "passenger_count": 15
                        }
                    ]
                },
                {
                    "time": "2024:06:05 10:55:00",
                    "buses": [
                        {
                            "bus_plate": "29B03801",
                            "passenger_count": 16
                        },
                        {
                            "bus_plate": "29B03802",
                            "passenger_count": 1
                        },
                        {
                            "bus_plate": "29B03803",
                            "passenger_count": 28
                        },
                        {
                            "bus_plate": "29B03804",
                            "passenger_count": 4
                        },
                        {
                            "bus_plate": "29B03805",
                            "passenger_count": 2
                        }
                    ]
                },
                {
                    "time": "2024:06:05 10:50:00",
                    "buses": [
                        {
                            "bus_plate": "29B03801",
                            "passenger_count": 10
                        },
                        {
                            "bus_plate": "29B03802",
                            "passenger_count": 10
                        },
                        {
                            "bus_plate": "29B03803",
                            "passenger_count": 8
                        },
                        {
                            "bus_plate": "29B03804",
                            "passenger_count": 26
                        },
                        {
                            "bus_plate": "29B03805",
                            "passenger_count": 19
                        }
                    ]
                },
                {
                    "time": "2024:06:05 10:45:00",
                    "buses": [
                        {
                            "bus_plate": "29B03801",
                            "passenger_count": 13
                        },
                        {
                            "bus_plate": "29B03802",
                            "passenger_count": 16
                        },
                        {
                            "bus_plate": "29B03803",
                            "passenger_count": 19
                        },
                        {
                            "bus_plate": "29B03804",
                            "passenger_count": 10
                        },
                        {
                            "bus_plate": "29B03805",
                            "passenger_count": 8
                        }
                    ]
                },
                {
                    "time": "2024:06:05 10:40:00",
                    "buses": [
                        {
                            "bus_plate": "29B03801",
                            "passenger_count": 20
                        },
                        {
                            "bus_plate": "29B03802",
                            "passenger_count": 13
                        },
                        {
                            "bus_plate": "29B03803",
                            "passenger_count": 18
                        },
                        {
                            "bus_plate": "29B03804",
                            "passenger_count": 20
                        },
                        {
                            "bus_plate": "29B03805",
                            "passenger_count": 23
                        }
                    ]
                },
                {
                    "time": "2024:06:05 10:35:00",
                    "buses": [
                        {
                            "bus_plate": "29B03801",
                            "passenger_count": 11
                        },
                        {
                            "bus_plate": "29B03802",
                            "passenger_count": 3
                        },
                        {
                            "bus_plate": "29B03803",
                            "passenger_count": 23
                        },
                        {
                            "bus_plate": "29B03804",
                            "passenger_count": 17
                        },
                        {
                            "bus_plate": "29B03805",
                            "passenger_count": 11
                        }
                    ]
                },
                {
                    "time": "2024:06:05 10:30:00",
                    "buses": [
                        {
                            "bus_plate": "29B03801",
                            "passenger_count": 23
                        },
                        {
                            "bus_plate": "29B03802",
                            "passenger_count": 6
                        },
                        {
                            "bus_plate": "29B03803",
                            "passenger_count": 2
                        },
                        {
                            "bus_plate": "29B03804",
                            "passenger_count": 12
                        },
                        {
                            "bus_plate": "29B03805",
                            "passenger_count": 28
                        }
                    ]
                },
                {
                    "time": "2024:06:05 10:25:00",
                    "buses": [
                        {
                            "bus_plate": "29B03801",
                            "passenger_count": 12
                        },
                        {
                            "bus_plate": "29B03802",
                            "passenger_count": 18
                        },
                        {
                            "bus_plate": "29B03803",
                            "passenger_count": 28
                        },
                        {
                            "bus_plate": "29B03804",
                            "passenger_count": 12
                        },
                        {
                            "bus_plate": "29B03805",
                            "passenger_count": 5
                        }
                    ]
                },
                {
                    "time": "2024:06:05 10:20:00",
                    "buses": [
                        {
                            "bus_plate": "29B03801",
                            "passenger_count": 2
                        },
                        {
                            "bus_plate": "29B03802",
                            "passenger_count": 12
                        },
                        {
                            "bus_plate": "29B03803",
                            "passenger_count": 19
                        },
                        {
                            "bus_plate": "29B03804",
                            "passenger_count": 7
                        },
                        {
                            "bus_plate": "29B03805",
                            "passenger_count": 20
                        }
                    ]
                },
                {
                    "time": "2024:06:05 10:15:00",
                    "buses": [
                        {
                            "bus_plate": "29B03801",
                            "passenger_count": 13
                        },
                        {
                            "bus_plate": "29B03802",
                            "passenger_count": 15
                        },
                        {
                            "bus_plate": "29B03803",
                            "passenger_count": 9
                        },
                        {
                            "bus_plate": "29B03804",
                            "passenger_count": 11
                        },
                        {
                            "bus_plate": "29B03805",
                            "passenger_count": 17
                        }
                    ]
                },
                {
                    "time": "2024:06:05 10:10:00",
                    "buses": [
                        {
                            "bus_plate": "29B03801",
                            "passenger_count": 11
                        },
                        {
                            "bus_plate": "29B03802",
                            "passenger_count": 25
                        },
                        {
                            "bus_plate": "29B03803",
                            "passenger_count": 29
                        },
                        {
                            "bus_plate": "29B03804",
                            "passenger_count": 4
                        },
                        {
                            "bus_plate": "29B03805",
                            "passenger_count": 28
                        }
                    ]
                },
                {
                    "time": "2024:06:05 10:05:00",
                    "buses": [
                        {
                            "bus_plate": "29B03801",
                            "passenger_count": 22
                        },
                        {
                            "bus_plate": "29B03802",
                            "passenger_count": 9
                        },
                        {
                            "bus_plate": "29B03803",
                            "passenger_count": 21
                        },
                        {
                            "bus_plate": "29B03804",
                            "passenger_count": 8
                        },
                        {
                            "bus_plate": "29B03805",
                            "passenger_count": 27
                        }
                    ]
                },
                {
                    "time": "2024:06:05 10:00:00",
                    "buses": [
                        {
                            "bus_plate": "29B03801",
                            "passenger_count": 18
                        },
                        {
                            "bus_plate": "29B03802",
                            "passenger_count": 25
                        },
                        {
                            "bus_plate": "29B03803",
                            "passenger_count": 30
                        },
                        {
                            "bus_plate": "29B03804",
                            "passenger_count": 16
                        },
                        {
                            "bus_plate": "29B03805",
                            "passenger_count": 13
                        }
                    ]
                },
                {
                    "time": "2024:06:05 09:55:00",
                    "buses": [
                        {
                            "bus_plate": "29B03801",
                            "passenger_count": 2
                        },
                        {
                            "bus_plate": "29B03802",
                            "passenger_count": 10
                        },
                        {
                            "bus_plate": "29B03803",
                            "passenger_count": 18
                        },
                        {
                            "bus_plate": "29B03804",
                            "passenger_count": 27
                        },
                        {
                            "bus_plate": "29B03805",
                            "passenger_count": 2
                        }
                    ]
                },
                {
                    "time": "2024:06:05 09:50:00",
                    "buses": [
                        {
                            "bus_plate": "29B03801",
                            "passenger_count": 18
                        },
                        {
                            "bus_plate": "29B03802",
                            "passenger_count": 1
                        },
                        {
                            "bus_plate": "29B03803",
                            "passenger_count": 15
                        },
                        {
                            "bus_plate": "29B03804",
                            "passenger_count": 30
                        },
                        {
                            "bus_plate": "29B03805",
                            "passenger_count": 2
                        }
                    ]
                },
                {
                    "time": "2024:06:05 09:45:00",
                    "buses": [
                        {
                            "bus_plate": "29B03801",
                            "passenger_count": 12
                        },
                        {
                            "bus_plate": "29B03802",
                            "passenger_count": 9
                        },
                        {
                            "bus_plate": "29B03803",
                            "passenger_count": 14
                        },
                        {
                            "bus_plate": "29B03804",
                            "passenger_count": 11
                        },
                        {
                            "bus_plate": "29B03805",
                            "passenger_count": 27
                        }
                    ]
                },
                {
                    "time": "2024:06:05 09:40:00",
                    "buses": [
                        {
                            "bus_plate": "29B03801",
                            "passenger_count": 7
                        },
                        {
                            "bus_plate": "29B03802",
                            "passenger_count": 8
                        },
                        {
                            "bus_plate": "29B03803",
                            "passenger_count": 10
                        },
                        {
                            "bus_plate": "29B03804",
                            "passenger_count": 23
                        },
                        {
                            "bus_plate": "29B03805",
                            "passenger_count": 13
                        }
                    ]
                },
                {
                    "time": "2024:06:05 09:35:00",
                    "buses": [
                        {
                            "bus_plate": "29B03801",
                            "passenger_count": 22
                        },
                        {
                            "bus_plate": "29B03802",
                            "passenger_count": 19
                        },
                        {
                            "bus_plate": "29B03803",
                            "passenger_count": 30
                        },
                        {
                            "bus_plate": "29B03804",
                            "passenger_count": 3
                        },
                        {
                            "bus_plate": "29B03805",
                            "passenger_count": 30
                        }
                    ]
                },
                {
                    "time": "2024:06:05 09:30:00",
                    "buses": [
                        {
                            "bus_plate": "29B03801",
                            "passenger_count": 13
                        },
                        {
                            "bus_plate": "29B03802",
                            "passenger_count": 29
                        },
                        {
                            "bus_plate": "29B03803",
                            "passenger_count": 1
                        },
                        {
                            "bus_plate": "29B03804",
                            "passenger_count": 27
                        },
                        {
                            "bus_plate": "29B03805",
                            "passenger_count": 6
                        }
                    ]
                },
                {
                    "time": "2024:06:05 09:25:00",
                    "buses": [
                        {
                            "bus_plate": "29B03801",
                            "passenger_count": 30
                        },
                        {
                            "bus_plate": "29B03802",
                            "passenger_count": 6
                        },
                        {
                            "bus_plate": "29B03803",
                            "passenger_count": 18
                        },
                        {
                            "bus_plate": "29B03804",
                            "passenger_count": 14
                        },
                        {
                            "bus_plate": "29B03805",
                            "passenger_count": 18
                        }
                    ]
                },
                {
                    "time": "2024:06:05 09:20:00",
                    "buses": [
                        {
                            "bus_plate": "29B03801",
                            "passenger_count": 6
                        },
                        {
                            "bus_plate": "29B03802",
                            "passenger_count": 27
                        },
                        {
                            "bus_plate": "29B03803",
                            "passenger_count": 19
                        },
                        {
                            "bus_plate": "29B03804",
                            "passenger_count": 15
                        },
                        {
                            "bus_plate": "29B03805",
                            "passenger_count": 27
                        }
                    ]
                },
                {
                    "time": "2024:06:05 09:15:00",
                    "buses": [
                        {
                            "bus_plate": "29B03801",
                            "passenger_count": 15
                        },
                        {
                            "bus_plate": "29B03802",
                            "passenger_count": 15
                        },
                        {
                            "bus_plate": "29B03803",
                            "passenger_count": 12
                        },
                        {
                            "bus_plate": "29B03804",
                            "passenger_count": 27
                        },
                        {
                            "bus_plate": "29B03805",
                            "passenger_count": 29
                        }
                    ]
                },
                {
                    "time": "2024:06:05 09:10:00",
                    "buses": [
                        {
                            "bus_plate": "29B03801",
                            "passenger_count": 23
                        },
                        {
                            "bus_plate": "29B03802",
                            "passenger_count": 30
                        },
                        {
                            "bus_plate": "29B03803",
                            "passenger_count": 14
                        },
                        {
                            "bus_plate": "29B03804",
                            "passenger_count": 19
                        },
                        {
                            "bus_plate": "29B03805",
                            "passenger_count": 28
                        }
                    ]
                },
                {
                    "time": "2024:06:05 09:05:00",
                    "buses": [
                        {
                            "bus_plate": "29B03801",
                            "passenger_count": 14
                        },
                        {
                            "bus_plate": "29B03802",
                            "passenger_count": 14
                        },
                        {
                            "bus_plate": "29B03803",
                            "passenger_count": 8
                        },
                        {
                            "bus_plate": "29B03804",
                            "passenger_count": 21
                        },
                        {
                            "bus_plate": "29B03805",
                            "passenger_count": 27
                        }
                    ]
                }
            ]
        },
        {
            "route": "39",
            "total_passenger": 2783,
            "graph_data": [
                {
                    "time": "2024:06:05 12:00:00",
                    "buses": [
                        {
                            "bus_plate": "29B03901",
                            "passenger_count": 19
                        },
                        {
                            "bus_plate": "29B03902",
                            "passenger_count": 20
                        },
                        {
                            "bus_plate": "29B03903",
                            "passenger_count": 5
                        },
                        {
                            "bus_plate": "29B03904",
                            "passenger_count": 16
                        },
                        {
                            "bus_plate": "29B03905",
                            "passenger_count": 21
                        }
                    ]
                },
                {
                    "time": "2024:06:05 11:55:00",
                    "buses": [
                        {
                            "bus_plate": "29B03901",
                            "passenger_count": 8
                        },
                        {
                            "bus_plate": "29B03902",
                            "passenger_count": 7
                        },
                        {
                            "bus_plate": "29B03903",
                            "passenger_count": 22
                        },
                        {
                            "bus_plate": "29B03904",
                            "passenger_count": 21
                        },
                        {
                            "bus_plate": "29B03905",
                            "passenger_count": 1
                        }
                    ]
                },
                {
                    "time": "2024:06:05 11:50:00",
                    "buses": [
                        {
                            "bus_plate": "29B03901",
                            "passenger_count": 25
                        },
                        {
                            "bus_plate": "29B03902",
                            "passenger_count": 26
                        },
                        {
                            "bus_plate": "29B03903",
                            "passenger_count": 17
                        },
                        {
                            "bus_plate": "29B03904",
                            "passenger_count": 6
                        },
                        {
                            "bus_plate": "29B03905",
                            "passenger_count": 12
                        }
                    ]
                },
                {
                    "time": "2024:06:05 11:45:00",
                    "buses": [
                        {
                            "bus_plate": "29B03901",
                            "passenger_count": 30
                        },
                        {
                            "bus_plate": "29B03902",
                            "passenger_count": 30
                        },
                        {
                            "bus_plate": "29B03903",
                            "passenger_count": 28
                        },
                        {
                            "bus_plate": "29B03904",
                            "passenger_count": 19
                        },
                        {
                            "bus_plate": "29B03905",
                            "passenger_count": 12
                        }
                    ]
                },
                {
                    "time": "2024:06:05 11:40:00",
                    "buses": [
                        {
                            "bus_plate": "29B03901",
                            "passenger_count": 6
                        },
                        {
                            "bus_plate": "29B03902",
                            "passenger_count": 19
                        },
                        {
                            "bus_plate": "29B03903",
                            "passenger_count": 20
                        },
                        {
                            "bus_plate": "29B03904",
                            "passenger_count": 27
                        },
                        {
                            "bus_plate": "29B03905",
                            "passenger_count": 20
                        }
                    ]
                },
                {
                    "time": "2024:06:05 11:35:00",
                    "buses": [
                        {
                            "bus_plate": "29B03901",
                            "passenger_count": 14
                        },
                        {
                            "bus_plate": "29B03902",
                            "passenger_count": 5
                        },
                        {
                            "bus_plate": "29B03903",
                            "passenger_count": 2
                        },
                        {
                            "bus_plate": "29B03904",
                            "passenger_count": 19
                        },
                        {
                            "bus_plate": "29B03905",
                            "passenger_count": 22
                        }
                    ]
                },
                {
                    "time": "2024:06:05 11:30:00",
                    "buses": [
                        {
                            "bus_plate": "29B03901",
                            "passenger_count": 4
                        },
                        {
                            "bus_plate": "29B03902",
                            "passenger_count": 6
                        },
                        {
                            "bus_plate": "29B03903",
                            "passenger_count": 16
                        },
                        {
                            "bus_plate": "29B03904",
                            "passenger_count": 7
                        },
                        {
                            "bus_plate": "29B03905",
                            "passenger_count": 20
                        }
                    ]
                },
                {
                    "time": "2024:06:05 11:25:00",
                    "buses": [
                        {
                            "bus_plate": "29B03901",
                            "passenger_count": 25
                        },
                        {
                            "bus_plate": "29B03902",
                            "passenger_count": 12
                        },
                        {
                            "bus_plate": "29B03903",
                            "passenger_count": 24
                        },
                        {
                            "bus_plate": "29B03904",
                            "passenger_count": 5
                        },
                        {
                            "bus_plate": "29B03905",
                            "passenger_count": 29
                        }
                    ]
                },
                {
                    "time": "2024:06:05 11:20:00",
                    "buses": [
                        {
                            "bus_plate": "29B03901",
                            "passenger_count": 19
                        },
                        {
                            "bus_plate": "29B03902",
                            "passenger_count": 7
                        },
                        {
                            "bus_plate": "29B03903",
                            "passenger_count": 5
                        },
                        {
                            "bus_plate": "29B03904",
                            "passenger_count": 6
                        },
                        {
                            "bus_plate": "29B03905",
                            "passenger_count": 27
                        }
                    ]
                },
                {
                    "time": "2024:06:05 11:15:00",
                    "buses": [
                        {
                            "bus_plate": "29B03901",
                            "passenger_count": 1
                        },
                        {
                            "bus_plate": "29B03902",
                            "passenger_count": 7
                        },
                        {
                            "bus_plate": "29B03903",
                            "passenger_count": 13
                        },
                        {
                            "bus_plate": "29B03904",
                            "passenger_count": 13
                        },
                        {
                            "bus_plate": "29B03905",
                            "passenger_count": 25
                        }
                    ]
                },
                {
                    "time": "2024:06:05 11:10:00",
                    "buses": [
                        {
                            "bus_plate": "29B03901",
                            "passenger_count": 26
                        },
                        {
                            "bus_plate": "29B03902",
                            "passenger_count": 17
                        },
                        {
                            "bus_plate": "29B03903",
                            "passenger_count": 23
                        },
                        {
                            "bus_plate": "29B03904",
                            "passenger_count": 30
                        },
                        {
                            "bus_plate": "29B03905",
                            "passenger_count": 27
                        }
                    ]
                },
                {
                    "time": "2024:06:05 11:05:00",
                    "buses": [
                        {
                            "bus_plate": "29B03901",
                            "passenger_count": 10
                        },
                        {
                            "bus_plate": "29B03902",
                            "passenger_count": 4
                        },
                        {
                            "bus_plate": "29B03903",
                            "passenger_count": 26
                        },
                        {
                            "bus_plate": "29B03904",
                            "passenger_count": 23
                        },
                        {
                            "bus_plate": "29B03905",
                            "passenger_count": 10
                        }
                    ]
                },
                {
                    "time": "2024:06:05 11:00:00",
                    "buses": [
                        {
                            "bus_plate": "29B03901",
                            "passenger_count": 24
                        },
                        {
                            "bus_plate": "29B03902",
                            "passenger_count": 19
                        },
                        {
                            "bus_plate": "29B03903",
                            "passenger_count": 2
                        },
                        {
                            "bus_plate": "29B03904",
                            "passenger_count": 7
                        },
                        {
                            "bus_plate": "29B03905",
                            "passenger_count": 7
                        }
                    ]
                },
                {
                    "time": "2024:06:05 10:55:00",
                    "buses": [
                        {
                            "bus_plate": "29B03901",
                            "passenger_count": 14
                        },
                        {
                            "bus_plate": "29B03902",
                            "passenger_count": 13
                        },
                        {
                            "bus_plate": "29B03903",
                            "passenger_count": 20
                        },
                        {
                            "bus_plate": "29B03904",
                            "passenger_count": 22
                        },
                        {
                            "bus_plate": "29B03905",
                            "passenger_count": 4
                        }
                    ]
                },
                {
                    "time": "2024:06:05 10:50:00",
                    "buses": [
                        {
                            "bus_plate": "29B03901",
                            "passenger_count": 15
                        },
                        {
                            "bus_plate": "29B03902",
                            "passenger_count": 29
                        },
                        {
                            "bus_plate": "29B03903",
                            "passenger_count": 13
                        },
                        {
                            "bus_plate": "29B03904",
                            "passenger_count": 2
                        },
                        {
                            "bus_plate": "29B03905",
                            "passenger_count": 12
                        }
                    ]
                },
                {
                    "time": "2024:06:05 10:45:00",
                    "buses": [
                        {
                            "bus_plate": "29B03901",
                            "passenger_count": 5
                        },
                        {
                            "bus_plate": "29B03902",
                            "passenger_count": 19
                        },
                        {
                            "bus_plate": "29B03903",
                            "passenger_count": 7
                        },
                        {
                            "bus_plate": "29B03904",
                            "passenger_count": 29
                        },
                        {
                            "bus_plate": "29B03905",
                            "passenger_count": 27
                        }
                    ]
                },
                {
                    "time": "2024:06:05 10:40:00",
                    "buses": [
                        {
                            "bus_plate": "29B03901",
                            "passenger_count": 9
                        },
                        {
                            "bus_plate": "29B03902",
                            "passenger_count": 6
                        },
                        {
                            "bus_plate": "29B03903",
                            "passenger_count": 28
                        },
                        {
                            "bus_plate": "29B03904",
                            "passenger_count": 7
                        },
                        {
                            "bus_plate": "29B03905",
                            "passenger_count": 13
                        }
                    ]
                },
                {
                    "time": "2024:06:05 10:35:00",
                    "buses": [
                        {
                            "bus_plate": "29B03901",
                            "passenger_count": 2
                        },
                        {
                            "bus_plate": "29B03902",
                            "passenger_count": 29
                        },
                        {
                            "bus_plate": "29B03903",
                            "passenger_count": 19
                        },
                        {
                            "bus_plate": "29B03904",
                            "passenger_count": 10
                        },
                        {
                            "bus_plate": "29B03905",
                            "passenger_count": 15
                        }
                    ]
                },
                {
                    "time": "2024:06:05 10:30:00",
                    "buses": [
                        {
                            "bus_plate": "29B03901",
                            "passenger_count": 20
                        },
                        {
                            "bus_plate": "29B03902",
                            "passenger_count": 9
                        },
                        {
                            "bus_plate": "29B03903",
                            "passenger_count": 10
                        },
                        {
                            "bus_plate": "29B03904",
                            "passenger_count": 17
                        },
                        {
                            "bus_plate": "29B03905",
                            "passenger_count": 30
                        }
                    ]
                },
                {
                    "time": "2024:06:05 10:25:00",
                    "buses": [
                        {
                            "bus_plate": "29B03901",
                            "passenger_count": 10
                        },
                        {
                            "bus_plate": "29B03902",
                            "passenger_count": 8
                        },
                        {
                            "bus_plate": "29B03903",
                            "passenger_count": 9
                        },
                        {
                            "bus_plate": "29B03904",
                            "passenger_count": 19
                        },
                        {
                            "bus_plate": "29B03905",
                            "passenger_count": 5
                        }
                    ]
                },
                {
                    "time": "2024:06:05 10:20:00",
                    "buses": [
                        {
                            "bus_plate": "29B03901",
                            "passenger_count": 15
                        },
                        {
                            "bus_plate": "29B03902",
                            "passenger_count": 9
                        },
                        {
                            "bus_plate": "29B03903",
                            "passenger_count": 23
                        },
                        {
                            "bus_plate": "29B03904",
                            "passenger_count": 26
                        },
                        {
                            "bus_plate": "29B03905",
                            "passenger_count": 25
                        }
                    ]
                },
                {
                    "time": "2024:06:05 10:15:00",
                    "buses": [
                        {
                            "bus_plate": "29B03901",
                            "passenger_count": 27
                        },
                        {
                            "bus_plate": "29B03902",
                            "passenger_count": 6
                        },
                        {
                            "bus_plate": "29B03903",
                            "passenger_count": 1
                        },
                        {
                            "bus_plate": "29B03904",
                            "passenger_count": 18
                        },
                        {
                            "bus_plate": "29B03905",
                            "passenger_count": 1
                        }
                    ]
                },
                {
                    "time": "2024:06:05 10:10:00",
                    "buses": [
                        {
                            "bus_plate": "29B03901",
                            "passenger_count": 12
                        },
                        {
                            "bus_plate": "29B03902",
                            "passenger_count": 24
                        },
                        {
                            "bus_plate": "29B03903",
                            "passenger_count": 24
                        },
                        {
                            "bus_plate": "29B03904",
                            "passenger_count": 2
                        },
                        {
                            "bus_plate": "29B03905",
                            "passenger_count": 27
                        }
                    ]
                },
                {
                    "time": "2024:06:05 10:05:00",
                    "buses": [
                        {
                            "bus_plate": "29B03901",
                            "passenger_count": 8
                        },
                        {
                            "bus_plate": "29B03902",
                            "passenger_count": 7
                        },
                        {
                            "bus_plate": "29B03903",
                            "passenger_count": 2
                        },
                        {
                            "bus_plate": "29B03904",
                            "passenger_count": 4
                        },
                        {
                            "bus_plate": "29B03905",
                            "passenger_count": 30
                        }
                    ]
                },
                {
                    "time": "2024:06:05 10:00:00",
                    "buses": [
                        {
                            "bus_plate": "29B03901",
                            "passenger_count": 3
                        },
                        {
                            "bus_plate": "29B03902",
                            "passenger_count": 30
                        },
                        {
                            "bus_plate": "29B03903",
                            "passenger_count": 11
                        },
                        {
                            "bus_plate": "29B03904",
                            "passenger_count": 3
                        },
                        {
                            "bus_plate": "29B03905",
                            "passenger_count": 30
                        }
                    ]
                },
                {
                    "time": "2024:06:05 09:55:00",
                    "buses": [
                        {
                            "bus_plate": "29B03901",
                            "passenger_count": 18
                        },
                        {
                            "bus_plate": "29B03902",
                            "passenger_count": 28
                        },
                        {
                            "bus_plate": "29B03903",
                            "passenger_count": 7
                        },
                        {
                            "bus_plate": "29B03904",
                            "passenger_count": 8
                        },
                        {
                            "bus_plate": "29B03905",
                            "passenger_count": 7
                        }
                    ]
                },
                {
                    "time": "2024:06:05 09:50:00",
                    "buses": [
                        {
                            "bus_plate": "29B03901",
                            "passenger_count": 16
                        },
                        {
                            "bus_plate": "29B03902",
                            "passenger_count": 6
                        },
                        {
                            "bus_plate": "29B03903",
                            "passenger_count": 6
                        },
                        {
                            "bus_plate": "29B03904",
                            "passenger_count": 21
                        },
                        {
                            "bus_plate": "29B03905",
                            "passenger_count": 13
                        }
                    ]
                },
                {
                    "time": "2024:06:05 09:45:00",
                    "buses": [
                        {
                            "bus_plate": "29B03901",
                            "passenger_count": 12
                        },
                        {
                            "bus_plate": "29B03902",
                            "passenger_count": 29
                        },
                        {
                            "bus_plate": "29B03903",
                            "passenger_count": 10
                        },
                        {
                            "bus_plate": "29B03904",
                            "passenger_count": 16
                        },
                        {
                            "bus_plate": "29B03905",
                            "passenger_count": 13
                        }
                    ]
                },
                {
                    "time": "2024:06:05 09:40:00",
                    "buses": [
                        {
                            "bus_plate": "29B03901",
                            "passenger_count": 2
                        },
                        {
                            "bus_plate": "29B03902",
                            "passenger_count": 21
                        },
                        {
                            "bus_plate": "29B03903",
                            "passenger_count": 5
                        },
                        {
                            "bus_plate": "29B03904",
                            "passenger_count": 1
                        },
                        {
                            "bus_plate": "29B03905",
                            "passenger_count": 18
                        }
                    ]
                },
                {
                    "time": "2024:06:05 09:35:00",
                    "buses": [
                        {
                            "bus_plate": "29B03901",
                            "passenger_count": 25
                        },
                        {
                            "bus_plate": "29B03902",
                            "passenger_count": 22
                        },
                        {
                            "bus_plate": "29B03903",
                            "passenger_count": 8
                        },
                        {
                            "bus_plate": "29B03904",
                            "passenger_count": 8
                        },
                        {
                            "bus_plate": "29B03905",
                            "passenger_count": 2
                        }
                    ]
                },
                {
                    "time": "2024:06:05 09:30:00",
                    "buses": [
                        {
                            "bus_plate": "29B03901",
                            "passenger_count": 3
                        },
                        {
                            "bus_plate": "29B03902",
                            "passenger_count": 29
                        },
                        {
                            "bus_plate": "29B03903",
                            "passenger_count": 15
                        },
                        {
                            "bus_plate": "29B03904",
                            "passenger_count": 14
                        },
                        {
                            "bus_plate": "29B03905",
                            "passenger_count": 28
                        }
                    ]
                },
                {
                    "time": "2024:06:05 09:25:00",
                    "buses": [
                        {
                            "bus_plate": "29B03901",
                            "passenger_count": 8
                        },
                        {
                            "bus_plate": "29B03902",
                            "passenger_count": 30
                        },
                        {
                            "bus_plate": "29B03903",
                            "passenger_count": 18
                        },
                        {
                            "bus_plate": "29B03904",
                            "passenger_count": 13
                        },
                        {
                            "bus_plate": "29B03905",
                            "passenger_count": 23
                        }
                    ]
                },
                {
                    "time": "2024:06:05 09:20:00",
                    "buses": [
                        {
                            "bus_plate": "29B03901",
                            "passenger_count": 30
                        },
                        {
                            "bus_plate": "29B03902",
                            "passenger_count": 30
                        },
                        {
                            "bus_plate": "29B03903",
                            "passenger_count": 23
                        },
                        {
                            "bus_plate": "29B03904",
                            "passenger_count": 14
                        },
                        {
                            "bus_plate": "29B03905",
                            "passenger_count": 11
                        }
                    ]
                },
                {
                    "time": "2024:06:05 09:15:00",
                    "buses": [
                        {
                            "bus_plate": "29B03901",
                            "passenger_count": 7
                        },
                        {
                            "bus_plate": "29B03902",
                            "passenger_count": 18
                        },
                        {
                            "bus_plate": "29B03903",
                            "passenger_count": 21
                        },
                        {
                            "bus_plate": "29B03904",
                            "passenger_count": 24
                        },
                        {
                            "bus_plate": "29B03905",
                            "passenger_count": 12
                        }
                    ]
                },
                {
                    "time": "2024:06:05 09:10:00",
                    "buses": [
                        {
                            "bus_plate": "29B03901",
                            "passenger_count": 27
                        },
                        {
                            "bus_plate": "29B03902",
                            "passenger_count": 25
                        },
                        {
                            "bus_plate": "29B03903",
                            "passenger_count": 26
                        },
                        {
                            "bus_plate": "29B03904",
                            "passenger_count": 13
                        },
                        {
                            "bus_plate": "29B03905",
                            "passenger_count": 5
                        }
                    ]
                },
                {
                    "time": "2024:06:05 09:05:00",
                    "buses": [
                        {
                            "bus_plate": "29B03901",
                            "passenger_count": 27
                        },
                        {
                            "bus_plate": "29B03902",
                            "passenger_count": 20
                        },
                        {
                            "bus_plate": "29B03903",
                            "passenger_count": 28
                        },
                        {
                            "bus_plate": "29B03904",
                            "passenger_count": 1
                        },
                        {
                            "bus_plate": "29B03905",
                            "passenger_count": 19
                        }
                    ]
                }
            ]
        },
        {
            "route": "40",
            "total_passenger": 2868,
            "graph_data": [
                {
                    "time": "2024:06:05 12:00:00",
                    "buses": [
                        {
                            "bus_plate": "29B04001",
                            "passenger_count": 13
                        },
                        {
                            "bus_plate": "29B04002",
                            "passenger_count": 29
                        },
                        {
                            "bus_plate": "29B04003",
                            "passenger_count": 10
                        },
                        {
                            "bus_plate": "29B04004",
                            "passenger_count": 23
                        },
                        {
                            "bus_plate": "29B04005",
                            "passenger_count": 28
                        }
                    ]
                },
                {
                    "time": "2024:06:05 11:55:00",
                    "buses": [
                        {
                            "bus_plate": "29B04001",
                            "passenger_count": 14
                        },
                        {
                            "bus_plate": "29B04002",
                            "passenger_count": 19
                        },
                        {
                            "bus_plate": "29B04003",
                            "passenger_count": 16
                        },
                        {
                            "bus_plate": "29B04004",
                            "passenger_count": 6
                        },
                        {
                            "bus_plate": "29B04005",
                            "passenger_count": 23
                        }
                    ]
                },
                {
                    "time": "2024:06:05 11:50:00",
                    "buses": [
                        {
                            "bus_plate": "29B04001",
                            "passenger_count": 21
                        },
                        {
                            "bus_plate": "29B04002",
                            "passenger_count": 1
                        },
                        {
                            "bus_plate": "29B04003",
                            "passenger_count": 10
                        },
                        {
                            "bus_plate": "29B04004",
                            "passenger_count": 2
                        },
                        {
                            "bus_plate": "29B04005",
                            "passenger_count": 18
                        }
                    ]
                },
                {
                    "time": "2024:06:05 11:45:00",
                    "buses": [
                        {
                            "bus_plate": "29B04001",
                            "passenger_count": 17
                        },
                        {
                            "bus_plate": "29B04002",
                            "passenger_count": 19
                        },
                        {
                            "bus_plate": "29B04003",
                            "passenger_count": 1
                        },
                        {
                            "bus_plate": "29B04004",
                            "passenger_count": 22
                        },
                        {
                            "bus_plate": "29B04005",
                            "passenger_count": 8
                        }
                    ]
                },
                {
                    "time": "2024:06:05 11:40:00",
                    "buses": [
                        {
                            "bus_plate": "29B04001",
                            "passenger_count": 2
                        },
                        {
                            "bus_plate": "29B04002",
                            "passenger_count": 21
                        },
                        {
                            "bus_plate": "29B04003",
                            "passenger_count": 13
                        },
                        {
                            "bus_plate": "29B04004",
                            "passenger_count": 17
                        },
                        {
                            "bus_plate": "29B04005",
                            "passenger_count": 24
                        }
                    ]
                },
                {
                    "time": "2024:06:05 11:35:00",
                    "buses": [
                        {
                            "bus_plate": "29B04001",
                            "passenger_count": 6
                        },
                        {
                            "bus_plate": "29B04002",
                            "passenger_count": 7
                        },
                        {
                            "bus_plate": "29B04003",
                            "passenger_count": 16
                        },
                        {
                            "bus_plate": "29B04004",
                            "passenger_count": 20
                        },
                        {
                            "bus_plate": "29B04005",
                            "passenger_count": 17
                        }
                    ]
                },
                {
                    "time": "2024:06:05 11:30:00",
                    "buses": [
                        {
                            "bus_plate": "29B04001",
                            "passenger_count": 29
                        },
                        {
                            "bus_plate": "29B04002",
                            "passenger_count": 4
                        },
                        {
                            "bus_plate": "29B04003",
                            "passenger_count": 22
                        },
                        {
                            "bus_plate": "29B04004",
                            "passenger_count": 8
                        },
                        {
                            "bus_plate": "29B04005",
                            "passenger_count": 25
                        }
                    ]
                },
                {
                    "time": "2024:06:05 11:25:00",
                    "buses": [
                        {
                            "bus_plate": "29B04001",
                            "passenger_count": 23
                        },
                        {
                            "bus_plate": "29B04002",
                            "passenger_count": 11
                        },
                        {
                            "bus_plate": "29B04003",
                            "passenger_count": 20
                        },
                        {
                            "bus_plate": "29B04004",
                            "passenger_count": 15
                        },
                        {
                            "bus_plate": "29B04005",
                            "passenger_count": 3
                        }
                    ]
                },
                {
                    "time": "2024:06:05 11:20:00",
                    "buses": [
                        {
                            "bus_plate": "29B04001",
                            "passenger_count": 17
                        },
                        {
                            "bus_plate": "29B04002",
                            "passenger_count": 8
                        },
                        {
                            "bus_plate": "29B04003",
                            "passenger_count": 13
                        },
                        {
                            "bus_plate": "29B04004",
                            "passenger_count": 16
                        },
                        {
                            "bus_plate": "29B04005",
                            "passenger_count": 29
                        }
                    ]
                },
                {
                    "time": "2024:06:05 11:15:00",
                    "buses": [
                        {
                            "bus_plate": "29B04001",
                            "passenger_count": 24
                        },
                        {
                            "bus_plate": "29B04002",
                            "passenger_count": 22
                        },
                        {
                            "bus_plate": "29B04003",
                            "passenger_count": 6
                        },
                        {
                            "bus_plate": "29B04004",
                            "passenger_count": 4
                        },
                        {
                            "bus_plate": "29B04005",
                            "passenger_count": 7
                        }
                    ]
                },
                {
                    "time": "2024:06:05 11:10:00",
                    "buses": [
                        {
                            "bus_plate": "29B04001",
                            "passenger_count": 27
                        },
                        {
                            "bus_plate": "29B04002",
                            "passenger_count": 26
                        },
                        {
                            "bus_plate": "29B04003",
                            "passenger_count": 25
                        },
                        {
                            "bus_plate": "29B04004",
                            "passenger_count": 18
                        },
                        {
                            "bus_plate": "29B04005",
                            "passenger_count": 15
                        }
                    ]
                },
                {
                    "time": "2024:06:05 11:05:00",
                    "buses": [
                        {
                            "bus_plate": "29B04001",
                            "passenger_count": 18
                        },
                        {
                            "bus_plate": "29B04002",
                            "passenger_count": 24
                        },
                        {
                            "bus_plate": "29B04003",
                            "passenger_count": 25
                        },
                        {
                            "bus_plate": "29B04004",
                            "passenger_count": 5
                        },
                        {
                            "bus_plate": "29B04005",
                            "passenger_count": 29
                        }
                    ]
                },
                {
                    "time": "2024:06:05 11:00:00",
                    "buses": [
                        {
                            "bus_plate": "29B04001",
                            "passenger_count": 21
                        },
                        {
                            "bus_plate": "29B04002",
                            "passenger_count": 6
                        },
                        {
                            "bus_plate": "29B04003",
                            "passenger_count": 2
                        },
                        {
                            "bus_plate": "29B04004",
                            "passenger_count": 7
                        },
                        {
                            "bus_plate": "29B04005",
                            "passenger_count": 2
                        }
                    ]
                },
                {
                    "time": "2024:06:05 10:55:00",
                    "buses": [
                        {
                            "bus_plate": "29B04001",
                            "passenger_count": 26
                        },
                        {
                            "bus_plate": "29B04002",
                            "passenger_count": 14
                        },
                        {
                            "bus_plate": "29B04003",
                            "passenger_count": 29
                        },
                        {
                            "bus_plate": "29B04004",
                            "passenger_count": 6
                        },
                        {
                            "bus_plate": "29B04005",
                            "passenger_count": 29
                        }
                    ]
                },
                {
                    "time": "2024:06:05 10:50:00",
                    "buses": [
                        {
                            "bus_plate": "29B04001",
                            "passenger_count": 5
                        },
                        {
                            "bus_plate": "29B04002",
                            "passenger_count": 7
                        },
                        {
                            "bus_plate": "29B04003",
                            "passenger_count": 23
                        },
                        {
                            "bus_plate": "29B04004",
                            "passenger_count": 11
                        },
                        {
                            "bus_plate": "29B04005",
                            "passenger_count": 2
                        }
                    ]
                },
                {
                    "time": "2024:06:05 10:45:00",
                    "buses": [
                        {
                            "bus_plate": "29B04001",
                            "passenger_count": 3
                        },
                        {
                            "bus_plate": "29B04002",
                            "passenger_count": 25
                        },
                        {
                            "bus_plate": "29B04003",
                            "passenger_count": 11
                        },
                        {
                            "bus_plate": "29B04004",
                            "passenger_count": 30
                        },
                        {
                            "bus_plate": "29B04005",
                            "passenger_count": 22
                        }
                    ]
                },
                {
                    "time": "2024:06:05 10:40:00",
                    "buses": [
                        {
                            "bus_plate": "29B04001",
                            "passenger_count": 15
                        },
                        {
                            "bus_plate": "29B04002",
                            "passenger_count": 12
                        },
                        {
                            "bus_plate": "29B04003",
                            "passenger_count": 29
                        },
                        {
                            "bus_plate": "29B04004",
                            "passenger_count": 14
                        },
                        {
                            "bus_plate": "29B04005",
                            "passenger_count": 4
                        }
                    ]
                },
                {
                    "time": "2024:06:05 10:35:00",
                    "buses": [
                        {
                            "bus_plate": "29B04001",
                            "passenger_count": 29
                        },
                        {
                            "bus_plate": "29B04002",
                            "passenger_count": 25
                        },
                        {
                            "bus_plate": "29B04003",
                            "passenger_count": 13
                        },
                        {
                            "bus_plate": "29B04004",
                            "passenger_count": 27
                        },
                        {
                            "bus_plate": "29B04005",
                            "passenger_count": 12
                        }
                    ]
                },
                {
                    "time": "2024:06:05 10:30:00",
                    "buses": [
                        {
                            "bus_plate": "29B04001",
                            "passenger_count": 26
                        },
                        {
                            "bus_plate": "29B04002",
                            "passenger_count": 26
                        },
                        {
                            "bus_plate": "29B04003",
                            "passenger_count": 26
                        },
                        {
                            "bus_plate": "29B04004",
                            "passenger_count": 19
                        },
                        {
                            "bus_plate": "29B04005",
                            "passenger_count": 4
                        }
                    ]
                },
                {
                    "time": "2024:06:05 10:25:00",
                    "buses": [
                        {
                            "bus_plate": "29B04001",
                            "passenger_count": 27
                        },
                        {
                            "bus_plate": "29B04002",
                            "passenger_count": 20
                        },
                        {
                            "bus_plate": "29B04003",
                            "passenger_count": 22
                        },
                        {
                            "bus_plate": "29B04004",
                            "passenger_count": 21
                        },
                        {
                            "bus_plate": "29B04005",
                            "passenger_count": 12
                        }
                    ]
                },
                {
                    "time": "2024:06:05 10:20:00",
                    "buses": [
                        {
                            "bus_plate": "29B04001",
                            "passenger_count": 4
                        },
                        {
                            "bus_plate": "29B04002",
                            "passenger_count": 12
                        },
                        {
                            "bus_plate": "29B04003",
                            "passenger_count": 28
                        },
                        {
                            "bus_plate": "29B04004",
                            "passenger_count": 27
                        },
                        {
                            "bus_plate": "29B04005",
                            "passenger_count": 29
                        }
                    ]
                },
                {
                    "time": "2024:06:05 10:15:00",
                    "buses": [
                        {
                            "bus_plate": "29B04001",
                            "passenger_count": 19
                        },
                        {
                            "bus_plate": "29B04002",
                            "passenger_count": 16
                        },
                        {
                            "bus_plate": "29B04003",
                            "passenger_count": 10
                        },
                        {
                            "bus_plate": "29B04004",
                            "passenger_count": 16
                        },
                        {
                            "bus_plate": "29B04005",
                            "passenger_count": 13
                        }
                    ]
                },
                {
                    "time": "2024:06:05 10:10:00",
                    "buses": [
                        {
                            "bus_plate": "29B04001",
                            "passenger_count": 21
                        },
                        {
                            "bus_plate": "29B04002",
                            "passenger_count": 13
                        },
                        {
                            "bus_plate": "29B04003",
                            "passenger_count": 11
                        },
                        {
                            "bus_plate": "29B04004",
                            "passenger_count": 29
                        },
                        {
                            "bus_plate": "29B04005",
                            "passenger_count": 23
                        }
                    ]
                },
                {
                    "time": "2024:06:05 10:05:00",
                    "buses": [
                        {
                            "bus_plate": "29B04001",
                            "passenger_count": 30
                        },
                        {
                            "bus_plate": "29B04002",
                            "passenger_count": 9
                        },
                        {
                            "bus_plate": "29B04003",
                            "passenger_count": 6
                        },
                        {
                            "bus_plate": "29B04004",
                            "passenger_count": 17
                        },
                        {
                            "bus_plate": "29B04005",
                            "passenger_count": 15
                        }
                    ]
                },
                {
                    "time": "2024:06:05 10:00:00",
                    "buses": [
                        {
                            "bus_plate": "29B04001",
                            "passenger_count": 9
                        },
                        {
                            "bus_plate": "29B04002",
                            "passenger_count": 23
                        },
                        {
                            "bus_plate": "29B04003",
                            "passenger_count": 28
                        },
                        {
                            "bus_plate": "29B04004",
                            "passenger_count": 15
                        },
                        {
                            "bus_plate": "29B04005",
                            "passenger_count": 4
                        }
                    ]
                },
                {
                    "time": "2024:06:05 09:55:00",
                    "buses": [
                        {
                            "bus_plate": "29B04001",
                            "passenger_count": 1
                        },
                        {
                            "bus_plate": "29B04002",
                            "passenger_count": 29
                        },
                        {
                            "bus_plate": "29B04003",
                            "passenger_count": 21
                        },
                        {
                            "bus_plate": "29B04004",
                            "passenger_count": 12
                        },
                        {
                            "bus_plate": "29B04005",
                            "passenger_count": 7
                        }
                    ]
                },
                {
                    "time": "2024:06:05 09:50:00",
                    "buses": [
                        {
                            "bus_plate": "29B04001",
                            "passenger_count": 11
                        },
                        {
                            "bus_plate": "29B04002",
                            "passenger_count": 28
                        },
                        {
                            "bus_plate": "29B04003",
                            "passenger_count": 19
                        },
                        {
                            "bus_plate": "29B04004",
                            "passenger_count": 29
                        },
                        {
                            "bus_plate": "29B04005",
                            "passenger_count": 7
                        }
                    ]
                },
                {
                    "time": "2024:06:05 09:45:00",
                    "buses": [
                        {
                            "bus_plate": "29B04001",
                            "passenger_count": 26
                        },
                        {
                            "bus_plate": "29B04002",
                            "passenger_count": 18
                        },
                        {
                            "bus_plate": "29B04003",
                            "passenger_count": 3
                        },
                        {
                            "bus_plate": "29B04004",
                            "passenger_count": 1
                        },
                        {
                            "bus_plate": "29B04005",
                            "passenger_count": 10
                        }
                    ]
                },
                {
                    "time": "2024:06:05 09:40:00",
                    "buses": [
                        {
                            "bus_plate": "29B04001",
                            "passenger_count": 14
                        },
                        {
                            "bus_plate": "29B04002",
                            "passenger_count": 4
                        },
                        {
                            "bus_plate": "29B04003",
                            "passenger_count": 30
                        },
                        {
                            "bus_plate": "29B04004",
                            "passenger_count": 13
                        },
                        {
                            "bus_plate": "29B04005",
                            "passenger_count": 15
                        }
                    ]
                },
                {
                    "time": "2024:06:05 09:35:00",
                    "buses": [
                        {
                            "bus_plate": "29B04001",
                            "passenger_count": 24
                        },
                        {
                            "bus_plate": "29B04002",
                            "passenger_count": 7
                        },
                        {
                            "bus_plate": "29B04003",
                            "passenger_count": 28
                        },
                        {
                            "bus_plate": "29B04004",
                            "passenger_count": 3
                        },
                        {
                            "bus_plate": "29B04005",
                            "passenger_count": 15
                        }
                    ]
                },
                {
                    "time": "2024:06:05 09:30:00",
                    "buses": [
                        {
                            "bus_plate": "29B04001",
                            "passenger_count": 13
                        },
                        {
                            "bus_plate": "29B04002",
                            "passenger_count": 15
                        },
                        {
                            "bus_plate": "29B04003",
                            "passenger_count": 5
                        },
                        {
                            "bus_plate": "29B04004",
                            "passenger_count": 21
                        },
                        {
                            "bus_plate": "29B04005",
                            "passenger_count": 20
                        }
                    ]
                },
                {
                    "time": "2024:06:05 09:25:00",
                    "buses": [
                        {
                            "bus_plate": "29B04001",
                            "passenger_count": 27
                        },
                        {
                            "bus_plate": "29B04002",
                            "passenger_count": 13
                        },
                        {
                            "bus_plate": "29B04003",
                            "passenger_count": 5
                        },
                        {
                            "bus_plate": "29B04004",
                            "passenger_count": 7
                        },
                        {
                            "bus_plate": "29B04005",
                            "passenger_count": 4
                        }
                    ]
                },
                {
                    "time": "2024:06:05 09:20:00",
                    "buses": [
                        {
                            "bus_plate": "29B04001",
                            "passenger_count": 17
                        },
                        {
                            "bus_plate": "29B04002",
                            "passenger_count": 1
                        },
                        {
                            "bus_plate": "29B04003",
                            "passenger_count": 2
                        },
                        {
                            "bus_plate": "29B04004",
                            "passenger_count": 29
                        },
                        {
                            "bus_plate": "29B04005",
                            "passenger_count": 28
                        }
                    ]
                },
                {
                    "time": "2024:06:05 09:15:00",
                    "buses": [
                        {
                            "bus_plate": "29B04001",
                            "passenger_count": 5
                        },
                        {
                            "bus_plate": "29B04002",
                            "passenger_count": 9
                        },
                        {
                            "bus_plate": "29B04003",
                            "passenger_count": 5
                        },
                        {
                            "bus_plate": "29B04004",
                            "passenger_count": 23
                        },
                        {
                            "bus_plate": "29B04005",
                            "passenger_count": 25
                        }
                    ]
                },
                {
                    "time": "2024:06:05 09:10:00",
                    "buses": [
                        {
                            "bus_plate": "29B04001",
                            "passenger_count": 8
                        },
                        {
                            "bus_plate": "29B04002",
                            "passenger_count": 9
                        },
                        {
                            "bus_plate": "29B04003",
                            "passenger_count": 13
                        },
                        {
                            "bus_plate": "29B04004",
                            "passenger_count": 14
                        },
                        {
                            "bus_plate": "29B04005",
                            "passenger_count": 28
                        }
                    ]
                },
                {
                    "time": "2024:06:05 09:05:00",
                    "buses": [
                        {
                            "bus_plate": "29B04001",
                            "passenger_count": 27
                        },
                        {
                            "bus_plate": "29B04002",
                            "passenger_count": 14
                        },
                        {
                            "bus_plate": "29B04003",
                            "passenger_count": 15
                        },
                        {
                            "bus_plate": "29B04004",
                            "passenger_count": 27
                        },
                        {
                            "bus_plate": "29B04005",
                            "passenger_count": 12
                        }
                    ]
                }
            ]
        },
        {
            "route": "41",
            "total_passenger": 2848,
            "graph_data": [
                {
                    "time": "2024:06:05 12:00:00",
                    "buses": [
                        {
                            "bus_plate": "29B04101",
                            "passenger_count": 26
                        },
                        {
                            "bus_plate": "29B04102",
                            "passenger_count": 26
                        },
                        {
                            "bus_plate": "29B04103",
                            "passenger_count": 14
                        },
                        {
                            "bus_plate": "29B04104",
                            "passenger_count": 8
                        },
                        {
                            "bus_plate": "29B04105",
                            "passenger_count": 19
                        }
                    ]
                },
                {
                    "time": "2024:06:05 11:55:00",
                    "buses": [
                        {
                            "bus_plate": "29B04101",
                            "passenger_count": 5
                        },
                        {
                            "bus_plate": "29B04102",
                            "passenger_count": 29
                        },
                        {
                            "bus_plate": "29B04103",
                            "passenger_count": 16
                        },
                        {
                            "bus_plate": "29B04104",
                            "passenger_count": 30
                        },
                        {
                            "bus_plate": "29B04105",
                            "passenger_count": 6
                        }
                    ]
                },
                {
                    "time": "2024:06:05 11:50:00",
                    "buses": [
                        {
                            "bus_plate": "29B04101",
                            "passenger_count": 6
                        },
                        {
                            "bus_plate": "29B04102",
                            "passenger_count": 17
                        },
                        {
                            "bus_plate": "29B04103",
                            "passenger_count": 12
                        },
                        {
                            "bus_plate": "29B04104",
                            "passenger_count": 5
                        },
                        {
                            "bus_plate": "29B04105",
                            "passenger_count": 27
                        }
                    ]
                },
                {
                    "time": "2024:06:05 11:45:00",
                    "buses": [
                        {
                            "bus_plate": "29B04101",
                            "passenger_count": 21
                        },
                        {
                            "bus_plate": "29B04102",
                            "passenger_count": 22
                        },
                        {
                            "bus_plate": "29B04103",
                            "passenger_count": 14
                        },
                        {
                            "bus_plate": "29B04104",
                            "passenger_count": 24
                        },
                        {
                            "bus_plate": "29B04105",
                            "passenger_count": 19
                        }
                    ]
                },
                {
                    "time": "2024:06:05 11:40:00",
                    "buses": [
                        {
                            "bus_plate": "29B04101",
                            "passenger_count": 19
                        },
                        {
                            "bus_plate": "29B04102",
                            "passenger_count": 20
                        },
                        {
                            "bus_plate": "29B04103",
                            "passenger_count": 28
                        },
                        {
                            "bus_plate": "29B04104",
                            "passenger_count": 20
                        },
                        {
                            "bus_plate": "29B04105",
                            "passenger_count": 7
                        }
                    ]
                },
                {
                    "time": "2024:06:05 11:35:00",
                    "buses": [
                        {
                            "bus_plate": "29B04101",
                            "passenger_count": 22
                        },
                        {
                            "bus_plate": "29B04102",
                            "passenger_count": 28
                        },
                        {
                            "bus_plate": "29B04103",
                            "passenger_count": 5
                        },
                        {
                            "bus_plate": "29B04104",
                            "passenger_count": 17
                        },
                        {
                            "bus_plate": "29B04105",
                            "passenger_count": 27
                        }
                    ]
                },
                {
                    "time": "2024:06:05 11:30:00",
                    "buses": [
                        {
                            "bus_plate": "29B04101",
                            "passenger_count": 12
                        },
                        {
                            "bus_plate": "29B04102",
                            "passenger_count": 1
                        },
                        {
                            "bus_plate": "29B04103",
                            "passenger_count": 30
                        },
                        {
                            "bus_plate": "29B04104",
                            "passenger_count": 6
                        },
                        {
                            "bus_plate": "29B04105",
                            "passenger_count": 7
                        }
                    ]
                },
                {
                    "time": "2024:06:05 11:25:00",
                    "buses": [
                        {
                            "bus_plate": "29B04101",
                            "passenger_count": 18
                        },
                        {
                            "bus_plate": "29B04102",
                            "passenger_count": 23
                        },
                        {
                            "bus_plate": "29B04103",
                            "passenger_count": 1
                        },
                        {
                            "bus_plate": "29B04104",
                            "passenger_count": 29
                        },
                        {
                            "bus_plate": "29B04105",
                            "passenger_count": 4
                        }
                    ]
                },
                {
                    "time": "2024:06:05 11:20:00",
                    "buses": [
                        {
                            "bus_plate": "29B04101",
                            "passenger_count": 10
                        },
                        {
                            "bus_plate": "29B04102",
                            "passenger_count": 23
                        },
                        {
                            "bus_plate": "29B04103",
                            "passenger_count": 21
                        },
                        {
                            "bus_plate": "29B04104",
                            "passenger_count": 11
                        },
                        {
                            "bus_plate": "29B04105",
                            "passenger_count": 11
                        }
                    ]
                },
                {
                    "time": "2024:06:05 11:15:00",
                    "buses": [
                        {
                            "bus_plate": "29B04101",
                            "passenger_count": 25
                        },
                        {
                            "bus_plate": "29B04102",
                            "passenger_count": 23
                        },
                        {
                            "bus_plate": "29B04103",
                            "passenger_count": 8
                        },
                        {
                            "bus_plate": "29B04104",
                            "passenger_count": 12
                        },
                        {
                            "bus_plate": "29B04105",
                            "passenger_count": 23
                        }
                    ]
                },
                {
                    "time": "2024:06:05 11:10:00",
                    "buses": [
                        {
                            "bus_plate": "29B04101",
                            "passenger_count": 7
                        },
                        {
                            "bus_plate": "29B04102",
                            "passenger_count": 29
                        },
                        {
                            "bus_plate": "29B04103",
                            "passenger_count": 6
                        },
                        {
                            "bus_plate": "29B04104",
                            "passenger_count": 7
                        },
                        {
                            "bus_plate": "29B04105",
                            "passenger_count": 16
                        }
                    ]
                },
                {
                    "time": "2024:06:05 11:05:00",
                    "buses": [
                        {
                            "bus_plate": "29B04101",
                            "passenger_count": 29
                        },
                        {
                            "bus_plate": "29B04102",
                            "passenger_count": 24
                        },
                        {
                            "bus_plate": "29B04103",
                            "passenger_count": 21
                        },
                        {
                            "bus_plate": "29B04104",
                            "passenger_count": 24
                        },
                        {
                            "bus_plate": "29B04105",
                            "passenger_count": 8
                        }
                    ]
                },
                {
                    "time": "2024:06:05 11:00:00",
                    "buses": [
                        {
                            "bus_plate": "29B04101",
                            "passenger_count": 6
                        },
                        {
                            "bus_plate": "29B04102",
                            "passenger_count": 18
                        },
                        {
                            "bus_plate": "29B04103",
                            "passenger_count": 23
                        },
                        {
                            "bus_plate": "29B04104",
                            "passenger_count": 1
                        },
                        {
                            "bus_plate": "29B04105",
                            "passenger_count": 10
                        }
                    ]
                },
                {
                    "time": "2024:06:05 10:55:00",
                    "buses": [
                        {
                            "bus_plate": "29B04101",
                            "passenger_count": 1
                        },
                        {
                            "bus_plate": "29B04102",
                            "passenger_count": 14
                        },
                        {
                            "bus_plate": "29B04103",
                            "passenger_count": 11
                        },
                        {
                            "bus_plate": "29B04104",
                            "passenger_count": 8
                        },
                        {
                            "bus_plate": "29B04105",
                            "passenger_count": 29
                        }
                    ]
                },
                {
                    "time": "2024:06:05 10:50:00",
                    "buses": [
                        {
                            "bus_plate": "29B04101",
                            "passenger_count": 28
                        },
                        {
                            "bus_plate": "29B04102",
                            "passenger_count": 14
                        },
                        {
                            "bus_plate": "29B04103",
                            "passenger_count": 2
                        },
                        {
                            "bus_plate": "29B04104",
                            "passenger_count": 27
                        },
                        {
                            "bus_plate": "29B04105",
                            "passenger_count": 1
                        }
                    ]
                },
                {
                    "time": "2024:06:05 10:45:00",
                    "buses": [
                        {
                            "bus_plate": "29B04101",
                            "passenger_count": 28
                        },
                        {
                            "bus_plate": "29B04102",
                            "passenger_count": 13
                        },
                        {
                            "bus_plate": "29B04103",
                            "passenger_count": 4
                        },
                        {
                            "bus_plate": "29B04104",
                            "passenger_count": 6
                        },
                        {
                            "bus_plate": "29B04105",
                            "passenger_count": 9
                        }
                    ]
                },
                {
                    "time": "2024:06:05 10:40:00",
                    "buses": [
                        {
                            "bus_plate": "29B04101",
                            "passenger_count": 25
                        },
                        {
                            "bus_plate": "29B04102",
                            "passenger_count": 25
                        },
                        {
                            "bus_plate": "29B04103",
                            "passenger_count": 16
                        },
                        {
                            "bus_plate": "29B04104",
                            "passenger_count": 30
                        },
                        {
                            "bus_plate": "29B04105",
                            "passenger_count": 18
                        }
                    ]
                },
                {
                    "time": "2024:06:05 10:35:00",
                    "buses": [
                        {
                            "bus_plate": "29B04101",
                            "passenger_count": 29
                        },
                        {
                            "bus_plate": "29B04102",
                            "passenger_count": 21
                        },
                        {
                            "bus_plate": "29B04103",
                            "passenger_count": 4
                        },
                        {
                            "bus_plate": "29B04104",
                            "passenger_count": 19
                        },
                        {
                            "bus_plate": "29B04105",
                            "passenger_count": 28
                        }
                    ]
                },
                {
                    "time": "2024:06:05 10:30:00",
                    "buses": [
                        {
                            "bus_plate": "29B04101",
                            "passenger_count": 6
                        },
                        {
                            "bus_plate": "29B04102",
                            "passenger_count": 23
                        },
                        {
                            "bus_plate": "29B04103",
                            "passenger_count": 20
                        },
                        {
                            "bus_plate": "29B04104",
                            "passenger_count": 9
                        },
                        {
                            "bus_plate": "29B04105",
                            "passenger_count": 3
                        }
                    ]
                },
                {
                    "time": "2024:06:05 10:25:00",
                    "buses": [
                        {
                            "bus_plate": "29B04101",
                            "passenger_count": 15
                        },
                        {
                            "bus_plate": "29B04102",
                            "passenger_count": 5
                        },
                        {
                            "bus_plate": "29B04103",
                            "passenger_count": 28
                        },
                        {
                            "bus_plate": "29B04104",
                            "passenger_count": 17
                        },
                        {
                            "bus_plate": "29B04105",
                            "passenger_count": 24
                        }
                    ]
                },
                {
                    "time": "2024:06:05 10:20:00",
                    "buses": [
                        {
                            "bus_plate": "29B04101",
                            "passenger_count": 16
                        },
                        {
                            "bus_plate": "29B04102",
                            "passenger_count": 23
                        },
                        {
                            "bus_plate": "29B04103",
                            "passenger_count": 12
                        },
                        {
                            "bus_plate": "29B04104",
                            "passenger_count": 7
                        },
                        {
                            "bus_plate": "29B04105",
                            "passenger_count": 18
                        }
                    ]
                },
                {
                    "time": "2024:06:05 10:15:00",
                    "buses": [
                        {
                            "bus_plate": "29B04101",
                            "passenger_count": 19
                        },
                        {
                            "bus_plate": "29B04102",
                            "passenger_count": 7
                        },
                        {
                            "bus_plate": "29B04103",
                            "passenger_count": 16
                        },
                        {
                            "bus_plate": "29B04104",
                            "passenger_count": 18
                        },
                        {
                            "bus_plate": "29B04105",
                            "passenger_count": 10
                        }
                    ]
                },
                {
                    "time": "2024:06:05 10:10:00",
                    "buses": [
                        {
                            "bus_plate": "29B04101",
                            "passenger_count": 28
                        },
                        {
                            "bus_plate": "29B04102",
                            "passenger_count": 1
                        },
                        {
                            "bus_plate": "29B04103",
                            "passenger_count": 15
                        },
                        {
                            "bus_plate": "29B04104",
                            "passenger_count": 1
                        },
                        {
                            "bus_plate": "29B04105",
                            "passenger_count": 21
                        }
                    ]
                },
                {
                    "time": "2024:06:05 10:05:00",
                    "buses": [
                        {
                            "bus_plate": "29B04101",
                            "passenger_count": 3
                        },
                        {
                            "bus_plate": "29B04102",
                            "passenger_count": 29
                        },
                        {
                            "bus_plate": "29B04103",
                            "passenger_count": 19
                        },
                        {
                            "bus_plate": "29B04104",
                            "passenger_count": 4
                        },
                        {
                            "bus_plate": "29B04105",
                            "passenger_count": 20
                        }
                    ]
                },
                {
                    "time": "2024:06:05 10:00:00",
                    "buses": [
                        {
                            "bus_plate": "29B04101",
                            "passenger_count": 10
                        },
                        {
                            "bus_plate": "29B04102",
                            "passenger_count": 3
                        },
                        {
                            "bus_plate": "29B04103",
                            "passenger_count": 20
                        },
                        {
                            "bus_plate": "29B04104",
                            "passenger_count": 30
                        },
                        {
                            "bus_plate": "29B04105",
                            "passenger_count": 8
                        }
                    ]
                },
                {
                    "time": "2024:06:05 09:55:00",
                    "buses": [
                        {
                            "bus_plate": "29B04101",
                            "passenger_count": 5
                        },
                        {
                            "bus_plate": "29B04102",
                            "passenger_count": 19
                        },
                        {
                            "bus_plate": "29B04103",
                            "passenger_count": 18
                        },
                        {
                            "bus_plate": "29B04104",
                            "passenger_count": 23
                        },
                        {
                            "bus_plate": "29B04105",
                            "passenger_count": 3
                        }
                    ]
                },
                {
                    "time": "2024:06:05 09:50:00",
                    "buses": [
                        {
                            "bus_plate": "29B04101",
                            "passenger_count": 17
                        },
                        {
                            "bus_plate": "29B04102",
                            "passenger_count": 10
                        },
                        {
                            "bus_plate": "29B04103",
                            "passenger_count": 12
                        },
                        {
                            "bus_plate": "29B04104",
                            "passenger_count": 14
                        },
                        {
                            "bus_plate": "29B04105",
                            "passenger_count": 12
                        }
                    ]
                },
                {
                    "time": "2024:06:05 09:45:00",
                    "buses": [
                        {
                            "bus_plate": "29B04101",
                            "passenger_count": 9
                        },
                        {
                            "bus_plate": "29B04102",
                            "passenger_count": 30
                        },
                        {
                            "bus_plate": "29B04103",
                            "passenger_count": 24
                        },
                        {
                            "bus_plate": "29B04104",
                            "passenger_count": 22
                        },
                        {
                            "bus_plate": "29B04105",
                            "passenger_count": 6
                        }
                    ]
                },
                {
                    "time": "2024:06:05 09:40:00",
                    "buses": [
                        {
                            "bus_plate": "29B04101",
                            "passenger_count": 7
                        },
                        {
                            "bus_plate": "29B04102",
                            "passenger_count": 8
                        },
                        {
                            "bus_plate": "29B04103",
                            "passenger_count": 14
                        },
                        {
                            "bus_plate": "29B04104",
                            "passenger_count": 9
                        },
                        {
                            "bus_plate": "29B04105",
                            "passenger_count": 20
                        }
                    ]
                },
                {
                    "time": "2024:06:05 09:35:00",
                    "buses": [
                        {
                            "bus_plate": "29B04101",
                            "passenger_count": 6
                        },
                        {
                            "bus_plate": "29B04102",
                            "passenger_count": 29
                        },
                        {
                            "bus_plate": "29B04103",
                            "passenger_count": 14
                        },
                        {
                            "bus_plate": "29B04104",
                            "passenger_count": 23
                        },
                        {
                            "bus_plate": "29B04105",
                            "passenger_count": 30
                        }
                    ]
                },
                {
                    "time": "2024:06:05 09:30:00",
                    "buses": [
                        {
                            "bus_plate": "29B04101",
                            "passenger_count": 14
                        },
                        {
                            "bus_plate": "29B04102",
                            "passenger_count": 23
                        },
                        {
                            "bus_plate": "29B04103",
                            "passenger_count": 25
                        },
                        {
                            "bus_plate": "29B04104",
                            "passenger_count": 22
                        },
                        {
                            "bus_plate": "29B04105",
                            "passenger_count": 1
                        }
                    ]
                },
                {
                    "time": "2024:06:05 09:25:00",
                    "buses": [
                        {
                            "bus_plate": "29B04101",
                            "passenger_count": 15
                        },
                        {
                            "bus_plate": "29B04102",
                            "passenger_count": 23
                        },
                        {
                            "bus_plate": "29B04103",
                            "passenger_count": 12
                        },
                        {
                            "bus_plate": "29B04104",
                            "passenger_count": 29
                        },
                        {
                            "bus_plate": "29B04105",
                            "passenger_count": 4
                        }
                    ]
                },
                {
                    "time": "2024:06:05 09:20:00",
                    "buses": [
                        {
                            "bus_plate": "29B04101",
                            "passenger_count": 5
                        },
                        {
                            "bus_plate": "29B04102",
                            "passenger_count": 20
                        },
                        {
                            "bus_plate": "29B04103",
                            "passenger_count": 5
                        },
                        {
                            "bus_plate": "29B04104",
                            "passenger_count": 21
                        },
                        {
                            "bus_plate": "29B04105",
                            "passenger_count": 9
                        }
                    ]
                },
                {
                    "time": "2024:06:05 09:15:00",
                    "buses": [
                        {
                            "bus_plate": "29B04101",
                            "passenger_count": 16
                        },
                        {
                            "bus_plate": "29B04102",
                            "passenger_count": 16
                        },
                        {
                            "bus_plate": "29B04103",
                            "passenger_count": 30
                        },
                        {
                            "bus_plate": "29B04104",
                            "passenger_count": 17
                        },
                        {
                            "bus_plate": "29B04105",
                            "passenger_count": 7
                        }
                    ]
                },
                {
                    "time": "2024:06:05 09:10:00",
                    "buses": [
                        {
                            "bus_plate": "29B04101",
                            "passenger_count": 3
                        },
                        {
                            "bus_plate": "29B04102",
                            "passenger_count": 28
                        },
                        {
                            "bus_plate": "29B04103",
                            "passenger_count": 25
                        },
                        {
                            "bus_plate": "29B04104",
                            "passenger_count": 8
                        },
                        {
                            "bus_plate": "29B04105",
                            "passenger_count": 16
                        }
                    ]
                },
                {
                    "time": "2024:06:05 09:05:00",
                    "buses": [
                        {
                            "bus_plate": "29B04101",
                            "passenger_count": 6
                        },
                        {
                            "bus_plate": "29B04102",
                            "passenger_count": 23
                        },
                        {
                            "bus_plate": "29B04103",
                            "passenger_count": 1
                        },
                        {
                            "bus_plate": "29B04104",
                            "passenger_count": 28
                        },
                        {
                            "bus_plate": "29B04105",
                            "passenger_count": 28
                        }
                    ]
                }
            ]
        }
    ]
}

const jsonServer = (req, res) => {
    return res.json(data);
}


module.exports = {showProduct, elasticSearch, pipeLine, jsonServer};
