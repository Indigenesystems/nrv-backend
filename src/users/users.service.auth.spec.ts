import { BadRequestException } from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { UserService } from './users.service';
import { User } from './entities/user.entity';
import { EmailService } from '../email-sender/email.service';
import { PropertiesService } from '../properties/properties.service';
import { CloudinaryService } from '../upload/cloudinary.service';
import { PlansService } from '../plans/plans.service';
import { Room } from '../rooms/entities/room.entity';
import { Property } from '../properties/entities/property.entity';
import { Application } from '../properties/entities/application.entity';
import { NotificationSettings } from './entities/notificationSettings.entity';
import { AgreementDocuments } from '../properties/entities/agreement_documents.entity';
import { UserVerification } from './entities/userVerification';

describe('UserService auth flows', () => {
  let service: UserService;
  let emailService: { sendResetPasswordToken: jest.Mock };
  let userModel: {
    findOne: jest.Mock;
    find: jest.Mock;
    findById: jest.Mock;
    findByIdAndUpdate: jest.Mock;
  };

  beforeEach(async () => {
    emailService = { sendResetPasswordToken: jest.fn().mockResolvedValue(undefined) };
    userModel = {
      findOne: jest.fn(),
      find: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn(),
        }),
      }),
      findById: jest.fn(),
      findByIdAndUpdate: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserService,
        { provide: getModelToken(User.name), useValue: userModel },
        { provide: getModelToken(Room.name), useValue: {} },
        { provide: getModelToken(Property.name), useValue: {} },
        { provide: getModelToken(UserVerification.name), useValue: {} },
        { provide: getModelToken(Application.name), useValue: {} },
        { provide: getModelToken(NotificationSettings.name), useValue: {} },
        { provide: getModelToken(AgreementDocuments.name), useValue: {} },
        { provide: JwtService, useValue: { sign: jest.fn() } },
        { provide: EmailService, useValue: emailService },
        { provide: PropertiesService, useValue: {} },
        { provide: CloudinaryService, useValue: {} },
        {
          provide: PlansService,
          useValue: { getDefaultPlan: jest.fn().mockResolvedValue({ _id: 'plan1' }) },
        },
      ],
    }).compile();

    service = module.get<UserService>(UserService);
  });

  describe('NRV 008 / NRV 033 — duplicate phone on registration', () => {
    it('returns duplicate phone message when phone already exists', async () => {
      userModel.findOne.mockResolvedValue(null);
      userModel.find.mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue([
            { _id: 'existing-user-id', phoneNumber: '08031234567' },
          ]),
        }),
      });
      userModel.findById.mockResolvedValue({
        _id: 'existing-user-id',
        phoneNumber: '08031234567',
      });

      const result = await service.createUser({
        firstName: 'Jane',
        lastName: 'Doe',
        email: 'new@example.com',
        phoneNumber: '0803 123 4567',
        password: 'Password1!',
        accountType: 'tenant',
      } as User);

      expect(result).toEqual({
        message: 'An account with this phone number already exists',
      });
    });
  });

  describe('Password reset code expiry', () => {
    it('reuses an existing code until it expires', async () => {
      const expiresAt = new Date(Date.now() + 30 * 60 * 1000);
      userModel.findOne.mockResolvedValue({
        _id: 'user-id',
        email: 'user@example.com',
        firstName: 'Jane',
        lastName: 'Doe',
        passwordResetToken: '654321',
        passwordResetExpires: expiresAt,
      });

      const result = await service.savePasswordResetToken('user@example.com');

      expect(result).toEqual({
        expiresAt,
        reusedExistingCode: true,
      });
      expect(userModel.findByIdAndUpdate).not.toHaveBeenCalled();
      expect(emailService.sendResetPasswordToken).toHaveBeenCalledWith(
        expect.objectContaining({ passwordResetToken: '654321' }),
        expiresAt,
      );
    });
  });

  describe('NRV 106 / NRV 164 — reset token validity', () => {
    it('throws when reset code is invalid', async () => {
      userModel.findOne.mockResolvedValue(null);

      await expect(service.updatePassword('999999', 'hashed')).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.updatePassword('999999', 'hashed')).rejects.toThrow(
        'Invalid reset code',
      );
    });

    it('throws when reset code is expired', async () => {
      userModel.findOne.mockResolvedValue({
        _id: 'user-id',
        passwordResetToken: '123456',
        passwordResetExpires: new Date(Date.now() - 60_000),
      });

      await expect(service.updatePassword('123456', 'hashed')).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.updatePassword('123456', 'hashed')).rejects.toThrow(
        'expired',
      );
    });

    it('updates password when reset code is valid', async () => {
      userModel.findOne.mockResolvedValue({
        _id: 'user-id',
        passwordResetToken: '123456',
        passwordResetExpires: new Date(Date.now() + 60_000),
      });
      userModel.findByIdAndUpdate.mockResolvedValue({});

      await service.updatePassword('123456', 'hashed-password');

      expect(userModel.findByIdAndUpdate).toHaveBeenCalledWith('user-id', {
        password: 'hashed-password',
        passwordResetToken: null,
        passwordResetExpires: null,
      });
    });
  });
});
