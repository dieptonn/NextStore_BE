

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

module.exports = { showProduct };
