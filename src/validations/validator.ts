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