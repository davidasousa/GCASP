const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");
const User = require("./User");

const Video = sequelize.define("Video", {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
    },
    filename: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    userId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: User, key: "id" },
    }
}, { timestamps: true });

Video.belongsTo(User, { foreignKey: "userId" });

module.exports = Video;
