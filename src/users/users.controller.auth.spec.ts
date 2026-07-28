import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { UserController } from './users.controller';
import { UserService } from './users.service';
import { AuthService } from '../auth/auth.service';

describe('UserController auth flows', () => {
  let controller: UserController;
  let userService: {
    findUserByEmail: jest.Mock;
    savePasswordResetToken: jest.Mock;
    updatePassword: jest.Mock;
  };

  beforeEach(async () => {
    userService = {
      findUserByEmail: jest.fn(),
      savePasswordResetToken: jest.fn(),
      updatePassword: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [UserController],
      providers: [
        { provide: UserService, useValue: userService },
        { provide: AuthService, useValue: {} },
      ],
    }).compile();

    controller = module.get<UserController>(UserController);
  });

  describe('NRV 092 / NRV 150 — unregistered email on reset request', () => {
    it('throws when email is not registered', async () => {
      userService.findUserByEmail.mockResolvedValue(null);

      await expect(
        controller.requestPasswordReset('unknown@example.com'),
      ).rejects.toThrow(NotFoundException);
      await expect(
        controller.requestPasswordReset('unknown@example.com'),
      ).rejects.toThrow('No account with this email exists');
    });

    it('sends reset code when email exists', async () => {
      userService.findUserByEmail.mockResolvedValue({
        email: 'known@example.com',
      });
      userService.savePasswordResetToken.mockResolvedValue({
        expiresAt: new Date('2026-07-28T13:00:00.000Z'),
        reusedExistingCode: false,
      });

      const result = await controller.requestPasswordReset('known@example.com');

      expect(result).toEqual({
        message:
          'Password reset code sent. It remains valid for 1 hour from when it was first issued.',
        expiresAt: '2026-07-28T13:00:00.000Z',
      });
      expect(userService.savePasswordResetToken).toHaveBeenCalledWith(
        'known@example.com',
      );
    });
  });

  describe('NRV 101 / NRV 159 — password policy on reset', () => {
    it('rejects weak passwords before calling the service', async () => {
      await expect(
        controller.resetPassword({
          token: '123456',
          newPassword: 'weak',
        }),
      ).rejects.toThrow(BadRequestException);
      expect(userService.updatePassword).not.toHaveBeenCalled();
    });
  });
});
