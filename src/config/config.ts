import * as dotenv from 'dotenv';
dotenv.config();

const config = {
  web: {
    mongoDBUri: process.env.MONGO_DB_URI,
    youVerifyNIN: process.env.YOUVERIFY_API_URL,
    token: process.env.YOUVERIFY_API_TOKEN
  },
};

export default config;
