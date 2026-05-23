import * as dotenv from 'dotenv';
dotenv.config({ override: true });

const config = {
  web: {
    mongoDBUri: process.env.MONGO_DB_URI,
    youVerifyToken: process.env.YOUVERIFY_API_TOKEN,
    youVerifyNinUrl:
      process.env.YOUVERIFY_API_URL ||
      'https://api.youverify.co/v2/api/identity/ng/nin',
  },
};

export default config;
