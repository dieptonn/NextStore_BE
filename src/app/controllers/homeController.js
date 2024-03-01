const elasticsearchClient = require('../../services/elasticSearch');

const showProduct = (req, res) => {
    // res.json({ test: 'hehe' });

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
    try {
        // Truy vấn Elasticsearch
        const { body } = await elasticsearchClient.search({
            index: 'my_index', // Thay thế 'my_index' bằng tên index của bạn
            body: {
                query: {
                    match: {
                        title: req.query.q // Sử dụng query từ yêu cầu để tìm kiếm theo tiêu đề
                    }
                }
            }
        });

        // Trả về kết quả từ Elasticsearch
        res.json(body.hits.hits);
    } catch (error) {
        console.error('Error searching documents:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};


module.exports = { showProduct, elasticSearch };
