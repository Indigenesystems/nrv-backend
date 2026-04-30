import * as dotenv from 'dotenv';
dotenv.config();

const config = {
  web: {
    mongoDBUri: process.env.MONGO_DB_URI,
    youVerifyNIN: 'tU5Dj3iL.d7Zu1KibyLHCL9a0eTakkxC1BRfKwonpba3j',
    token: 'https://api.sandbox.youverify.co/v2/api/identity/ng/nin'
  },
};

export default config;
