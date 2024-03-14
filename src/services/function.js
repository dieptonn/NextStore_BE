// hàm khi thành công
exports.success = (res, messsage = "", data = []) => {
    return res
        .status(200)
        .json({ data: { result: true, message: messsage, ...data }, error: null });
};

// hàm thực thi khi thất bại
exports.setError = (res, message, code = 500) => {
    return res.status(code).json({ data: null, code, error: { message } });
};

exports.getDatafindOne = async (model, condition) => {
    return model.findOne(condition).lean();
};

exports.getDatafind = async (model, condition) => {
    return model.find(condition).lean();
};

exports.getDatafindOneAndUpdate = async (model, condition, projection) => {
    return model.findOneAndUpdate(condition, projection);
};

exports.getMaxID = async (model) => {
    const maxUser =
        (await model.findOne({}, {}, { sort: { _id: -1 } }).lean()) || 0;
    return maxUser._id;
};

exports.getDataDeleteOne = async (model, condition) => {
    return model.deleteOne(condition);
};
