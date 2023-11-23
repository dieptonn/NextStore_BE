const { ObjectId } = require('mongoose').Types;
const Staff = require('../models/staff');

const createStaff = async ({
    fullName,
    email,
    address,
    phone,
    cookExp,
    careExp,
    gender,
    birthday,
    salary,
}) => {
    const staff = await Staff.create({
        fullName,
        email,
        address,
        phone,
        cookExp,
        careExp,
        gender,
        birthday,
        salary,
    });
    return staff;
};

const allStaff = async () => {
    const staff = await Staff.aggregate([
        {
            $lookup: {
                from: 'languages',
                let: { userLanguage: '$userLanguage' },
                pipeline: [
                    {
                        $match: {
                            $expr: { $in: ['$_id', '$$userLanguage'] },
                        },
                    },
                ],
                as: 'userLanguage',
            },
        },
    ]);
    return staff;
};

const findStaff = async (condition) => {
    if (ObjectId.isValid(condition)) {
        const staff = await Staff.aggregate([
            { $match: { _id: ObjectId(condition) } },
            {
                $lookup: {
                    from: 'languages',
                    let: { userLanguage: '$userLanguage' },
                    pipeline: [
                        {
                            $match: {
                                $expr: { $in: ['$_id', '$$userLanguage'] },
                            },
                        },
                    ],
                    as: 'userLanguage',
                },
            },
        ]);
        return staff;
    }

    if (typeof condition === 'object' && condition !== null) {
        const staff = await Staff.findOne(condition);
        return staff;
    }

    return null;
};

const updateStaff = async (staffId, data) => {
    const staff = await Staff.findByIdAndUpdate(staffId, data, {
        new: true,
    });
    return staff;
};

const deleteStaff = async (staffId) => {
    await Staff.findByIdAndDelete(staffId);
};

const createRating = async (staffId, { userId, review, start }) => {
    const staff = await Staff.findByIdAndUpdate(
        staffId,
        {
            $push: {
                rating: {
                    userId,
                    review,
                    start,
                },
            },
        },
        {
            new: true,
        },
    );
    return staff;
};

const deleteRating = async (ratingId) => {
    await Staff.updateMany(
        { $pull: { rating: { _id: ratingId } } },
        {
            new: true,
        },
    );
};

module.exports = {
    createStaff,
    allStaff,
    findStaff,
    updateStaff,
    deleteStaff,
    createRating,
    deleteRating,
};
