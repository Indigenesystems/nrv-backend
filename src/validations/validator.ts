import * as Joi from 'joi';

export const createUserByLandlordSchema = Joi.object({
  firstName: Joi.string().required(),
  lastName: Joi.string().required(),
  email: Joi.string().email().required(),
  nin: Joi.string().required(),
  propertyId: Joi.string().required(),
  ownerId: Joi.string().required(),
  rentStartDate: Joi.any().required(),
  rentEndDate: Joi.any().required(),
  accountType: Joi.string().valid('tenant').required(), // Validate accountType to be either 'landlord' or 'tenant'
});

export const createUserSchema = Joi.object({
  firstName: Joi.string().required(),
  lastName: Joi.string().required(),
  email: Joi.string().email().required(),
  nin: Joi.string().required(),
  password: Joi.string().required(),
  phoneNumber: Joi.string().required(),
  homeAddress: Joi.string().required(),
  accountType: Joi.string().valid('tenant', 'landlord').required(), // Validate accountType to be either 'landlord' or 'tenant'
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
  landlordInsurancePolicy: Joi.any().optional(),
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

export const createMaintenanceSchema = Joi.object({
  title: Joi.string().required(),
  description: Joi.string().required(),
  roomId: Joi.any().required(),
  file: Joi.any().optional(),
  createdBy: Joi.any().required()
});


export const createExpenseSchema = Joi.object({
  amount: Joi.string()
    .min(1)
    .required()
    .messages({
      'string.base': 'Amount must be a string.',
      'string.min': 'Amount cannot be empty.',
      'any.required': 'Amount is required.',
    }),
  category: Joi.string()
    .min(1)
    .required()
    .messages({
      'string.base': 'Category must be a string.',
      'string.min': 'Category cannot be empty.',
      'any.required': 'Category is required.',
    }),

  loggedBy: Joi.string()
    .min(1)
    .required()
    .messages({
      'string.base': 'Category must be a string.',
      'string.min': 'Category cannot be empty.',
      'any.required': 'Category is required.',
    }),

  description: Joi.string()
    .min(1)
    .required()
    .messages({
      'string.base': 'Description must be a string.',
      'string.min': 'Description cannot be empty.',
      'any.required': 'Description is required.',
    }),


  roomId: Joi.string()
    .pattern(/^[0-9a-fA-F]{24}$/)
    .required()
    .messages({
      'string.base': 'Room ID must be a string.',
      'string.pattern.base': 'Room ID must be a valid ObjectId.',
      'any.required': 'Room ID is required.',
    }),


});
