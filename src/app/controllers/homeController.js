const elasticsearchClient = require('../../services/elasticSearch');
const WaterHeater = require('./../models/WaterHeater');


const showProduct = (req, res) => {

    var spawn = require('child_process').spawn;

    var process = spawn('python', [
        'D:/Code/NodeJs/NextStore/src/data/rs.py',
        '--userId',
        req.query.userId
    ]);
    process.stdout.on('data', function (data) {
        console.log(data.toString());

        res.send(data.toString());
    });
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
                size: 1000
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
        const data = await WaterHeater.find({}); // Truy vấn tất cả các tài liệu từ MongoDB

        const body = data.flatMap(doc => {
            const { _id, ...docWithoutId } = doc.toObject(); // Loại bỏ trường _id
            return [{ index: { _index: 'water_heater', _type: '_doc', _id: doc._id.toString() } }, docWithoutId];
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
