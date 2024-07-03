import * as Joi from 'joi';

export const createUserSchema = Joi.object({
  firstName: Joi.string().required(),
  lastName: Joi.string().required(),
  email: Joi.string().email().required(),
  nin: Joi.string().required(),
  phoneNumber: Joi.string().length(11).pattern(/^\d+$/).required(),
  homeAddress: Joi.string().required(),
  password: Joi.string().required(),
  accountType: Joi.string().valid('landlord', 'tenant').required(), // Validate accountType to be either 'landlord' or 'tenant'
});


export const confirmUserSchema = Joi.object({
    email: Joi.string().email().required(),
    confirmationCode: Joi.string().required().length(6)
  });

  export const loginUserSchema = Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().required()
  });

  export const createPropertySchema = Joi.object({
    streetAddress: Joi.string().required(),
    unit: Joi.string().required(),
    city: Joi.string().required(),
    state: Joi.string().required(),
    zipCode: Joi.string().required(),
    propertyType: Joi.string().required(),
    createdBy: Joi.string().required(),
    file: Joi.any(),
    landlordInsurancePolicy: Joi.any().optional(), // Assuming these fields can accept any type of data
    // utilityAndMaintenance: Joi.any(),
    // otherDocuments: Joi.any(),
  });

  export const updatePropertySchema = Joi.object({
    streetAddress: Joi.string().optional(),
    unit: Joi.string().optional(),
    city: Joi.string().optional(),
    state: Joi.string().optional(),
    zipCode: Joi.string().optional(),
    propertyType: Joi.string().optional(),
    createdBy: Joi.string().optional(),
    file: Joi.any().optional(),
    landlordInsurancePolicy: Joi.any().optional(), // Assuming these fields can accept any type of data
    utilityAndMaintenance: Joi.any(),
    otherDocuments: Joi.any(),
  });



  export const createRoomSchema = Joi.object({
    name: Joi.string().required(),
    description: Joi.string().required(),
    propertyId: Joi.any().required(),
    targetDeposit: Joi.string().required(),
    rentAmountMetrics: Joi.string().required(),
    rentAmount: Joi.string().required(),
    file: Joi.any().optional(),
    noOfBaths: Joi.string().required(),
    targetRent: Joi.string().required(),
    noOfPools: Joi.string().required(),
    noOfRooms: Joi.string().required(),
    otherAmentities: Joi.string().required(),
  });