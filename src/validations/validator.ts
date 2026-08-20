import * as Joi from 'joi';

/** Letters, spaces, and hyphens only (e.g. Mary-Jane, John Paul). */
export const PERSON_NAME_PATTERN = /^[A-Za-z]+(?:[ '\-][A-Za-z]+)*$/;

export const personFirstNameRule = Joi.string()
  .trim()
  .required()
  .pattern(PERSON_NAME_PATTERN)
  .messages({
    'string.empty': 'First name is required',
    'any.required': 'First name is required',
    'string.pattern.base':
      'First name can only contain letters, spaces, and hyphens',
  });

export const personLastNameRule = Joi.string()
  .trim()
  .required()
  .pattern(PERSON_NAME_PATTERN)
  .messages({
    'string.empty': 'Last name is required',
    'any.required': 'Last name is required',
    'string.pattern.base':
      'Last name can only contain letters, spaces, and hyphens',
  });

export const passwordPolicyRule = Joi.string()
  .required()
  .min(8)
  .pattern(/[A-Z]/)
  .pattern(/[a-z]/)
  .pattern(/\d/)
  .pattern(/[^a-zA-Z0-9]/)
  .messages({
    'string.empty': 'Password is required',
    'any.required': 'Password is required',
    'string.min': 'Password must be at least 8 characters',
    'string.pattern.base':
      'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character',
  });

export const requestPasswordResetSchema = Joi.object({
  email: Joi.string().email().required().messages({
    'string.email': 'Invalid email address',
    'any.required': 'Email is required',
    'string.empty': 'Email is required',
  }),
});

export const resetPasswordSchema = Joi.object({
  token: Joi.string().trim().required().length(6).messages({
    'string.empty': 'Reset code is required',
    'any.required': 'Reset code is required',
    'string.length': 'Reset code must be 6 digits',
  }),
  newPassword: passwordPolicyRule,
});

export const createUserByLandlordSchema = Joi.object({
  firstName: personFirstNameRule,
  lastName: personLastNameRule,
  email: Joi.string().email().required(),
  nin: Joi.string().required(),
  propertyId: Joi.string().required(),
  ownerId: Joi.string().required(),
  rentStartDate: Joi.any().required(),
  rentEndDate: Joi.any().required(),
  accountType: Joi.string().valid('tenant').required(), // Validate accountType to be either 'landlord' or 'tenant'
});

export const createUserSchema = Joi.object({
  firstName: personFirstNameRule,
  lastName: personLastNameRule,
  email: Joi.string().email().required(),
  nin: Joi.string().optional().allow('', null),
  password: passwordPolicyRule,
  phoneNumber: Joi.string().trim().required().messages({
    'any.required': 'Phone number is required',
    'string.empty': 'Phone number is required',
  }),
  homeAddress: Joi.string().optional().allow('', null),
  accountType: Joi.string().valid('tenant', 'landlord').required(), // Validate accountType to be either 'landlord' or 'tenant'
});

export const confirmUserSchema = Joi.object({
  email: Joi.string().email().required(),
  confirmationCode: Joi.string().required().length(6),
});

export const resendVerificationSchema = Joi.object({
  email: Joi.string().email().required(),
});

export const loginUserSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required(),
  rememberMe: Joi.boolean().optional(),
});

export const createPropertySchema = Joi.object({
  streetAddress: Joi.string().required(),
  city: Joi.string().required(),
  state: Joi.string().required(),
  createdBy: Joi.string().required(),
  file: Joi.any().optional(),

  // Optional array fields
  landlordInsurancePolicy: Joi.array().items(Joi.string()).optional(), // Assuming array of strings
  utilityAndMaintenance: Joi.array().items(Joi.string()).optional(), // Assuming array of strings
  otherDocuments: Joi.array().items(Joi.string()).optional(), // Assuming array of strings

  // New optional fields
  preferredTenants: Joi.array().items(Joi.string()).optional(), // Assuming array of strings (e.g., ['Families', 'Professionals'])
  propertyType: Joi.any().optional(), // Assuming this is an object with 'value' and 'label'
  rentCollection: Joi.any().optional(), // Assuming this is an object with 'value' and 'label'
});

export const updatePropertySchema = Joi.object({
  status: Joi.string()
    .valid('active', 'inactive', 'suspended', 'deactivated')
    .optional(),
  streetAddress: Joi.string().optional(),
  city: Joi.string().optional(),
  state: Joi.string().optional(),
  createdBy: Joi.string().optional(),
  file: Joi.any().optional(),
  images: Joi.any().optional(),
  unit: Joi.any().optional(),
  propertyType: Joi.any().optional(),
  rentCollection: Joi.any().optional(),
  landlordInsurancePolicy: Joi.any().optional(),
  utilityAndMaintenance: Joi.any().optional(),
  otherDocuments: Joi.any().optional(),
});

export const createRoomSchema = Joi.object({
  description: Joi.string().required(),
  propertyId: Joi.any().required(),
  apartmentType: Joi.string().required(),
  rentAmountMetrics: Joi.string().required(),
  rentAmount: Joi.string()
    .required()
    .custom((value, helpers) => {
      if (String(value).includes('-')) {
        return helpers.error('any.invalid');
      }
      const parsed = Number(String(value).replace(/,/g, ''));
      if (!Number.isFinite(parsed) || parsed <= 0) {
        return helpers.error('any.invalid');
      }
      return value;
    })
    .messages({
      'any.invalid': 'Rent amount must be a positive number greater than zero.',
    }),
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
  priority: Joi.string()
    .valid('Low', 'Medium', 'High', 'Emergency')
    .optional()
    .default('Medium'),
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
