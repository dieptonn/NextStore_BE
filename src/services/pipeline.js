const elasticsearchClient = require('../../services/elasticSearch');

const Air = require('../app/models/Air');


const pipeLine = async () => {

    const data = await Air.find({}); // Truy vấn tất cả các tài liệu từ MongoDB

    const body = data.flatMap(doc => [{ index: { _index: 'Air', _type: '_doc', _id: doc._id } }, doc]);
    const { body: bulkResponse } = await elasticsearchClient.bulk({ refresh: true, body });

    if (bulkResponse.errors) {
        const erroredDocuments = [];
        bulkResponse.items.forEach((action, i) => {
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
    }
}

module.exports = { pipeLine }
