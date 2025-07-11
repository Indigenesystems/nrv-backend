import * as dotenv from 'dotenv';
dotenv.config();

const config = {
  web: {
    mongoDBUri: 'mongodb+srv://Babajide:Maythird1.!@cluster0.azxmr.mongodb.net/nrv-test-db?retryWrites=true&w=majority&appName=Cluster0',
    youVerifyNIN: 'tU5Dj3iL.d7Zu1KibyLHCL9a0eTakkxC1BRfKwonpba3j',
    token: 'https://api.sandbox.youverify.co/v2/api/identity/ng/nin'
  },
};

export default config;
