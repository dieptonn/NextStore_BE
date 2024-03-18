const authRouter = require('./auth');
const homeRouter = require('./home');
const cookerRouter = require('./categories/cooker');
const freezerRouter = require('./categories/freezer');
const fridgeRouter = require('./categories/fridge');
const fryerRouter = require('./categories/fryer');
const robotRouter = require('./categories/robot');
const televisionRouter = require('./categories/television');
const washingMachineRouter = require('./categories/washingMachine');
const waterHeaterRouter = require('./categories/waterHeater');
const airRouter = require('./categories/air');
const chatBot = require('./chatbot')


function route(app) {
    app.use('/api/v1/auth', authRouter);
    app.use('/api/v1/home', homeRouter);
    app.use('/api/v1/cookers', cookerRouter);
    app.use('/api/v1/freezers', freezerRouter);
    app.use('/api/v1/fridges', fridgeRouter);
    app.use('/api/v1/fryers', fryerRouter);
    app.use('/api/v1/robots', robotRouter);
    app.use('/api/v1/televisions', televisionRouter);
    app.use('/api/v1/washingMachines', washingMachineRouter);
    app.use('/api/v1/waterHeaters', waterHeaterRouter);
    app.use('/api/v1/airs', airRouter);
    app.use('/api/v1/chatbot', chatBot);


}

module.exports = route;
