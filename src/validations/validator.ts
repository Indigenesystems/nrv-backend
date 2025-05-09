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
  nin: Joi.string().optional().allow('', null),
  password: Joi.string().required(),
  phoneNumber: Joi.string().required(),
  homeAddress: Joi.string().optional().allow('', null),
  accountType: Joi.string().valid('tenant', 'landlord').required(), // Validate accountType to be either 'landlord' or 'tenant'
});

export const confirmUserSchema = Joi.object({
  email: Joi.string().email().required(),
  confirmationCode: Joi.string().required().length(6),
});

export const loginUserSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required(),
});

export const createPropertySchema = Joi.object({
  streetAddress: Joi.string().required(),
  city: Joi.string().required(),
  state: Joi.string().required(),
  zipCode: Joi.string().optional().allow('null', 0, ''),
  createdBy: Joi.string().required(),
  file: Joi.any().optional(),

  // Optional array fields
  landlordInsurancePolicy: Joi.array().items(Joi.string()).optional(), // Assuming array of strings
  utilityAndMaintenance: Joi.array().items(Joi.string()).optional(), // Assuming array of strings
  otherDocuments: Joi.array().items(Joi.string()).optional(), // Assuming array of strings

  // New optional fields
  preferredTenants: Joi.array().items(Joi.string()).optional(), // Assuming array of strings (e.g., ['Families', 'Professionals'])
  propertyName: Joi.string().optional(), // Property name, e.g., 'Babajide Ojo'
  propertyType: Joi.any().optional(), // Assuming this is an object with 'value' and 'label'
  rentCollection: Joi.any().optional(), // Assuming this is an object with 'value' and 'label'
});

export const updatePropertySchema = Joi.object({
  streetAddress: Joi.string().optional(),
  city: Joi.string().optional(),
  state: Joi.string().optional(),
  zipCode: Joi.string().optional(),
  createdBy: Joi.string().optional(),
  file: Joi.any().optional(),
  landlordInsurancePolicy: Joi.any().optional(),
  utilityAndMaintenance: Joi.any(),
  otherDocuments: Joi.any(),
});

export const createRoomSchema = Joi.object({
  description: Joi.string().required(),
  propertyId: Joi.any().required(),
  apartmentType: Joi.string().required(),
  rentAmountMetrics: Joi.string().required(),
  rentAmount: Joi.string().required(),
  file: Joi.any().optional(),
  noOfBaths: Joi.string().required(),
  noOfRooms: Joi.string().required(),
  noOfPools: Joi.string().optional().allow('', null),
  apartmentStyle: Joi.string().required(),
  leaseTerms: Joi.string().required(),
  paymentOption: Joi.string().required(),
  otherAmentities: Joi.any().optional().allow('', null), // usually comes as JSON string from FormData
});

export const createMaintenanceSchema = Joi.object({
  title: Joi.string().required(),
  description: Joi.string().required(),
  roomId: Joi.any().required(),
  file: Joi.any().optional(),
  createdBy: Joi.any().required(),
});

export const createExpenseSchema = Joi.object({
  amount: Joi.string().min(1).required().messages({
    'string.base': 'Amount must be a string.',
    'string.min': 'Amount cannot be empty.',
    'any.required': 'Amount is required.',
  }),
  category: Joi.string()
    .min(1)
    .messages({
      'string.base': 'Category must be a string.',
      'string.min': 'Category cannot be empty.',
    })
    .allow('', null),

  loggedBy: Joi.string().min(1).required().messages({
    'string.base': 'Category must be a string.',
    'string.min': 'Category cannot be empty.',
    'any.required': 'Category is required.',
  }),

  description: Joi.string().min(1).required().messages({
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

export const createMessageSchema = Joi.object({
  sender: Joi.string().max(50).required().messages({
    'string.base': 'Sender must be a string',
    'string.max': 'Sender name must not exceed 50 characters',
    'any.required': 'Sender is required',
  }),
  recipient: Joi.string().max(50).required().messages({
    'string.base': 'Recipient must be a string',
    'string.max': 'Recipient name must not exceed 50 characters',
    'any.required': 'Recipient is required',
  }),
  content: Joi.string().max(500).required().messages({
    'string.base': 'Content must be a string',
    'string.max': 'Content must not exceed 500 characters',
    'any.required': 'Content is required',
  }),
});
