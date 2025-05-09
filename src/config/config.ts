import * as dotenv from 'dotenv';
dotenv.config();

const config = {
  web: {
    mongoDBUri: process.env.MONGO_DB_URI,
  },
};

export default config;
