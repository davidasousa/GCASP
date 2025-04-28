require('dotenv').config();

module.exports = {
  development: {
    username: process.env.POSTGRES_USER,
    password: process.env.POSTGRES_PASSWORD,
    database: process.env.POSTGRES_DB,
    host: process.env.POSTGRES_HOST,
    dialect: 'postgres'
  },
  test: {
    username: process.env.POSTGRES_USER,
    password: process.env.POSTGRES_PASSWORD,
    database: process.env.POSTGRES_DB,
    host: process.env.POSTGRES_HOST,
    dialect: 'postgres'
  },
  production: {
    username: process.env.POSTGRES_AWS_DB_USER,
    password: process.env.POSTGRES_AWS_DB_PASSWORD,
    database: process.env.POSTGRES_AWS_DB,
    host: process.env.POSTGRES_AWS_DB_HOST,
    dialect: 'postgres',
    logging: false
  }
};