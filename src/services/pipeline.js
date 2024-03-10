const elasticsearchClient = require('../../services/elasticSearch');

const Air = require('../app/models/Air');


const pipeLine = async (req, res) => {
    try {
        const data = await Air.find({}); // Truy vấn tất cả các tài liệu từ MongoDB

        const body = data.flatMap(doc => {
            const { _id, ...docWithoutId } = doc.toObject(); // Loại bỏ trường _id
            return [{ index: { _index: 'air', _type: '_doc', _id: doc._id.toString() } }, docWithoutId];
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

module.exports = { pipeLine }
