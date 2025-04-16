const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");
const User = require("./User");

const Friendship = sequelize.define("Friendship", {
  userId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: { model: User, key: "id" },
  },
  friendId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: { model: User, key: "id" },
  },
}, { timestamps: true });

Friendship.belongsTo(User, { foreignKey: "friendId", as: "Friend" });

module.exports = Friendship;
