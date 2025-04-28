const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");
const User = require("./User");

const Video = sequelize.define("Video", {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  userId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: { model: User, key: "id" },
  },
  title: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  filename: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  status: {
    type: DataTypes.ENUM("published", "hidden"),
    defaultValue: "published",
  },
  processingStatus: {
    type: DataTypes.ENUM("processing", "ready", "failed"),
    defaultValue: "processing",
  },
  size: {
    type: DataTypes.INTEGER, // bytes
  },
  duration: {
    type: DataTypes.FLOAT, // in seconds
  },
  resolution: {
    type: DataTypes.STRING, // e.g., "1920x1080"
  },
  username: {
    type: DataTypes.STRING,
    allowNull: true, // Optional if you still want to join from User
  },
}, { timestamps: true });

Video.belongsTo(User, { foreignKey: "userId" });

module.exports = Video;
