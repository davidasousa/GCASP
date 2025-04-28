const { Sequelize } = require("sequelize");
require("dotenv").config();

let sequelize;

// Check if running in production mode
if (process.env.PROD === "true") {
  // Use AWS database parameters
  sequelize = new Sequelize(
    process.env.POSTGRES_AWS_DB,
    process.env.POSTGRES_AWS_DB_USER,
    process.env.POSTGRES_AWS_DB_PASSWORD,
    {
      host: process.env.POSTGRES_AWS_DB_HOST,
      port: 5432,
      dialect: "postgres",
      logging: false,
      dialectOptions: {
        ssl: {
          require: true,
          rejectUnauthorized: false,
        },
      },
    }
  );
} else {
  // Use local database parameters
  sequelize = new Sequelize(
    process.env.POSTGRES_DB,
    process.env.POSTGRES_USER,
    process.env.POSTGRES_PASSWORD,
    {
      host: process.env.POSTGRES_HOST,
      port: 5432,
      dialect: "postgres",
      logging: false,
    }
  );
}

sequelize
  .authenticate()
  .then(() => console.log("PostgreSQL Connected"))
  .catch(err => console.error("Database Connection Error:", err));

module.exports = sequelize;
