const sequelize = require("../config/database");
const User = require("./User");
const Friendship = require("./Friendship");

User.belongsToMany(User, {
  as: "Friends",
  through: Friendship,
  foreignKey: "userId",
  otherKey: "friendId",
});

sequelize.sync({ alter: true }).then(() => {
  console.log("Database Synced");
});

module.exports = { User, Friendship, sequelize };
